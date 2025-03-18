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
            SELECT id, name, party, state 
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
    const { expenseType } = req.query;
    
    try {
        const analysis = await db.all(`
            WITH deputy_expenses AS (
                SELECT 
                    d.id,
                    d.name,
                    d.party,
                    d.state,
                    SUM(e.net_value) as total_spent,
                    COUNT(DISTINCT strftime('%Y-%m', e.document_date)) as months_with_expenses
                FROM deputies d
                LEFT JOIN expenses e ON d.id = e.deputy_id
                WHERE e.expense_type = ?
                GROUP BY d.id, d.name, d.party, d.state
            ),
            stats AS (
                SELECT 
                    AVG(total_spent) as average_total,
                    AVG(total_spent / CAST(months_with_expenses as float)) as average_monthly
                FROM deputy_expenses
                WHERE months_with_expenses > 0
            )
            SELECT 
                de.*,
                (de.total_spent / CAST(de.months_with_expenses as float)) as monthly_average,
                s.average_total,
                s.average_monthly,
                ((de.total_spent - s.average_total) / s.average_total * 100) as total_percentage_diff,
                (de.total_spent - s.average_total) as total_absolute_diff,
                (((de.total_spent / CAST(de.months_with_expenses as float)) - s.average_monthly) / s.average_monthly * 100) as monthly_percentage_diff,
                ((de.total_spent / CAST(de.months_with_expenses as float)) - s.average_monthly) as monthly_absolute_diff,
                RANK() OVER (ORDER BY total_spent DESC) as total_rank,
                RANK() OVER (ORDER BY (total_spent / CAST(months_with_expenses as float)) DESC) as monthly_rank
            FROM deputy_expenses de, stats s
            WHERE de.months_with_expenses > 0
            ORDER BY total_spent DESC
        `, [expenseType]);

        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint
app.get('/api/expenses/party-analysis', async (req, res) => {
    const { expenseType } = req.query;
    
    try {
        const analysis = await db.all(`
            WITH party_totals AS (
                SELECT 
                    d.party,
                    COUNT(DISTINCT d.id) as deputy_count,
                    SUM(e.net_value) as total_spent,
                    SUM(e.net_value) / COUNT(DISTINCT d.id) as avg_per_deputy
                FROM deputies d
                LEFT JOIN expenses e ON d.id = e.deputy_id
                WHERE e.expense_type = ?
                    AND d.party IS NOT NULL
                GROUP BY d.party
            ),
            stats AS (
                SELECT 
                    AVG(avg_per_deputy) as overall_average
                FROM party_totals
            )
            SELECT 
                pt.*,
                s.overall_average,
                ((pt.avg_per_deputy - s.overall_average) / s.overall_average * 100) as percentage_diff,
                (pt.avg_per_deputy - s.overall_average) as absolute_diff,
                RANK() OVER (ORDER BY pt.avg_per_deputy DESC) as rank
            FROM party_totals pt, stats s
            ORDER BY pt.avg_per_deputy DESC
        `, [expenseType]);

        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint
app.get('/api/expenses/state-analysis', async (req, res) => {
    const { expenseType } = req.query;
    
    try {
        const analysis = await db.all(`
            WITH state_totals AS (
                SELECT 
                    d.state,
                    COUNT(DISTINCT d.id) as deputy_count,
                    SUM(e.net_value) as total_spent,
                    SUM(e.net_value) / COUNT(DISTINCT d.id) as avg_per_deputy
                FROM deputies d
                LEFT JOIN expenses e ON d.id = e.deputy_id
                WHERE e.expense_type = ?
                    AND d.state IS NOT NULL
                GROUP BY d.state
            ),
            stats AS (
                SELECT 
                    AVG(avg_per_deputy) as overall_average
                FROM state_totals
            )
            SELECT 
                pt.*,
                s.overall_average,
                ((pt.avg_per_deputy - s.overall_average) / s.overall_average * 100) as percentage_diff,
                (pt.avg_per_deputy - s.overall_average) as absolute_diff,
                RANK() OVER (ORDER BY pt.avg_per_deputy DESC) as rank
            FROM state_totals pt, stats s
            ORDER BY pt.avg_per_deputy DESC
        `, [expenseType]);

        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 