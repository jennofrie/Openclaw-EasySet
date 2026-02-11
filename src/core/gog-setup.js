/**
 * GOG Setup Module
 * Handles gog CLI installation verification and authentication
 * @module core/gog-setup
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { commandExists, getCommandVersion, executeCommand, createSpinner } from './utils.js';
import { executeInteractiveCommand } from './utils.js';
import logger from './logger.js';

/**
 * GOG Setup Manager
 */
class GogSetup {
  /**
   * Check if gog CLI is installed
   * @returns {Promise<boolean>}
   */
  async isInstalled() {
    return commandExists('gog');
  }

  /**
   * Get gog CLI version
   * @returns {Promise<string|null>}
   */
  async getVersion() {
    return getCommandVersion('gog');
  }

  /**
   * Check authentication status by parsing `gog auth status` output
   * @returns {Promise<{authenticated: boolean, account: string|null}>}
   */
  async checkAuthStatus() {
    try {
      const { stdout } = await executeCommand('gog auth status');
      const output = stdout.toLowerCase();

      // Check for authenticated state in output
      const authenticated = output.includes('logged in') ||
        output.includes('authenticated') ||
        output.includes('active');

      // Try to extract account/email
      const accountMatch = stdout.match(/account:\s*(.+)/i) ||
        stdout.match(/email:\s*(.+)/i) ||
        stdout.match(/user:\s*(.+)/i);

      return {
        authenticated,
        account: accountMatch ? accountMatch[1].trim() : null,
        raw: stdout.trim(),
      };
    } catch {
      return { authenticated: false, account: null, raw: '' };
    }
  }

  /**
   * Test connection by running a simple gog command
   * @returns {Promise<{connected: boolean, message: string}>}
   */
  async testConnection() {
    try {
      const { stdout } = await executeCommand('gog gmail labels list');
      return {
        connected: true,
        message: 'Successfully connected to Google Workspace',
      };
    } catch (error) {
      return {
        connected: false,
        message: `Connection test failed: ${error.message}`,
      };
    }
  }

  /**
   * Prompt user to authenticate with gog
   * Uses interactive spawn for OAuth flow
   * @returns {Promise<boolean>} True if auth succeeded
   */
  async promptAuth() {
    console.log(chalk.blue('\n  This will open a browser for Google OAuth authentication.'));
    console.log(chalk.gray('  Follow the prompts in your browser to authorize access.\n'));

    try {
      await executeInteractiveCommand('gog auth login');

      // Verify auth succeeded
      const status = await this.checkAuthStatus();
      return status.authenticated;
    } catch (error) {
      logger.error('Authentication failed', error);
      return false;
    }
  }

  /**
   * Run the full gog setup flow
   * @param {Object} platformInfo - Platform detection info
   * @param {Object} options - CLI options (--yes, --dry-run)
   * @returns {Promise<Object>} Setup result
   */
  async runSetup(platformInfo, options = {}) {
    const result = { status: 'skipped', steps: [] };

    console.log(chalk.bold('\n  Google Workspace (gog) CLI Setup'));

    // Step 1: Check if installed
    const installed = await this.isInstalled();

    if (installed) {
      const version = await this.getVersion();
      console.log(chalk.green(`    gog CLI installed: ${version || 'version unknown'}`));
      result.steps.push({ step: 'check-installed', status: 'found' });
    } else {
      console.log(chalk.yellow('    gog CLI not found'));
      result.steps.push({ step: 'check-installed', status: 'not-found' });

      if (options.dryRun) {
        console.log(chalk.gray('    [dry-run] Would offer to install gog'));
        result.status = 'dry-run';
        return result;
      }

      // Offer to install via brew if available
      const hasBrew = platformInfo?.packageManagers?.brew;

      if (hasBrew) {
        let installGog = options.yes;

        if (!options.yes) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Install gog CLI via Homebrew?',
            default: true,
          }]);
          installGog = confirm;
        }

        if (installGog) {
          const spinner = createSpinner('Installing gog CLI...');
          spinner.start();

          try {
            await executeCommand('brew install gog');
            spinner.succeed('gog CLI installed successfully');
            result.steps.push({ step: 'install', status: 'success' });
          } catch (error) {
            spinner.fail('Failed to install gog CLI');
            logger.error('gog install failed', error);
            result.steps.push({ step: 'install', status: 'failed', error: error.message });
            result.status = 'partial';
            return result;
          }
        } else {
          console.log(chalk.gray('    Skipping gog installation'));
          result.status = 'skipped';
          return result;
        }
      } else {
        console.log(chalk.yellow('    Homebrew not available. Install gog manually:'));
        console.log(chalk.cyan('    https://github.com/pterm/gog#installation'));
        result.status = 'manual-required';
        return result;
      }
    }

    // Step 2: Check authentication
    console.log(chalk.gray('\n    Checking authentication status...'));
    const authStatus = await this.checkAuthStatus();

    if (authStatus.authenticated) {
      console.log(chalk.green(`    Authenticated${authStatus.account ? ` as ${authStatus.account}` : ''}`));
      result.steps.push({ step: 'auth', status: 'authenticated' });
    } else {
      console.log(chalk.yellow('    Not authenticated'));
      result.steps.push({ step: 'auth', status: 'not-authenticated' });

      if (options.dryRun) {
        console.log(chalk.gray('    [dry-run] Would prompt for authentication'));
        result.status = 'dry-run';
        return result;
      }

      let doAuth = options.yes;

      if (!options.yes) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Authenticate with Google now?',
          default: true,
        }]);
        doAuth = confirm;
      }

      if (doAuth) {
        const authSuccess = await this.promptAuth();
        if (authSuccess) {
          console.log(chalk.green('    Authentication successful'));
          result.steps.push({ step: 'auth-login', status: 'success' });
        } else {
          console.log(chalk.yellow('    Authentication failed or was cancelled'));
          result.steps.push({ step: 'auth-login', status: 'failed' });
          result.status = 'partial';
          return result;
        }
      } else {
        console.log(chalk.gray('    Skipping authentication'));
        result.status = 'partial';
        return result;
      }
    }

    // Step 3: Test connection
    if (options.dryRun) {
      console.log(chalk.gray('    [dry-run] Would test connection'));
      result.status = 'dry-run';
      return result;
    }

    console.log(chalk.gray('\n    Testing connection...'));
    const connTest = await this.testConnection();

    if (connTest.connected) {
      console.log(chalk.green(`    ${connTest.message}`));
      result.steps.push({ step: 'connection-test', status: 'success' });
    } else {
      console.log(chalk.yellow(`    ${connTest.message}`));
      result.steps.push({ step: 'connection-test', status: 'failed' });
    }

    result.status = 'complete';
    return result;
  }
}

export default new GogSetup();
