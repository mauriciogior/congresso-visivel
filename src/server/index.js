import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());


const db = await open({
    filename: '../deputies.db',
    driver: sqlite3.Database
});

// Get all expense types
app.get('/api/expense-types', async (req, res) => {
    try {
        const types = await db.all(`
            SELECT DISTINCT expense_type 
            FROM expenses 
            WHERE expense_type IS NOT NULL
            ORDER BY expense_type
        `);
        res.json(types.map(t => ({ expense_type: t.expense_type })));
    } catch (error) {
        console.error('Error fetching expense types:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all deputies
app.get('/api/deputies', async (req, res) => {
    try {
        const deputies = await db.all(`
            SELECT id, name, party, state, slug
            FROM deputies 
            ORDER BY name
        `);
        res.json(deputies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get expenses analysis by type
app.get('/api/expenses/analysis', async (req, res) => {
    const { expenseType, year } = req.query;
    
    try {
        const conditions = [];
        const params = [];
        
        if (expenseType !== 'all' && expenseType) {
            conditions.push('e.expense_type = ?');
            params.push(expenseType);
        }
        if (year) {
            conditions.push("strftime('%Y', e.document_date) = ?");
            params.push(year);
        }
        
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        
        const analysis = await db.all(`
            WITH filtered_expenses AS (
                SELECT 
                    e.deputy_id,
                    e.net_value,
                    e.document_date
                FROM expenses e
                WHERE 1=1 ${whereClause ? whereClause.replace('WHERE ', ' AND ') : ''}
            ),
            /* First, identify deputies who have ANY expenses in the selected year */
            active_deputies AS (
                SELECT DISTINCT e.deputy_id, d.party, d.state
                FROM expenses e
                JOIN deputies d ON e.deputy_id = d.id
                WHERE ${year ? `strftime('%Y', e.document_date) = '${year}'` : '1=1'}
            ),
            deputy_expenses AS (
                SELECT 
                    ad.deputy_id as id,
                    d.name,
                    ad.party,
                    ad.state,
                    COALESCE(SUM(fe.net_value), 0) as total_spent,
                    COALESCE(COUNT(DISTINCT strftime('%Y-%m', fe.document_date)), 0) as months_with_expenses
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
                d.slug,
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

        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint
app.get('/api/expenses/party-analysis', async (req, res) => {
    const { expenseType, year } = req.query;
    
    try {
        const params = [];
        let expenseFilter = '';
        
        // Build filter conditions
        if (expenseType !== 'all' && expenseType) {
            expenseFilter = 'AND e.expense_type = ?';
            params.push(expenseType);
        }

        // Year filter will be applied directly in the SQL
        const yearParam = year || null;
        
        // Create the query with cleaner structure
        const query = `
            WITH active_deputies AS (
                -- Get active deputies for the selected year with their party
                SELECT DISTINCT e.deputy_id, d.party
                FROM expenses e
                JOIN deputies d ON e.deputy_id = d.id
                WHERE d.party IS NOT NULL
                ${yearParam ? "AND strftime('%Y', e.document_date) = ?" : ""}
            ),
            filtered_expenses AS (
                -- Get relevant expenses based on filters
                SELECT 
                    e.deputy_id,
                    SUM(e.net_value) as expense_sum
                FROM expenses e
                JOIN active_deputies ad ON e.deputy_id = ad.deputy_id
                WHERE 1=1
                ${expenseFilter}
                ${yearParam ? "AND strftime('%Y', e.document_date) = ?" : ""}
                GROUP BY e.deputy_id
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
        
        // Add year param twice if needed (once for active_deputies, once for filtered_expenses)
        if (yearParam) {
            params.push(yearParam);
            params.push(yearParam);
        }
        
        const analysis = await db.all(query, params);
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
        const params = [];
        let expenseFilter = '';
        
        // Build filter conditions
        if (expenseType !== 'all' && expenseType) {
            expenseFilter = 'AND e.expense_type = ?';
            params.push(expenseType);
        }

        // Year filter will be applied directly in the SQL
        const yearParam = year || null;
        
        // Create the query with cleaner structure
        const query = `
            WITH active_deputies AS (
                -- Get active deputies for the selected year with their state
                SELECT DISTINCT e.deputy_id, d.state
                FROM expenses e
                JOIN deputies d ON e.deputy_id = d.id
                WHERE d.state IS NOT NULL
                ${yearParam ? "AND strftime('%Y', e.document_date) = ?" : ""}
            ),
            filtered_expenses AS (
                -- Get relevant expenses based on filters
                SELECT 
                    e.deputy_id,
                    SUM(e.net_value) as expense_sum
                FROM expenses e
                JOIN active_deputies ad ON e.deputy_id = ad.deputy_id
                WHERE 1=1
                ${expenseFilter}
                ${yearParam ? "AND strftime('%Y', e.document_date) = ?" : ""}
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
        
        // Add year param twice if needed (once for active_deputies, once for filtered_expenses)
        if (yearParam) {
            params.push(yearParam);
            params.push(yearParam);
        }
        
        const analysis = await db.all(query, params);
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
            conditions.push("strftime('%Y', document_date) = ?");
            params.push(year);
        }
        
        if (month) {
            conditions.push("strftime('%m', document_date) = ?");
            params.push(month.padStart(2, '0')); // Ensure month is 2 digits
        }
        
        // Get expense summary by type and date
        const expenses = await db.all(`
            SELECT 
                id,
                expense_type,
                document_id,
                document_type,
                document_date,
                document_number,
                document_value,
                net_value,
                supplier_name,
                supplier_id,
                strftime('%Y', document_date) as year,
                strftime('%m', document_date) as month
            FROM expenses
            WHERE ${conditions.join(' AND ')}
            ORDER BY document_date DESC
        `, params);
        
        // Get available years for this deputy
        const years = await db.all(`
            SELECT DISTINCT strftime('%Y', document_date) as year
            FROM expenses
            WHERE deputy_id = ?
            ORDER BY year DESC
        `, [deputy.id]);
        
        // Get available months if a year is selected
        const months = year ? await db.all(`
            SELECT DISTINCT strftime('%m', document_date) as month
            FROM expenses
            WHERE deputy_id = ? AND strftime('%Y', document_date) = ?
            ORDER BY month
        `, [deputy.id, year]) : [];
        
        // Get expense types for this deputy
        const types = await db.all(`
            SELECT DISTINCT expense_type
            FROM expenses
            WHERE deputy_id = ?
            ORDER BY expense_type
        `, [deputy.id]);
        
        res.json({
            deputy,
            expenses,
            filters: {
                years: years.map(y => y.year),
                months: months.map(m => m.month),
                expenseTypes: types.map(t => t.expense_type)
            }
        });
    } catch (error) {
        console.error('Error fetching deputy details:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 