#!/usr/bin/env tsx
/**
 * Cron Job Script for Reminder Processing
 * 
 * This script can be run via cron to process pending reminders automatically.
 * 
 * Usage:
 *   - Add to crontab: `0 * * * * cd /path/to/sumtise && npm run cron:reminders`
 *   - Or run manually: `tsx scripts/cron-reminders.ts`
 * 
 * Environment Variables:
 *   - REMINDER_JOB_TOKEN: Optional token for API authentication
 *   - API_URL: Base URL for API (default: http://localhost:3000)
 */

import { processAllReminders } from '../src/lib/jobs/reminder-scheduler'

const API_URL = process.env.API_URL || 'http://localhost:3000'
const REMINDER_JOB_TOKEN = process.env.REMINDER_JOB_TOKEN

async function main() {
  console.log(`[${new Date().toISOString()}] Starting reminder processing...`)

  try {
    // Option 1: Call API endpoint (if running as separate service)
    if (API_URL && API_URL !== 'http://localhost:3000') {
      const response = await fetch(`${API_URL}/api/jobs/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(REMINDER_JOB_TOKEN && { Authorization: `Bearer ${REMINDER_JOB_TOKEN}` }),
        },
        body: JSON.stringify({
          maxReminders: 100,
          throttleDelay: 1000,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log(`[${new Date().toISOString()}] Reminder processing completed:`, result.results)
      return
    }

    // Option 2: Direct function call (if running in same process)
    const results = await processAllReminders(100, 1000)
    console.log(`[${new Date().toISOString()}] Reminder processing completed:`, results)
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Reminder processing failed:`, error.message)
    
    if (error.message?.includes('already running')) {
      console.log('Another reminder processor is already running. Exiting.')
      process.exit(0) // Not an error - just skip this run
    } else {
      process.exit(1) // Error - exit with failure
    }
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { main }




