/**
 * Docker Command - Manage Docker-based OpenClaw installation
 * @module commands/docker
 */

import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import dockerManager from '../core/docker-manager.js';
import logger from '../core/logger.js';

/**
 * Execute docker command
 * @param {string} [action] - Action: install, status, start, stop, restart, logs, update, uninstall
 * @param {Object} options - Command options
 */
export async function dockerCommand(action, options = {}) {
  try {
    // If no action, show interactive menu
    if (!action) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'Docker management:',
        choices: [
          { name: 'Show container status', value: 'status' },
          { name: 'Install OpenClaw via Docker', value: 'install' },
          { name: 'Start container', value: 'start' },
          { name: 'Stop container', value: 'stop' },
          { name: 'Restart container', value: 'restart' },
          { name: 'View logs', value: 'logs' },
          { name: 'Update to latest image', value: 'update' },
          { name: 'Uninstall Docker setup', value: 'uninstall' },
          new inquirer.Separator(),
          { name: 'Cancel', value: 'cancel' },
        ],
      }]);

      if (choice === 'cancel') return;
      action = choice;
    }

    switch (action) {
      case 'status':
        await showDockerStatus();
        break;
      case 'install':
        await installDocker(options);
        break;
      case 'start':
        await dockerManager.start();
        console.log(chalk.green('  Container started'));
        break;
      case 'stop':
        await dockerManager.stop();
        console.log(chalk.green('  Container stopped'));
        break;
      case 'restart':
        await dockerManager.restart();
        console.log(chalk.green('  Container restarted'));
        break;
      case 'logs': {
        const logs = await dockerManager.getLogs({ lines: options.lines || 50 });
        console.log(logs);
        break;
      }
      case 'update':
        await dockerManager.update();
        console.log(chalk.green('  Container updated to latest'));
        break;
      case 'uninstall':
        await dockerManager.uninstall({ dryRun: options.dryRun });
        console.log(chalk.green('  Docker installation removed'));
        break;
      default:
        console.log(chalk.red(`  Unknown action: ${action}`));
        console.log(chalk.gray('  Actions: install, status, start, stop, restart, logs, update, uninstall'));
    }
  } catch (error) {
    logger.error('Docker command failed', error);
    console.log(chalk.red(`\nDocker command failed: ${error.message}`));
  }
}

/**
 * Show Docker container status
 */
async function showDockerStatus() {
  const dockerInstalled = await dockerManager.isDockerInstalled();

  if (!dockerInstalled) {
    console.log(chalk.yellow('  Docker is not installed'));
    console.log(chalk.gray('  Run: openclaw-easyset docker install'));
    return;
  }

  const running = await dockerManager.isDockerRunning();
  if (!running) {
    console.log(chalk.yellow('  Docker is installed but not running'));
    console.log(chalk.gray('  Start Docker Desktop first'));
    return;
  }

  const status = await dockerManager.getStatus();

  console.log(boxen([
    chalk.bold('Docker Status'),
    '',
    `Container: ${status.containerName}`,
    `Status: ${status.running ? chalk.green(status.status) : chalk.yellow(status.status)}`,
    `Installed: ${status.installed ? chalk.green('yes') : chalk.red('no')}`,
  ].join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
  }));
}

/**
 * Install OpenClaw via Docker
 * @param {Object} options - Options
 */
async function installDocker(options) {
  const dockerInstalled = await dockerManager.isDockerInstalled();

  if (!dockerInstalled) {
    console.log(chalk.yellow('  Docker not found. Installing Docker first...\n'));
    const installResult = await dockerManager.installDocker(options);

    if (!installResult.success) {
      console.log(chalk.red('  Docker installation failed'));
      if (installResult.instructions) {
        console.log(chalk.gray('\n  Manual installation steps:'));
        installResult.instructions.forEach(step => console.log(chalk.gray(`    ${step}`)));
      }
      return;
    }
  }

  const result = await dockerManager.install(options);
  if (result.success) {
    console.log(chalk.green('  OpenClaw Docker installation complete'));
    if (result.ports) {
      console.log(chalk.gray(`  Gateway: http://localhost:${result.ports.gateway}`));
      console.log(chalk.gray(`  Webchat: http://localhost:${result.ports.webchat}`));
    }
  }
}

export default dockerCommand;
