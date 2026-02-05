/**
 * Logger Module - Winston-based logging system for OpenClaw EasySet
 * @module core/logger
 */

import winston from 'winston';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.openclaw-easyset', 'logs');

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Custom format for console output with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => {
    const coloredLevel = {
      error: chalk.red.bold('ERROR'),
      warn: chalk.yellow.bold('WARN'),
      info: chalk.blue.bold('INFO'),
      debug: chalk.gray('DEBUG'),
      verbose: chalk.cyan('VERBOSE'),
    }[level] || level;

    return `${chalk.gray(timestamp)} ${coloredLevel} ${message}`;
  })
);

/**
 * Custom format for file output (JSON)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File output - all logs
    new winston.transports.File({
      filename: join(LOG_DIR, 'easyset.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File output - errors only
    new winston.transports.File({
      filename: join(LOG_DIR, 'easyset-error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

/**
 * Enhanced logger with additional utility methods
 */
class Logger {
  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  info(message, meta = {}) {
    logger.info(message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Error} [error] - Error object
   */
  error(message, error = null) {
    if (error) {
      logger.error(message, { 
        error: error.message, 
        stack: error.stack 
      });
    } else {
      logger.error(message);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   */
  warn(message) {
    logger.warn(message);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} [data] - Debug data
   */
  debug(message, data = null) {
    if (data) {
      logger.debug(message, { data });
    } else {
      logger.debug(message);
    }
  }

  /**
   * Log verbose message
   * @param {string} message - Verbose message
   */
  verbose(message) {
    logger.verbose(message);
  }

  /**
   * Log success message (info level with green color)
   * @param {string} message - Success message
   */
  success(message) {
    console.log(chalk.green('✓'), message);
    logger.info(`[SUCCESS] ${message}`);
  }

  /**
   * Set log level dynamically
   * @param {string} level - Log level (error, warn, info, debug, verbose)
   */
  setLevel(level) {
    logger.level = level;
  }

  /**
   * Get log directory path
   * @returns {string} Log directory path
   */
  getLogDir() {
    return LOG_DIR;
  }
}

export default new Logger();
