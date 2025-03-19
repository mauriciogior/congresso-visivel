import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fetch from 'node-fetch';

// Configuration
const DB_PATH = './src/deputies.db';
const BRASIL_API_URL = 'https://brasilapi.com.br/api/cnpj/v1/';
const BATCH_SIZE = 10; // Number of CNPJs to process in each batch
const DELAY_BETWEEN_REQUESTS = 1200; // Delay between requests in ms (to avoid rate limiting)

/**
 * Format CNPJ to remove special characters
 * @param {string} cnpj - CNPJ with or without formatting
 * @returns {string} Normalized CNPJ (only digits)
 */
function normalizeCNPJ(cnpj) {
  if (!cnpj) return null;
  return cnpj.replace(/\D/g, '');
}

/**
 * Create suppliers table if it doesn't exist
 * @param {object} db - Database connection
 */
async function ensureSuppliersTable(db) {
  try {
    // Check if table exists
    const tableExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'`
    );
    
    if (!tableExists) {
      console.log('Creating suppliers table...');
      await db.exec(`
        CREATE TABLE suppliers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cnpj TEXT UNIQUE NOT NULL,
          name TEXT,
          founding_date TEXT,
          main_activity TEXT,
          address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index on CNPJ
      await db.exec(`CREATE INDEX idx_suppliers_cnpj ON suppliers(cnpj)`);
      console.log('Suppliers table created successfully');
    } else {
      console.log('Suppliers table already exists');
    }
  } catch (error) {
    console.error('Error ensuring suppliers table exists:', error);
    throw error;
  }
}

/**
 * Extract company data from Brasil API response
 * @param {object} apiResponse - JSON response from Brasil API
 * @returns {object} Extracted company data
 */
function extractCompanyData(apiResponse) {
  try {
    if (!apiResponse) return null;
    
    // Format address components into a single string
    const addressParts = [];
    if (apiResponse.descricao_tipo_de_logradouro) addressParts.push(apiResponse.descricao_tipo_de_logradouro);
    if (apiResponse.logradouro) addressParts.push(apiResponse.logradouro);
    if (apiResponse.numero) addressParts.push(apiResponse.numero);
    if (apiResponse.complemento) addressParts.push(apiResponse.complemento);
    if (apiResponse.bairro) addressParts.push(apiResponse.bairro);
    if (apiResponse.municipio) addressParts.push(apiResponse.municipio);
    if (apiResponse.uf) addressParts.push(apiResponse.uf);
    if (apiResponse.cep) {
      // Format CEP as 00000-000
      const formattedCEP = apiResponse.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
      addressParts.push(formattedCEP);
    }
    
    const formattedAddress = addressParts.join(', ').replace(/,\s*,/g, ',');
    
    // Create the company data object with the fields we need
    return {
      name: apiResponse.razao_social,
      founding_date: apiResponse.data_inicio_atividade,
      main_activity: apiResponse.cnae_fiscal_descricao,
      address: formattedAddress
    };
  } catch (error) {
    console.error('Error extracting company data:', error);
    return null;
  }
}

/**
 * Fetch company data from Brasil API
 * @param {string} cnpj - CNPJ (only digits)
 * @returns {object} Company data
 */
async function fetchCompanyData(cnpj) {
  try {
    // Remove any non-digit characters
    const normalizedCNPJ = normalizeCNPJ(cnpj);
    
    console.log(`Fetching data for CNPJ: ${normalizedCNPJ}`);
    
    const response = await fetch(`${BRASIL_API_URL}${normalizedCNPJ}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`CNPJ not found: ${normalizedCNPJ}`);
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const apiResponse = await response.json();
    return extractCompanyData(apiResponse);
  } catch (error) {
    console.error(`Error fetching data for CNPJ ${cnpj}:`, error);
    return null;
  }
}

/**
 * Process a batch of CNPJs
 * @param {object} db - Database connection
 * @param {array} uniqueCNPJs - Array of unique CNPJs to process
 */
async function processBatch(db, uniqueCNPJs) {
  for (const cnpj of uniqueCNPJs) {
    try {
      // Skip if already in suppliers table
      const existingSupplier = await db.get(
        `SELECT id FROM suppliers WHERE cnpj = ?`,
        [cnpj]
      );
      
      if (existingSupplier) {
        console.log(`CNPJ ${cnpj} already in suppliers table, skipping...`);
        continue;
      }
      
      // Fetch company data from Brasil API
      const companyData = await fetchCompanyData(cnpj);
      
      // Store data back in database if we got useful information
      if (companyData) {
        await db.run(
          `INSERT INTO suppliers (cnpj, name, founding_date, main_activity, address)
           VALUES (?, ?, ?, ?, ?)`,
          [
            cnpj,
            companyData.name || null,
            companyData.founding_date || null,
            companyData.main_activity || null,
            companyData.address || null
          ]
        );
        console.log(`Added supplier data for CNPJ ${cnpj} (${companyData.name || 'Unknown'})`);
      } else {
        // Add a record anyway to avoid reprocessing in the future
        await db.run(
          `INSERT INTO suppliers (cnpj) VALUES (?)`,
          [cnpj]
        );
        console.log(`Added empty record for CNPJ ${cnpj} (no data found)`);
      }
      
      // Wait to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    } catch (error) {
      console.error(`Error processing CNPJ ${cnpj}:`, error);
    }
  }
}

/**
 * Main function to read CNPJs and fetch company data
 */
async function main() {
  console.log('Starting CNPJ scraper...');
  
  // Connect to database
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  try {
    // Ensure suppliers table exists
    await ensureSuppliersTable(db);
    
    // Get all unique CNPJs from expenses
    const cnpjResult = await db.all(
      `SELECT DISTINCT supplier_id FROM expenses 
       WHERE supplier_id IS NOT NULL AND supplier_id != ''`
    );
    
    // Normalize and filter CNPJs
    const allCNPJs = cnpjResult
      .map(row => normalizeCNPJ(row.supplier_id))
      .filter(Boolean);
    
    // Get already processed CNPJs
    const processedResult = await db.all(
      `SELECT cnpj FROM suppliers`
    );
    
    const processedCNPJs = new Set(processedResult.map(row => row.cnpj));
    
    // Filter out already processed CNPJs
    const uniqueCNPJs = [...new Set(allCNPJs)].filter(cnpj => !processedCNPJs.has(cnpj));
    
    console.log(`Found ${uniqueCNPJs.length} unique CNPJs to process`);
    
    // Process in batches
    let processed = 0;
    
    for (let i = 0; i < uniqueCNPJs.length; i += BATCH_SIZE) {
      const batch = uniqueCNPJs.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch of ${batch.length} CNPJs...`);
      await processBatch(db, batch);
      
      processed += batch.length;
      console.log(`Progress: ${processed}/${uniqueCNPJs.length} (${Math.round(processed / uniqueCNPJs.length * 100)}%)`);
    }
    
    console.log('CNPJ scraper completed successfully');
  } catch (error) {
    console.error('Error in CNPJ scraper:', error);
  } finally {
    await db.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error in CNPJ scraper:', error);
  process.exit(1);
});