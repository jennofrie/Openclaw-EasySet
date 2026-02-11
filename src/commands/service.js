/**
 * Service Command - Manage OpenClaw system service (launchd/systemd/task scheduler)
 * @module commands/service
 */

import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import crossPlatformServiceManager from '../services/service-manager.js';
import logger from '../core/logger.js';

/**
 * Execute service command
 * @param {string} [action] - Action: install, uninstall, start, stop, restart, status
 * @param {Object} options - Command options
 */
export async function serviceCommand(action, options = {}) {
  try {
    // If no action, show interactive menu
    if (!action) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'Service management:',
        choices: [
          { name: 'Show service status', value: 'status' },
          { name: 'Install as system service', value: 'install' },
          { name: 'Start service', value: 'start' },
          { name: 'Stop service', value: 'stop' },
          { name: 'Restart service', value: 'restart' },
          { name: 'Uninstall system service', value: 'uninstall' },
          new inquirer.Separator(),
          { name: 'Cancel', value: 'cancel' },
        ],
      }]);

      if (choice === 'cancel') return;
      action = choice;
    }

    switch (action) {
      case 'status':
        await showServiceStatus();
        break;
      case 'install':
        await installService(options);
        break;
      case 'start':
        await crossPlatformServiceManager.start();
        console.log(chalk.green('  Service started'));
        break;
      case 'stop':
        await crossPlatformServiceManager.stop();
        console.log(chalk.green('  Service stopped'));
        break;
      case 'restart':
        await crossPlatformServiceManager.restart();
        console.log(chalk.green('  Service restarted'));
        break;
      case 'uninstall':
        await crossPlatformServiceManager.uninstall({ dryRun: options.dryRun });
        console.log(chalk.green('  Service uninstalled'));
        break;
      default:
        console.log(chalk.red(`  Unknown action: ${action}`));
        console.log(chalk.gray('  Actions: install, status, start, stop, restart, uninstall'));
    }
  } catch (error) {
    logger.error('Service command failed', error);
    console.log(chalk.red(`\nService command failed: ${error.message}`));
  }
}

/**
 * Show service status
 */
async function showServiceStatus() {
  const status = await crossPlatformServiceManager.getStatus();
  const paths = crossPlatformServiceManager.getServicePaths();

  console.log(boxen([
    chalk.bold('Service Status'),
    '',
    `Type: ${paths.type}`,
    `Installed: ${status.installed ? chalk.green('yes') : chalk.red('no')}`,
    `Running: ${status.running ? chalk.green('yes') : chalk.yellow('no')}`,
  ].join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
  }));
}

/**
 * Install system service
 * @param {Object} options - Options
 */
async function installService(options) {
  const paths = crossPlatformServiceManager.getServicePaths();

  console.log(chalk.bold(`\n  Installing OpenClaw as ${paths.type} service...\n`));

  const result = await crossPlatformServiceManager.install({ dryRun: options.dryRun });

  if (result.success) {
    console.log(chalk.green(`  Service installed (${result.type || paths.type})`));
    console.log(chalk.gray('  The gateway will start automatically on login'));
  }
}

export default serviceCommand;
