/**
 * Common Utilities Module
 * @module core/utils
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, accessSync, constants } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import logger from './logger.js';

const execAsync = promisify(exec);

/**
 * Execute shell command
 * @param {string} command - Command to execute
 * @param {Object} [options] - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>} Command output
 */
export async function executeCommand(command, options = {}) {
  try {
    logger.debug(`Executing command: ${command}`);
    const result = await execAsync(command, options);
    logger.debug(`Command completed successfully`);
    return result;
  } catch (error) {
    logger.error(`Command failed: ${command}`, error);
    throw error;
  }
}

/**
 * Check if command exists in PATH
 * @param {string} command - Command name
 * @returns {Promise<boolean>} True if command exists
 */
export async function commandExists(command) {
  try {
    const checkCmd = process.platform === 'win32' 
      ? `where ${command}` 
      : `which ${command}`;
    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get command version
 * @param {string} command - Command name
 * @param {string} [versionFlag='--version'] - Version flag
 * @returns {Promise<string|null>} Version string or null
 */
export async function getCommandVersion(command, versionFlag = '--version') {
  try {
    const { stdout } = await executeCommand(`${command} ${versionFlag}`);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Create a spinner with custom text
 * @param {string} text - Spinner text
 * @returns {Object} Ora spinner instance
 */
export function createSpinner(text) {
  return ora({
    text,
    spinner: 'dots',
  });
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @param {number} [decimals=2] - Decimal places
 * @returns {string} Formatted string
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if running as root/admin
 * @returns {boolean} True if running as root/admin
 */
export function isRoot() {
  if (process.platform === 'win32') {
    // Windows: check if elevated (requires additional logic)
    return false; // Simplified for now
  }
  return process.getuid && process.getuid() === 0;
}

/**
 * Parse semantic version string
 * @param {string} versionString - Version string (e.g., 'v1.2.3' or '1.2.3')
 * @returns {Object|null} Parsed version object or null
 */
export function parseVersion(versionString) {
  const match = versionString.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    raw: versionString,
  };
}

/**
 * Compare two version strings
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(version1, version2) {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (!v1 || !v2) return 0;

  if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
  if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
  if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;

  return 0;
}

/**
 * Check if directory is writable
 * @param {string} dirPath - Directory path
 * @returns {boolean} True if writable
 */
export function isWritable(dirPath) {
  try {
    if (!existsSync(dirPath)) return false;
    
    // Try to access with write permission
    accessSync(dirPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Print colored status message
 * @param {string} status - Status (success, error, warn, info)
 * @param {string} message - Message to print
 */
export function printStatus(status, message) {
  const symbols = {
    success: chalk.green('✓'),
    error: chalk.red('✗'),
    warn: chalk.yellow('⚠'),
    info: chalk.blue('ℹ'),
  };

  const symbol = symbols[status] || symbols.info;
  console.log(`${symbol} ${message}`);
}

/**
 * Create a table from array of objects
 * @param {Array<Object>} data - Array of objects
 * @param {Array<string>} [columns] - Column names to display
 * @returns {string} Formatted table
 */
export function createTable(data, columns = null) {
  if (!data || data.length === 0) return '';

  const cols = columns || Object.keys(data[0]);
  const rows = data.map(item => cols.map(col => String(item[col] || '')));

  // Calculate column widths
  const widths = cols.map((col, i) => {
    const colWidth = col.length;
    const dataWidth = Math.max(...rows.map(row => row[i].length));
    return Math.max(colWidth, dataWidth);
  });

  // Create header
  const header = cols.map((col, i) => col.padEnd(widths[i])).join(' │ ');
  const separator = widths.map(w => '─'.repeat(w)).join('─┼─');

  // Create rows
  const tableRows = rows.map(row =>
    row.map((cell, i) => cell.padEnd(widths[i])).join(' │ ')
  );

  return [header, separator, ...tableRows].join('\n');
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL string
 * @returns {boolean} True if valid
 */
export function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string for filename
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

/**
 * Retry async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} [maxAttempts=3] - Maximum retry attempts
 * @param {number} [delayMs=1000] - Initial delay in milliseconds
 * @returns {Promise<*>} Function result
 */
export async function retry(fn, maxAttempts = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        const wait = delayMs * Math.pow(2, attempt - 1);
        logger.debug(`Retrying in ${wait}ms...`);
        await sleep(wait);
      }
    }
  }

  throw lastError;
}
