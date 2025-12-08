#!/usr/bin/env node

/**
 * Backup cron script
 * This script is called by system cron to check and execute due backups
 * It calls the API endpoint which handles the actual backup execution
 */

const CRON_API_KEY = process.env.CRON_API_KEY || 'change-this-in-production';
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function runBackupCron() {
  try {
    const response = await fetch(`${API_URL}/api/cron/backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (result.success) {
      console.log(`[${new Date().toISOString()}] Backup cron executed: ${result.message}`);
      if (result.executed > 0) {
        console.log(`  - Executed: ${result.executed}`);
        console.log(`  - Failed: ${result.failed}`);
      }
    } else {
      console.error(`[${new Date().toISOString()}] Backup cron error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Backup cron failed:`, error.message);
    process.exit(1);
  }
}

// Run the cron job
runBackupCron();


