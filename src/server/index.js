import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';
import redis from 'redis';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

// Connect to Redis
(async () => {
    await redisClient.connect();
})();

const db = await open({
    filename: '../deputies.db',
    driver: sqlite3.Database
});

const withTitularDeputiesSql = (year) => `
    titular_deputies AS (
        SELECT DISTINCT di.deputy_id, di.title
        FROM deputies_info di
        WHERE di.title = 'Titular'
        ${year ? `AND di.legislature = ${year === '2019' ? 56 : 57}` : ''}
    )
`;

const withActiveDeputiesSql = (year) => `
    active_deputies AS (
        SELECT DISTINCT e.deputy_id, d.party, d.state, td.title
        FROM expenses e
        JOIN deputies d ON e.deputy_id = d.id
        JOIN titular_deputies td ON e.deputy_id = td.deputy_id
        WHERE ${year ? 
            `(
                (e.year = ${parseInt(year)} AND e.month > 1) OR 
                (e.year > ${parseInt(year)} AND e.year < ${parseInt(year) + 3}) OR 
                (e.year = ${parseInt(year) + 3}) OR
                (e.year = ${parseInt(year) + 4} AND e.month = 1)
            )` : '1=1'}
    )
`;

const mandateFilterSql = (year) => {
    const mandateStartYear = parseInt(year);
    const mandateEndYear = mandateStartYear + 3;

    return `(
        (e.year = ${mandateStartYear} AND e.month > 1) OR 
        (e.year > ${mandateStartYear} AND e.year < ${mandateEndYear}) OR 
        (e.year = ${mandateEndYear}) OR
        (e.year = ${mandateEndYear + 1} AND e.month = 1)
    )`;
}

function buildBasicConditions(year, expenseType) {
    const conditions = [];
    const params = [];

    if (expenseType !== 'all' && expenseType) {
        conditions.push('e.expense_type = ?');
        params.push(expenseType);
    }
    if (year) {
        conditions.push(mandateFilterSql(year));
    }

    return { conditions, params };
}

