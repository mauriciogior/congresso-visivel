import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { slugify } from '../utils/slug.js';

// Migration to populate slug column in deputies table
export async function populateSlugColumn() {
  console.log('Running migration: Populate slug column in deputies table');
  
  try {
    // Open database connection
    const db = await open({
      filename: './src/deputies.db',
      driver: sqlite3.Database
    });
    
    // Get all deputies
    const deputies = await db.all(`SELECT id, name FROM deputies WHERE slug IS NULL OR slug = ''`);
    console.log(`Found ${deputies.length} deputies without slugs`);
    
    // Update each deputy with a slug
    let updateCount = 0;
    for (const deputy of deputies) {
      const slug = slugify(deputy.name);
      
      await db.run(`UPDATE deputies SET slug = ? WHERE id = ?`, [slug, deputy.id]);
      updateCount++;
      
      if (updateCount % 100 === 0) {
        console.log(`Updated ${updateCount} deputies with slugs`);
      }
    }
    
    console.log(`Updated ${updateCount} deputies with slugs`);
    
    // Create an index on the slug column for faster lookups
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_deputies_slug ON deputies(slug)`);
    console.log('Created index on slug column');
    
    // Close the database connection
    await db.close();
    console.log('Migration completed successfully');
    
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// Run migration if executed directly
if (process.argv[1].endsWith('02-populate-slug-column.js')) {
  populateSlugColumn().then(success => {
    process.exit(success ? 0 : 1);
  });
}