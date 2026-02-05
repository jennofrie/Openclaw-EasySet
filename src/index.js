#!/usr/bin/env node

/**
 * OpenClaw EasySet - Main CLI Entry Point
 * @module index
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { detectCommand } from './commands/detect.js';
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

// Install command (placeholder for Phase 2)
program
  .command('install')
  .description('Install and configure OpenClaw')
  .option('-m, --mode <type>', 'Installation mode (native|docker|auto)', 'auto')
  .option('--dry-run', 'Simulate installation without making changes')
  .option('--yes', 'Accept all defaults')
  .action(() => {
    console.log(chalk.yellow('⚠️  Install command coming in Phase 2'));
    console.log('Run', chalk.cyan('openclaw-easyset detect'), 'to check your system');
  });

// Configure command (placeholder)
program
  .command('configure')
  .description('Configure OpenClaw settings')
  .action(() => {
    console.log(chalk.yellow('⚠️  Configure command coming in Phase 2'));
  });

// Doctor command (placeholder)
program
  .command('doctor')
  .description('Check installation health')
  .action(() => {
    console.log(chalk.yellow('⚠️  Doctor command coming in Phase 3'));
  });

// Status command (placeholder)
program
  .command('status')
  .description('Check OpenClaw status')
  .action(() => {
    console.log(chalk.yellow('⚠️  Status command coming in Phase 2'));
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
