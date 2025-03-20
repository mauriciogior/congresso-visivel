import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import redis from 'redis';

// Base URL for the API
const BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';

// Initialize database connection
async function initializeDB() {
    const db = await open({
        filename: './deputies.db',
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS deputies (
            id INTEGER PRIMARY KEY,
            name TEXT,
            party TEXT,
            state TEXT,
            legislature INTEGER,
            photo_url TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS deputies_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deputy_id INTEGER,
            party TEXT,
            state TEXT,
            legislature INTEGER,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(deputy_id, legislature)
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deputy_id INTEGER,
            year INTEGER,
            month INTEGER,
            expense_type TEXT,
            document_id INTEGER,
            document_type TEXT,
            document_date TEXT,
            document_number TEXT,
            document_value REAL,
            document_url TEXT,
            supplier_name TEXT,
            supplier_id TEXT,
            net_value REAL,
            gloss_value REAL,
            refund_number TEXT,
            batch_code INTEGER,
            installment INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(deputy_id, document_id)
        );

        CREATE TABLE IF NOT EXISTS process_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deputy_id INTEGER,
            last_page INTEGER,
            status TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    return db;
}

// Fetch all deputies
async function fetchDeputies(url) {
    const response = await fetch(url);
    return await response.json();
}

// Fetch deputy info
async function fetchDeputyInfo(url) {
    const response = await fetch(url);
    return await response.json();
}

// Fetch expenses for a deputy
async function fetchExpenses(url) {
    const response = await fetch(url);
    return await response.json();
}

// Save deputy to database
async function saveDeputy(db, deputy) {
    try {
        await db.run(`
            INSERT OR REPLACE INTO deputies (id, name, party, state, legislature, photo_url, email)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            deputy.id,
            deputy.nome,
            deputy.siglaPartido,
            deputy.siglaUf,
            deputy.idLegislatura,
            deputy.urlFoto,
            deputy.email
        ]);
    } catch (error) {
        console.error(`Error saving deputy ${deputy.id}:`, error);
    }
}

// Save deputy info to database
async function saveDeputyInfo(db, deputy) {
    try {
        await db.run(`
            INSERT OR REPLACE INTO deputies_info (deputy_id, party, state, legislature, title)
            VALUES (?, ?, ?, ?, ?)
        `, [
            deputy.id,
            deputy.siglaPartido,
            deputy.siglaUf,
            deputy.idLegislatura,
            deputy.condicaoEleitoral
        ]);
    } catch (error) {
        console.error(`Error saving deputy info ${deputy.id}:`, error);
    }
}

// Save expense to database
async function saveExpense(db, deputyId, expense) {
    try {
        await db.run(`
            INSERT OR IGNORE INTO expenses (
                deputy_id, year, month, expense_type, document_id,
                document_type, document_date, document_number,
                document_value, document_url, supplier_name,
                supplier_id, net_value, gloss_value,
                refund_number, batch_code, installment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            deputyId,
            expense.ano,
            expense.mes,
            expense.tipoDespesa,
            expense.codDocumento,
            expense.tipoDocumento,
            expense.dataDocumento,
            expense.numDocumento,
            expense.valorDocumento,
            expense.urlDocumento,
            expense.nomeFornecedor,
            expense.cnpjCpfFornecedor,
            expense.valorLiquido,
            expense.valorGlosa,
            expense.numRessarcimento,
            expense.codLote,
            expense.parcela
        ]);
    } catch (error) {
        console.error(`Error saving expense for deputy ${deputyId}:`, error);
    }
}

// Update process log
async function updateProcessLog(db, deputyId, lastPage, status) {
    await db.run(`
        INSERT OR REPLACE INTO process_log (deputy_id, last_page, status)
        VALUES (?, ?, ?)
    `, [deputyId, lastPage, status]);
}

// Get last processed page for deputy
async function getLastProcessedPage(db, deputyId) {
    const row = await db.get(
        'SELECT last_page FROM process_log WHERE deputy_id = ?',
        deputyId
    );
    return row ? row.last_page : 0;
}

// Initialize Redis client
async function initializeRedis() {
    const redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => console.error('Redis error:', err));
    redisClient.on('connect', () => console.log('Connected to Redis'));

    await redisClient.connect();
    return redisClient;
}

// Clear Redis cache
async function clearRedisCache(redisClient) {
    try {
        await redisClient.flushAll();
        console.log('Redis cache cleared successfully');
    } catch (error) {
        console.error('Error clearing Redis cache:', error);
    }
}

// Main function
async function main() {
    const db = await initializeDB();
    const redisClient = await initializeRedis();

    const legislatures = [ 56, 57 ];

    for (const legislature of legislatures) {
    
        // Fetch and save all deputies
        let deputiesUrl = `${BASE_URL}/deputados?idLegislatura=${legislature}&itens=1000&ordem=ASC&ordenarPor=nome`;
        let hasMoreDeputies = true;

        while (hasMoreDeputies) {
            try {
                const response = await fetchDeputies(deputiesUrl);
                
                // Save deputies
                for (const deputy of response.dados) {
                    await saveDeputy(db, deputy);

                    const deputyInfoUrl = `${BASE_URL}/deputados/${deputy.id}/historico`;
                    const deputyInfoResponse = await fetchDeputyInfo(deputyInfoUrl);

                    for (const info of deputyInfoResponse.dados) {
                        await saveDeputyInfo(db, info);
                    }
                }

                // Check for next page
                const nextLink = response.links.find(link => link.rel === 'next');
                if (nextLink) {
                    deputiesUrl = nextLink.href;
                } else {
                    hasMoreDeputies = false;
                }
            } catch (error) {
                console.error('Error fetching deputies:', error);
                break;
            }
        }

        // Fetch expenses for deputies in parallel batches
        const deputies = await db.all('SELECT id FROM deputies');
        const BATCH_SIZE = 10; // Process 10 deputies at a time
        
        for (let i = 0; i < deputies.length; i += BATCH_SIZE) {
            const batch = deputies.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (deputy) => {
                let lastProcessedPage = await getLastProcessedPage(db, deputy.id);
                let expensesUrl = `${BASE_URL}/deputados/${deputy.id}/despesas?idLegislatura=${legislature}&itens=1000&ordem=DESC&ordenarPor=codDocumento`;
                
                if (lastProcessedPage > 0) {
                    expensesUrl += `&pagina=${lastProcessedPage}`;
                }

                let currentPage = lastProcessedPage || 1;
                let hasMoreExpenses = true;

                while (hasMoreExpenses) {
                    try {
                        console.log(`Fetching expenses for deputy ${deputy.id}, page ${currentPage}`);
                        const response = await fetchExpenses(expensesUrl);

                        // Save expenses
                        for (const expense of response.dados) {
                            await saveExpense(db, deputy.id, expense);
                        }

                        // Update process log
                        await updateProcessLog(db, deputy.id, currentPage, 'PROCESSED');

                        // Check for next page
                        const nextLink = response.links.find(link => link.rel === 'next');
                        if (nextLink) {
                            expensesUrl = nextLink.href;
                            currentPage++;
                        } else {
                            hasMoreExpenses = false;
                        }
                    } catch (error) {
                        console.error(`Error fetching expenses for deputy ${deputy.id}:`, error);
                        break;
                    }
                }
            });

            // Wait for current batch to complete before moving to next batch
            await Promise.all(promises);
        }
    }

    // Clear Redis cache after all data has been processed
    console.log('Data processing complete. Clearing Redis cache...');
    await clearRedisCache(redisClient);
    
    // Close connections
    await redisClient.disconnect();
    await db.close();
    console.log('All connections closed. Process complete.');
}

main().catch(console.error); 