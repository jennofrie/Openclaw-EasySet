/**
 * Backup Command - Create, list, and restore OpenClaw config backups
 * @module commands/backup
 */

import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import backupManager from '../core/backup-manager.js';
import logger from '../core/logger.js';

/**
 * Execute backup command
 * @param {string} [action] - Action: create, list, restore
 * @param {Object} options - Command options
 */
export async function backupCommand(action, options) {
  try {
    console.log(boxen(chalk.bold.blue('OpenClaw EasySet - Backup Manager'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
    }));

    // If no action, show interactive menu
    if (!action) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create a new backup', value: 'create' },
          { name: 'List existing backups', value: 'list' },
          { name: 'Restore a backup', value: 'restore' },
          new inquirer.Separator(),
          { name: 'Cancel', value: 'cancel' },
        ],
      }]);

      if (choice === 'cancel') return;
      action = choice;
    }

    if (action === 'create') {
      const label = options.label || null;
      const result = backupManager.createBackup(label);

      if (result.success) {
        console.log(chalk.green(`\n  Backup saved: ${result.name}`));
        console.log(chalk.gray(`  Path: ${result.path}`));
      }

    } else if (action === 'list') {
      backupManager.printBackupList();

    } else if (action === 'restore') {
      const backups = backupManager.listBackups();

      if (backups.length === 0) {
        console.log(chalk.yellow('\n  No backups available'));
        return;
      }

      let backupName = options.name;

      if (!backupName) {
        const { selected } = await inquirer.prompt([{
          type: 'list',
          name: 'selected',
          message: 'Select backup to restore:',
          choices: backups.map(b => ({
            name: `${b.name}${b.label ? ` [${b.label}]` : ''} (${b.files} files, ${b.sizeFormatted})`,
            value: b.name,
          })),
        }]);
        backupName = selected;
      }

      // Confirm restore
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Restore from "${backupName}"? A safety backup of current config will be created first.`,
        default: false,
      }]);

      if (!confirm) {
        console.log(chalk.gray('  Restore cancelled'));
        return;
      }

      const result = backupManager.restoreBackup(backupName);
      if (result.success) {
        console.log(chalk.green(`\n  Restored ${result.restored} files`));
        console.log(chalk.gray('  Restart OpenClaw services for changes to take effect'));
      }

    } else {
      console.log(chalk.red(`  Unknown action: ${action}`));
      console.log(chalk.gray('  Valid actions: create, list, restore'));
    }

  } catch (error) {
    logger.error('Backup operation failed', error);
    console.log(chalk.red(`\nBackup operation failed: ${error.message}`));
  }
}
