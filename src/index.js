#!/usr/bin/env node

/**
 * OpenClaw EasySet - Main CLI Entry Point
 * @module index
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { detectCommand } from './commands/detect.js';
import { installCommand } from './commands/install.js';
import { configureCommand } from './commands/configure.js';
import { doctorCommand } from './commands/doctor.js';
import { statusCommand } from './commands/status.js';
import { backupCommand } from './commands/backup.js';
import logger from './core/logger.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('openclaw-easyset')
  .description('Automated OpenClaw setup and configuration tool')
  .version(packageJson.version, '-v, --version', 'Output the version number')
  .option('--verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug logging')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      logger.setLevel('debug');
    } else if (opts.verbose) {
      logger.setLevel('verbose');
    }
  });

// Detect command
program
  .command('detect')
  .description('Detect platform and system capabilities')
  .option('-r, --recommendations', 'Show installation recommendations')
  .option('--json', 'Output as JSON')
  .action(detectCommand);

// Install command
program
  .command('install')
  .description('Install and configure OpenClaw with guided wizard')
  .option('-m, --mode <type>', 'Installation mode (native|docker|auto)', 'auto')
  .option('--dry-run', 'Simulate installation without making changes')
  .option('--yes', 'Accept all defaults')
  .action(installCommand);

// Configure command
program
  .command('configure [section]')
  .description('Configure OpenClaw settings (sections: plugins, skills, gog)')
  .option('--dry-run', 'Simulate changes without writing')
  .option('--yes', 'Accept all defaults')
  .action(configureCommand);

// Doctor command
program
  .command('doctor')
  .description('Run comprehensive health checks and diagnostics')
  .option('--fix', 'Auto-fix common issues')
  .option('--json', 'Output results as JSON')
  .action(doctorCommand);

// Status command
program
  .command('status')
  .description('Show OpenClaw status dashboard')
  .option('-d, --detailed', 'Show detailed status including tools')
  .option('--json', 'Output as JSON')
  .action(statusCommand);

// Backup command
program
  .command('backup [action]')
  .description('Manage config backups (actions: create, list, restore)')
  .option('-l, --label <label>', 'Label for the backup')
  .option('-n, --name <name>', 'Backup name (for restore)')
  .action(backupCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
