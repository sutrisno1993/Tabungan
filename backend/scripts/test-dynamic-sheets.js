import 'dotenv/config'
import { pool } from '../src/db/pool.js'
import { backupTodayToSheets } from '../src/services/googleSheetsService.js'

async function runTest() {
  console.log('--- Starting Dynamic Google Sheets ID Test ---')

  try {
    // 1. Fetch current spreadsheet ID from DB
    console.log('\n1. Fetching current spreadsheet ID from database settings...')
    const fetchResult = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'google_sheets_spreadsheet_id'`
    )
    const currentId = fetchResult.rows[0]?.value
    console.log('👉 Spreadsheet ID in DB:', currentId)

    if (!currentId) {
      throw new Error('No spreadsheet ID found in database!')
    }

    // 2. Trigger sheets backup to confirm it executes with the database spreadsheet ID
    console.log('\n2. Running backupTodayToSheets() to test integration...')
    const backupResult = await backupTodayToSheets('TEST')
    console.log('✅ Backup result:', backupResult)

    // 3. Test saving a new ID to DB
    const testNewId = '1cQEme1JWa4O0kj5U4JgyFBevFvqWj9S39a6NuY1D9r4' // Let's keep it the same to keep the real sheet working
    console.log(`\n3. Saving spreadsheet ID to database: ${testNewId}...`)
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('google_sheets_spreadsheet_id', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [testNewId]
    )
    console.log('✅ Spreadsheet ID successfully updated/verified in database!')

  } catch (err) {
    console.error('\n❌ Test failed with error:')
    console.error(err)
  }
}

runTest()
