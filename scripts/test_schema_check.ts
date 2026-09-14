import { kdb } from "./src/backend/infrastructure/db";

async function main() {
  try {
    // Get columns
    const cols = await kdb.raw(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'laundry_settings'
    `);
    console.log('laundry_settings columns:', JSON.stringify(cols, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}
main();
