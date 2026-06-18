import 'dotenv/config'
import { backupTodayToSheets } from '../src/services/googleSheetsService.js'

console.log('Starting Google Sheets Backup test run...\n')
console.log('Checking environment variables:')
console.log(' - GOOGLE_SHEETS_SPREADSHEET_ID:', process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? 'SET' : 'NOT SET')
console.log(' - GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET')
console.log(' - GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET')
console.log('\nRunning backup function...')

try {
  await backupTodayToSheets()
  console.log('\nBackup process finished! Please check your Google Sheet to verify.')
} catch (err) {
  console.error('\n❌ Backup process failed with error:')
  console.error(err)
}
