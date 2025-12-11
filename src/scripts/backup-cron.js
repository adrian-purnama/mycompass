#!/usr/bin/env node

/**
 * Backup cron script
 * This script is called by system cron to check and execute due backups
 * It calls the API endpoint which handles the actual backup execution
 */

const CRON_API_KEY = process.env.CRON_API_KEY || 'change-this-in-production';
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function runBackupCron() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ===== CRON JOB STARTED =====`);
  console.log(`[${timestamp}] API_URL: ${API_URL}`);
  console.log(`[${timestamp}] CRON_API_KEY: ${CRON_API_KEY ? 'SET' : 'NOT SET'}`);
  
  try {
    console.log(`[${timestamp}] Calling: ${API_URL}/api/cron/backup`);
    const response = await fetch(`${API_URL}/api/cron/backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[${timestamp}] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${timestamp}] API returned error status ${response.status}: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();
    console.log(`[${timestamp}] API Response:`, JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`[${timestamp}] ✓ Backup cron executed: ${result.message}`);
      if (result.executed > 0) {
        console.log(`[${timestamp}]   - Executed: ${result.executed}`);
        console.log(`[${timestamp}]   - Failed: ${result.failed}`);
        console.log(`[${timestamp}]   - Total: ${result.total || 0}`);
      } else {
        console.log(`[${timestamp}] ℹ No backups were due to run`);
      }
    } else {
      console.error(`[${timestamp}] ✗ Backup cron error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[${timestamp}] ✗ Backup cron failed:`, error.message);
    console.error(`[${timestamp}] Error stack:`, error.stack);
    process.exit(1);
  }
  
  console.log(`[${timestamp}] ===== CRON JOB COMPLETED =====\n`);
}

// Run the cron job
runBackupCron();


