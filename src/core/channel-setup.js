/**
 * Channel Setup Module
 * Guides users through configuring OpenClaw communication channels
 * Supports: Telegram, iMessage, Gmail Pub/Sub, Webchat
 * @module core/channel-setup
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { commandExists, executeCommand, createSpinner } from './utils.js';
import logger from './logger.js';

const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json');

/**
 * Channel definitions with setup requirements
 */
const CHANNELS = {
  telegram: {
    name: 'Telegram',
    description: 'Bot-based messaging via Telegram @BotFather',
    configKey: 'telegram',
    required: ['botToken', 'chatId'],
  },
  imessage: {
    name: 'iMessage',
    description: 'macOS iMessage/SMS via imsg CLI',
    configKey: 'imessage',
    platforms: ['darwin'],
    requires: { bins: ['imsg'] },
  },
  gmail: {
    name: 'Gmail Pub/Sub',
    description: 'Email monitoring via gog CLI with Google Pub/Sub',
    configKey: 'gmail',
    requires: { bins: ['gog'] },
  },
  webchat: {
    name: 'Webchat',
    description: 'Browser-based chat interface on local port',
    configKey: 'webchat',
  },
};

/**
 * Channel Setup Class
 */
class ChannelSetup {
  /**
   * Load the OpenClaw config
   * @returns {Object|null} Parsed config or null
   */
  loadConfig() {
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        return JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'));
      }
    } catch (error) {
      logger.warn(`Failed to load config: ${error.message}`);
    }
    return null;
  }

  /**
   * Save config back to disk
   * @param {Object} config - Config to save
   */
  saveConfig(config) {
    writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Get currently configured channels from openclaw.json
   * @returns {Object} Map of channel name to config
   */
  getConfiguredChannels() {
    const config = this.loadConfig();
    if (!config?.channels) return {};

    const result = {};
    const channels = config.channels;

    if (channels.telegram?.botToken) {
      result.telegram = {
        configured: true,
        botToken: channels.telegram.botToken ? '***configured***' : null,
        chatId: channels.telegram.chatId || null,
      };
    }
    if (channels.imessage?.enabled !== undefined) {
      result.imessage = {
        configured: true,
        enabled: channels.imessage.enabled,
      };
    }
    if (channels.gmail?.enabled !== undefined || channels.gmail?.watchEnabled !== undefined) {
      result.gmail = {
        configured: true,
        watchEnabled: channels.gmail.watchEnabled || channels.gmail.enabled || false,
      };
    }
    if (channels.webchat?.enabled !== undefined) {
      result.webchat = {
        configured: true,
        enabled: channels.webchat.enabled,
        port: channels.webchat.port || 3000,
      };
    }

    return result;
  }

  /**
   * Print channel status summary
   */
  printChannelStatus() {
    const configured = this.getConfiguredChannels();
    const currentPlatform = platform();

    console.log(chalk.bold('\n  Channel Status:\n'));

    for (const [key, channel] of Object.entries(CHANNELS)) {
      // Skip platform-restricted channels
      if (channel.platforms && !channel.platforms.includes(currentPlatform)) {
        console.log(chalk.gray(`    ${channel.name}: not available on ${currentPlatform}`));
        continue;
      }

      const status = configured[key];
      if (status?.configured) {
        console.log(chalk.green(`    ${channel.name}: configured`));
      } else {
        console.log(chalk.yellow(`    ${channel.name}: not configured`));
      }
    }
    console.log('');
  }

  /**
   * Run the interactive channel setup wizard
   * @param {Object} options - Options (yes, dryRun)
   * @returns {Promise<Object>} Setup result
   */
  async runSetup(options = {}) {
    const result = { configured: [], skipped: [], errors: [] };
    const configured = this.getConfiguredChannels();
    const currentPlatform = platform();

    this.printChannelStatus();

    // Filter available channels for this platform
    const available = Object.entries(CHANNELS).filter(([, ch]) => {
      return !ch.platforms || ch.platforms.includes(currentPlatform);
    });

    if (options.dryRun) {
      console.log(chalk.gray('  [dry-run] Would prompt for channel configuration'));
      return result;
    }

    // Build channel choices
    const choices = available.map(([key, ch]) => {
      const status = configured[key]?.configured
        ? chalk.green(' (configured)')
        : chalk.yellow(' (not configured)');
      return {
        name: `${ch.name}${status} - ${ch.description}`,
        value: key,
        checked: !configured[key]?.configured,
      };
    });

    if (options.yes) {
      // Auto-configure unconfigured channels where possible
      for (const [key] of available) {
        if (!configured[key]?.configured) {
          result.skipped.push(key);
        }
      }
      console.log(chalk.gray('  Skipping interactive channel setup (--yes mode)'));
      console.log(chalk.gray('  Run "openclaw-easyset configure channels" to set up channels'));
      return result;
    }

    const { selectedChannels } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedChannels',
      message: 'Which channels do you want to configure?',
      choices,
      pageSize: 10,
    }]);

    if (selectedChannels.length === 0) {
      console.log(chalk.gray('  No channels selected'));
      return result;
    }

    for (const channelKey of selectedChannels) {
      try {
        const setupResult = await this.setupChannel(channelKey, options);
        if (setupResult.configured) {
          result.configured.push(channelKey);
        } else {
          result.skipped.push(channelKey);
        }
      } catch (error) {
        logger.warn(`Channel ${channelKey} setup failed: ${error.message}`);
        result.errors.push({ channel: channelKey, error: error.message });
      }
    }

    return result;
  }

  /**
   * Set up a specific channel
   * @param {string} channelKey - Channel identifier
   * @param {Object} options - Options
   * @returns {Promise<Object>} Setup result
   */
  async setupChannel(channelKey, options = {}) {
    switch (channelKey) {
      case 'telegram':
        return await this.setupTelegram(options);
      case 'imessage':
        return await this.setupIMessage(options);
      case 'gmail':
        return await this.setupGmail(options);
      case 'webchat':
        return await this.setupWebchat(options);
      default:
        return { configured: false, reason: 'unknown channel' };
    }
  }

  /**
   * Setup Telegram bot channel
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async setupTelegram(options = {}) {
    console.log(chalk.bold('\n  Telegram Bot Setup\n'));
    console.log(chalk.gray('  To create a Telegram bot:'));
    console.log(chalk.gray('  1. Open Telegram and message @BotFather'));
    console.log(chalk.gray('  2. Send /newbot and follow the prompts'));
    console.log(chalk.gray('  3. Copy the bot token (format: 123456:ABC-DEF...)'));
    console.log(chalk.gray('  4. Message your bot, then get your chat ID from:'));
    console.log(chalk.gray('     https://api.telegram.org/bot<TOKEN>/getUpdates\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'botToken',
        message: 'Telegram Bot Token:',
        validate: (input) => {
          if (!input.trim()) return 'Bot token is required';
          if (!/^\d+:.+$/.test(input.trim())) return 'Invalid token format (expected: 123456:ABC-DEF...)';
          return true;
        },
      },
      {
        type: 'input',
        name: 'chatId',
        message: 'Chat ID (your Telegram user/group ID):',
        validate: (input) => {
          if (!input.trim()) return 'Chat ID is required';
          if (!/^-?\d+$/.test(input.trim())) return 'Chat ID must be a number';
          return true;
        },
      },
    ]);

    if (options.dryRun) {
      console.log(chalk.gray('  [dry-run] Would save Telegram config'));
      return { configured: true, simulated: true };
    }

    const config = this.loadConfig() || {};
    if (!config.channels) config.channels = {};

    config.channels.telegram = {
      ...config.channels.telegram,
      botToken: answers.botToken.trim(),
      chatId: answers.chatId.trim(),
      enabled: true,
    };

    this.saveConfig(config);
    console.log(chalk.green('  Telegram channel configured'));
    return { configured: true };
  }

  /**
   * Setup iMessage channel
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async setupIMessage(options = {}) {
    console.log(chalk.bold('\n  iMessage Setup\n'));

    // Check imsg CLI
    const hasImsg = await commandExists('imsg');
    if (!hasImsg) {
      console.log(chalk.yellow('  imsg CLI not found.'));
      console.log(chalk.gray('  Install it via: brew install openclaw/tap/imsg'));

      const { installImsg } = await inquirer.prompt([{
        type: 'confirm',
        name: 'installImsg',
        message: 'Install imsg now?',
        default: true,
      }]);

      if (installImsg && !options.dryRun) {
        const hasBrew = await commandExists('brew');
        if (hasBrew) {
          const spinner = createSpinner('Installing imsg...');
          spinner.start();
          try {
            await executeCommand('brew install openclaw/tap/imsg');
            spinner.succeed('imsg installed');
          } catch (error) {
            spinner.fail(`imsg installation failed: ${error.message}`);
            return { configured: false, reason: 'imsg install failed' };
          }
        } else {
          console.log(chalk.red('  Homebrew not found. Please install imsg manually.'));
          return { configured: false, reason: 'no brew' };
        }
      } else if (!installImsg) {
        return { configured: false, reason: 'user declined' };
      }
    }

    console.log(chalk.gray('  iMessage requires Full Disk Access for the terminal app.'));
    console.log(chalk.gray('  Go to: System Settings > Privacy & Security > Full Disk Access'));
    console.log(chalk.gray('  Enable access for Terminal.app (or iTerm2)\n'));

    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Have you granted Full Disk Access?',
      default: false,
    }]);

    if (!confirmed) {
      console.log(chalk.yellow('  iMessage setup deferred - grant Full Disk Access and try again'));
      return { configured: false, reason: 'permissions not granted' };
    }

    if (options.dryRun) {
      console.log(chalk.gray('  [dry-run] Would enable iMessage channel'));
      return { configured: true, simulated: true };
    }

    const config = this.loadConfig() || {};
    if (!config.channels) config.channels = {};

    config.channels.imessage = {
      ...config.channels.imessage,
      enabled: true,
    };

    this.saveConfig(config);
    console.log(chalk.green('  iMessage channel configured'));
    return { configured: true };
  }

  /**
   * Setup Gmail Pub/Sub channel
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async setupGmail(options = {}) {
    console.log(chalk.bold('\n  Gmail Pub/Sub Setup\n'));

    // Check gog CLI
    const hasGog = await commandExists('gog');
    if (!hasGog) {
      console.log(chalk.yellow('  gog CLI not found.'));
      console.log(chalk.gray('  Set up gog first via: openclaw-easyset configure gog'));
      return { configured: false, reason: 'gog not installed' };
    }

    // Check gog auth
    try {
      const { stdout } = await executeCommand('gog auth status');
      if (stdout.includes('not authenticated') || stdout.includes('no active')) {
        console.log(chalk.yellow('  gog is not authenticated.'));
        console.log(chalk.gray('  Run: openclaw-easyset configure gog'));
        return { configured: false, reason: 'gog not authenticated' };
      }
    } catch {
      console.log(chalk.yellow('  Could not check gog auth status'));
    }

    console.log(chalk.gray('  Gmail Pub/Sub monitors your inbox for incoming emails'));
    console.log(chalk.gray('  and forwards them to OpenClaw for processing.\n'));

    const { enableGmail } = await inquirer.prompt([{
      type: 'confirm',
      name: 'enableGmail',
      message: 'Enable Gmail watch (Pub/Sub monitoring)?',
      default: true,
    }]);

    if (!enableGmail) {
      return { configured: false, reason: 'user declined' };
    }

    if (options.dryRun) {
      console.log(chalk.gray('  [dry-run] Would enable Gmail Pub/Sub'));
      return { configured: true, simulated: true };
    }

    const config = this.loadConfig() || {};
    if (!config.channels) config.channels = {};

    config.channels.gmail = {
      ...config.channels.gmail,
      enabled: true,
      watchEnabled: true,
    };

    this.saveConfig(config);
    console.log(chalk.green('  Gmail Pub/Sub channel configured'));
    console.log(chalk.gray('  The gmail-watch service will monitor your inbox'));
    return { configured: true };
  }

  /**
   * Setup Webchat channel
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async setupWebchat(options = {}) {
    console.log(chalk.bold('\n  Webchat Setup\n'));

    const { port } = await inquirer.prompt([{
      type: 'input',
      name: 'port',
      message: 'Webchat port:',
      default: '3000',
      validate: (input) => {
        const num = parseInt(input, 10);
        if (isNaN(num) || num < 1024 || num > 65535) {
          return 'Port must be between 1024 and 65535';
        }
        return true;
      },
    }]);

    if (options.dryRun) {
      console.log(chalk.gray(`  [dry-run] Would enable webchat on port ${port}`));
      return { configured: true, simulated: true };
    }

    const config = this.loadConfig() || {};
    if (!config.channels) config.channels = {};

    config.channels.webchat = {
      ...config.channels.webchat,
      enabled: true,
      port: parseInt(port, 10),
    };

    this.saveConfig(config);
    console.log(chalk.green(`  Webchat configured on port ${port}`));
    return { configured: true };
  }
}

export default new ChannelSetup();
