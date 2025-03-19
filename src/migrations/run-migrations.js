import { addSlugColumn } from './01-add-slug-column.js';
import { populateSlugColumn } from './02-populate-slug-column.js';

async function runMigrations() {
  console.log('Starting migrations...');
  
  // Run migrations in sequence
  const migrations = [
    { name: 'Add slug column', fn: addSlugColumn },
    { name: 'Populate slug column', fn: populateSlugColumn }
  ];
  
  for (const migration of migrations) {
    console.log(`\nRunning migration: ${migration.name}`);
    const success = await migration.fn();
    
    if (!success) {
      console.error(`Migration '${migration.name}' failed. Stopping.`);
      process.exit(1);
    }
    
    console.log(`Migration '${migration.name}' completed successfully.`);
  }
  
  console.log('\nAll migrations completed successfully!');
}

runMigrations().catch(error => {
  console.error('Migration error:', error);
  process.exit(1);
});