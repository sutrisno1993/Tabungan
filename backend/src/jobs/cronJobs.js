import cron from 'node-cron'
import { backupTodayToSheets } from '../services/googleSheetsService.js'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5 * 60 * 1000 // 5 minutes

async function runWithRetry(fn, name, attempt = 1) {
  try {
    await fn()
    console.log(`[Cron] ${name} completed successfully`)
  } catch (err) {
    console.error(`[Cron] ${name} failed (attempt ${attempt}/${MAX_RETRIES}):`, err.message)
    if (attempt < MAX_RETRIES) {
      console.log(`[Cron] Retrying ${name} in ${RETRY_DELAY_MS / 60000} minutes...`)
      setTimeout(() => runWithRetry(fn, name, attempt + 1), RETRY_DELAY_MS)
    } else {
      console.error(`[Cron] ${name} failed after ${MAX_RETRIES} attempts. Manual intervention required.`)
    }
  }
}

export function startCronJobs() {
  // Daily backup to Google Sheets at 16:00 WIB
  cron.schedule('0 16 * * *', () => {
    console.log('[Cron] Starting daily Google Sheets backup...')
    runWithRetry(backupTodayToSheets, 'Google Sheets Backup')
  }, {
    timezone: 'Asia/Jakarta',
  })

  console.log('[Cron] Scheduled: Daily backup at 16:00 WIB')
}
