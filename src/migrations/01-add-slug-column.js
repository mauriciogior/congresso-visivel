import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { slugify } from '../utils/slug.js';

// Migration to add slug column to deputies table
export async function addSlugColumn() {
  console.log('Running migration: Add slug column to deputies table');
  
  try {
    // Open database connection
    const db = await open({
      filename: './src/deputies.db',
      driver: sqlite3.Database
    });
    
    // Check if the column already exists
    const tableInfo = await db.all(`PRAGMA table_info(deputies)`);
    const slugColumnExists = tableInfo.some(column => column.name === 'slug');
    
    if (!slugColumnExists) {
      // Add slug column to deputies table
      await db.exec(`ALTER TABLE deputies ADD COLUMN slug TEXT`);
      console.log('Added slug column to deputies table');
    } else {
      console.log('Slug column already exists in deputies table');
    }
    
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
if (process.argv[1].endsWith('01-add-slug-column.js')) {
  addSlugColumn().then(success => {
    process.exit(success ? 0 : 1);
  });
}