// Get all expense types
app.get('/api/expense-types', async (req, res) => {
    try {
        // Check cache first
        const cacheKey = 'expense-types';
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        // If not in cache, fetch from database
        const types = await db.all(`
            SELECT DISTINCT expense_type 
            FROM expenses 
            WHERE expense_type IS NOT NULL
            ORDER BY expense_type
        `);
        
        const result = types.map(t => ({ expense_type: t.expense_type }));
        
        // Store in cache (no expiration)
        await redisClient.set(cacheKey, JSON.stringify(result));
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching expense types:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all deputies
app.get('/api/deputies', async (req, res) => {
    try {
        // Check cache first
        const cacheKey = 'deputies';
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        // If not in cache, fetch from database
        const deputies = await db.all(`
            SELECT id, name, party, state, slug
            FROM deputies 
            ORDER BY name
        `);
        
        // Store in cache (no expiration)
        await redisClient.set(cacheKey, JSON.stringify(deputies));
        
        res.json(deputies);
    } catch (error) {
        console.error('Error fetching deputies:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get expenses analysis by type
app.get('/api/expenses/analysis', async (req, res) => {
    const { expenseType, year } = req.query;
    
    try {
        // Check cache first
        const cacheKey = `analysis:${expenseType || 'all'}:${year || 'all'}`;
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        // If not in cache, fetch from database
        const { conditions, params } = buildBasicConditions(year, expenseType);
        
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        
        const analysis = await db.all(`
            WITH filtered_expenses AS (
                SELECT 
                    e.deputy_id,
                    e.net_value,
                    e.document_date,
                    e.year,
                    e.month
                FROM expenses e
                WHERE 1=1 ${whereClause ? whereClause.replace('WHERE ', ' AND ') : ''}
            ),
            ${withTitularDeputiesSql(year)},
            ${withActiveDeputiesSql(year)},
            deputy_expenses AS (
                SELECT 
                    ad.deputy_id as id,
                    d.name,
                    ad.title,
                    ad.party,
                    ad.state,
                    COALESCE(SUM(fe.net_value), 0) as total_spent,
                    COALESCE(COUNT(DISTINCT CAST(fe.year AS TEXT) || '-' || CAST(fe.month AS TEXT)), 0) as months_with_expenses
                FROM active_deputies ad
                JOIN deputies d ON ad.deputy_id = d.id
                LEFT JOIN filtered_expenses fe ON ad.deputy_id = fe.deputy_id
                GROUP BY ad.deputy_id, d.name, ad.party, ad.state
            ),
            stats AS (
                SELECT 
                    AVG(CASE WHEN total_spent > 0 THEN total_spent ELSE NULL END) as average_total,
                    AVG(CASE WHEN months_with_expenses > 0 THEN total_spent / CAST(months_with_expenses as float) ELSE NULL END) as average_monthly
                FROM deputy_expenses
            )
            SELECT 
                de.id,
                de.name,
                de.party,
                de.state,
                d.photo_url,
                d.slug,
                de.title,
                de.total_spent,
                de.months_with_expenses,
                CASE 
                    WHEN de.months_with_expenses > 0 THEN de.total_spent / CAST(de.months_with_expenses as float)
                    ELSE 0 
                END as monthly_average,
                s.average_total,
                s.average_monthly,
                CASE 
                    WHEN de.total_spent > 0 THEN ((de.total_spent - s.average_total) / s.average_total * 100)
                    ELSE -100 -- No spending means 100% below average
                END as total_percentage_diff,
                CASE 
                    WHEN de.total_spent > 0 THEN (de.total_spent - s.average_total)
                    ELSE -s.average_total -- Difference is the negative of the average
                END as total_absolute_diff,
                CASE 
                    WHEN de.months_with_expenses > 0 THEN (((de.total_spent / CAST(de.months_with_expenses as float)) - s.average_monthly) / s.average_monthly * 100)
                    ELSE -100 -- No monthly spending means 100% below average
                END as monthly_percentage_diff,
                CASE 
                    WHEN de.months_with_expenses > 0 THEN ((de.total_spent / CAST(de.months_with_expenses as float)) - s.average_monthly)
                    ELSE -s.average_monthly -- Difference is the negative of the average
                END as monthly_absolute_diff,
                RANK() OVER (ORDER BY de.total_spent DESC) as total_rank,
                RANK() OVER (ORDER BY (CASE WHEN de.months_with_expenses > 0 THEN de.total_spent / CAST(de.months_with_expenses as float) ELSE 0 END) DESC) as monthly_rank
            FROM deputy_expenses de
            JOIN deputies d ON de.id = d.id
            CROSS JOIN stats s
            ORDER BY total_spent DESC
        `, params);

        // Store in cache (no expiration)
        await redisClient.set(cacheKey, JSON.stringify(analysis));
        
        res.json(analysis);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint
app.get('/api/expenses/party-analysis', async (req, res) => {
    const { expenseType, year } = req.query;
    
    try {
        // Check cache first
        const cacheKey = `party-analysis:${expenseType || 'all'}:${year || 'all'}`;
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const conditions = [];
        const params = [];

        if (expenseType !== 'all' && expenseType) {
            conditions.push('e.expense_type = ?');
            params.push(expenseType);
        }

        // Create the query with cleaner structure
        const query = `
            WITH 
            ${withTitularDeputiesSql(year)},
            ${withActiveDeputiesSql(year)},
            filtered_expenses AS (
                -- Get relevant expenses based on filters
                SELECT 
                    e.deputy_id,
                    d.party,
                    SUM(e.net_value) as expense_sum
                FROM expenses e
                JOIN deputies d ON e.deputy_id = d.id
                JOIN active_deputies ad ON e.deputy_id = ad.deputy_id
                WHERE 1=1 AND ${mandateFilterSql(year)}
                    ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
                GROUP BY e.deputy_id, d.party
            ),
            party_totals AS (
                -- Calculate party-level aggregates
                SELECT 
                    ad.party,
                    COUNT(DISTINCT ad.deputy_id) as deputy_count,
                    COALESCE(SUM(fe.expense_sum), 0) as total_spent,
                    COALESCE(SUM(fe.expense_sum), 0) / COUNT(DISTINCT ad.deputy_id) as avg_per_deputy
                FROM active_deputies ad
                LEFT JOIN filtered_expenses fe ON ad.deputy_id = fe.deputy_id
                GROUP BY ad.party
            ),
            stats AS (
                -- Calculate overall statistics
                SELECT 
                    AVG(CASE WHEN total_spent > 0 THEN avg_per_deputy ELSE NULL END) as overall_average
                FROM party_totals
            )
            -- Final result set
            SELECT 
                pt.party,
                pt.deputy_count,
                pt.total_spent,
                pt.avg_per_deputy,
                s.overall_average,
                CASE
                    WHEN pt.total_spent > 0 THEN ((pt.avg_per_deputy - s.overall_average) / s.overall_average * 100)
                    ELSE -100 -- No spending means 100% below average
                END as percentage_diff,
                CASE
                    WHEN pt.total_spent > 0 THEN (pt.avg_per_deputy - s.overall_average)
                    ELSE -s.overall_average -- Difference is the negative of the average
                END as absolute_diff,
                RANK() OVER (ORDER BY pt.avg_per_deputy DESC) as rank
            FROM party_totals pt, stats s
            ORDER BY pt.avg_per_deputy DESC
        `;
        
        const analysis = await db.all(query, params);
        
        // Store in cache (no expiration)
        await redisClient.set(cacheKey, JSON.stringify(analysis));
        
        res.json(analysis);
    } catch (error) {
        console.error('Party analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint
app.get('/api/expenses/state-analysis', async (req, res) => {
    const { expenseType, year } = req.query;
    
    try {
        // Check cache first
        const cacheKey = `state-analysis:${expenseType || 'all'}:${year || 'all'}`;
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        const conditions = [];
        const params = [];

        if (expenseType !== 'all' && expenseType) {
            conditions.push('e.expense_type = ?');
            params.push(expenseType);
        }

        // Create the query with cleaner structure
        const query = `
            WITH 
            ${withTitularDeputiesSql(year)},
            ${withActiveDeputiesSql(year)},
            filtered_expenses AS (
                -- Get relevant expenses based on filters
                SELECT 
                    e.deputy_id,
                    SUM(e.net_value) as expense_sum
                FROM expenses e
                JOIN active_deputies ad ON e.deputy_id = ad.deputy_id
                WHERE 1=1 AND ${mandateFilterSql(year)}
                    ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
                GROUP BY e.deputy_id
            ),
            state_totals AS (
                -- Calculate state-level aggregates
                SELECT 
                    ad.state,
                    COUNT(DISTINCT ad.deputy_id) as deputy_count,
                    COALESCE(SUM(fe.expense_sum), 0) as total_spent,
                    COALESCE(SUM(fe.expense_sum), 0) / COUNT(DISTINCT ad.deputy_id) as avg_per_deputy
                FROM active_deputies ad
                LEFT JOIN filtered_expenses fe ON ad.deputy_id = fe.deputy_id
                GROUP BY ad.state
            ),
            stats AS (
                -- Calculate overall statistics
                SELECT 
                    AVG(CASE WHEN total_spent > 0 THEN avg_per_deputy ELSE NULL END) as overall_average
                FROM state_totals
            )
            -- Final result set
            SELECT 
                st.state,
                st.deputy_count,
                st.total_spent,
                st.avg_per_deputy,
                s.overall_average,
                CASE
                    WHEN st.total_spent > 0 THEN ((st.avg_per_deputy - s.overall_average) / s.overall_average * 100)
                    ELSE -100 -- No spending means 100% below average
                END as percentage_diff,
                CASE
                    WHEN st.total_spent > 0 THEN (st.avg_per_deputy - s.overall_average)
                    ELSE -s.overall_average -- Difference is the negative of the average
                END as absolute_diff,
                RANK() OVER (ORDER BY st.avg_per_deputy DESC) as rank
            FROM state_totals st, stats s
            ORDER BY st.avg_per_deputy DESC
        `;
        
        const analysis = await db.all(query, params);
        
        // Store in cache (no expiration)
        await redisClient.set(cacheKey, JSON.stringify(analysis));
        
        res.json(analysis);
    } catch (error) {
        console.error('State analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get deputy details by slug or ID with expenses
app.get('/api/deputy/:slugOrId', async (req, res) => {
    const { slugOrId } = req.params;
    const { expenseType, year, month } = req.query;
    
    try {
        // Check cache first
        const cacheKey = `deputy:${slugOrId}:${expenseType || 'all'}:${year || 'all'}:${month || 'all'}`;
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        // If not in cache, fetch from database
        // Check if the parameter is an ID (numeric) or a slug (name-based)
        const isId = /^\d+$/.test(slugOrId);
        
        // Get deputy details based on ID or slug
        let deputy;
        
        if (isId) {
            deputy = await db.get(`
                SELECT id, name, party, state, photo_url, email, slug
                FROM deputies 
                WHERE id = ?
            `, [slugOrId]);
        } else {
            // Look up by slug - direct match
            deputy = await db.get(`
                SELECT id, name, party, state, photo_url, email, slug
                FROM deputies 
                WHERE slug = ?
            `, [slugOrId]);
            
            // If not found, try a partial match
            if (!deputy) {
                console.log(`Deputy not found with exact slug match: ${slugOrId}, trying partial match`);
                
                deputy = await db.get(`
                    SELECT id, name, party, state, photo_url, email, slug
                    FROM deputies 
                    WHERE slug LIKE ?
                    LIMIT 1
                `, [`%${slugOrId}%`]);
                
                if (deputy) {
                    console.log(`Found deputy with partial slug match: ${deputy.name} (slug: ${deputy.slug})`);
                }
            }
        }
        
        if (!deputy) {
            return res.status(404).json({ error: 'Deputy not found' });
        }
        
        // Build conditions for expenses query
        const conditions = ['deputy_id = ?'];
        const params = [deputy.id]; // Use deputy.id from the found deputy object
        
        if (expenseType && expenseType !== 'all') {
            conditions.push('expense_type = ?');
            params.push(expenseType);
        }
        
        if (year) {
            // Handle election years (2019, 2023, 2027...)
            const isPostElectionYear = (parseInt(year) - 2019) % 4 === 0;
            
            if (isPostElectionYear) {
                conditions.push("(e.year = ? AND e.month > 1)");
                params.push(year);
            } else if (parseInt(year) % 4 === 3) { // Pre-election year (2018, 2022, 2026...)
                conditions.push("(e.year = ? OR (e.year = ? AND e.month = 1))");
                params.push(year);
                params.push(parseInt(year) + 1);
            } else {
                conditions.push("e.year = ?");
                params.push(year);
            }
        }
        
        if (month) {
            conditions.push("e.month = ?");
            params.push(month); 
        }
        
        // Get expense summary by type and date, joining with supplier data
        const expenses = await db.all(`
            SELECT 
                e.id,
                e.expense_type,
                e.document_id,
                e.document_type,
                e.document_date,
                e.document_number,
                e.document_value,
                e.net_value,
                e.supplier_name,
                e.supplier_id,
                e.document_url,
                e.year,
                e.month,
                s.name as supplier_full_name,
                s.founding_date as supplier_founding_date,
                s.main_activity as supplier_main_activity,
                s.address as supplier_address
            FROM expenses e
            LEFT JOIN suppliers s ON s.cnpj = e.supplier_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY e.document_date DESC
        `, params);
        
        // Get available years for this deputy
        const years = await db.all(`
            SELECT DISTINCT year
            FROM expenses
            WHERE deputy_id = ?
            ORDER BY year DESC
        `, [deputy.id]);
        
        // Get available months if a year is selected
        const months = year ? await db.all(`
            SELECT DISTINCT month
            FROM expenses
            WHERE deputy_id = ? 
            ${
                (parseInt(year) - 2019) % 4 === 0 ? 
                `AND ((year = ? AND month > 1) OR (year = ? AND month = 1))` : 
                parseInt(year) % 4 === 3 ? 
                `AND ((year = ? AND month <= 12) OR (year = ? AND month = 1))` :
                `AND year = ?`
            }
            ORDER BY month
        `, [
            deputy.id,
            ...(
                (parseInt(year) - 2019) % 4 === 0 ? 
                [year, parseInt(year) - 1] : 
                parseInt(year) % 4 === 3 ? 
                [year, parseInt(year) + 1] : 
                [year]
            )
        ]) : [];
        
        // Get expense types for this deputy
        const types = await db.all(`
            SELECT DISTINCT expense_type
            FROM expenses
            WHERE deputy_id = ?
            ORDER BY expense_type
        `, [deputy.id]);
        
        const result = {
            deputy,
            expenses,
            filters: {
                years: years.map(y => y.year),
                months: months.map(m => m.month),
                expenseTypes: types.map(t => t.expense_type)
            }
        };
        
        // Store in cache (no expiration)
        await redisClient.set(cacheKey, JSON.stringify(result));
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching deputy details:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});