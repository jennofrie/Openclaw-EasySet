/**
 * Plugin Manager Module
 * Manages OpenClaw plugin configuration in ~/.openclaw/openclaw.json
 * @module core/plugin-manager
 */

import { existsSync, copyFileSync } from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import logger from './logger.js';
import { OPENCLAW_CONFIG, loadOpenClawConfig, saveOpenClawConfig } from './openclaw-config.js';

/**
 * Plugin Manager
 */
class PluginManager {
  constructor() {
    this.config = null;
  }

  /**
   * Load and parse the openclaw.json config
   * @returns {Object|null} Parsed config or null if not found
   */
  loadOpenClawConfig() {
    try {
      if (!existsSync(OPENCLAW_CONFIG)) {
        logger.warn(`OpenClaw config not found at ${OPENCLAW_CONFIG}`);
        return null;
      }

      const { config } = loadOpenClawConfig({ optional: false });
      this.config = config;
      logger.debug('OpenClaw config loaded successfully');
      return this.config;
    } catch (error) {
      logger.error('Failed to load OpenClaw config', error);
      return null;
    }
  }

  /**
   * Create a timestamped backup of openclaw.json
   * @returns {string|null} Backup file path or null on failure
   */
  backupConfig() {
    try {
      if (!existsSync(OPENCLAW_CONFIG)) {
        logger.warn('No config file to backup');
        return null;
      }

      const timestamp = Date.now();
      const backupPath = `${OPENCLAW_CONFIG}.easyset-backup.${timestamp}`;
      copyFileSync(OPENCLAW_CONFIG, backupPath);
      logger.debug(`Config backed up to ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('Failed to backup config', error);
      return null;
    }
  }

  /**
   * Write config back to openclaw.json
   * @param {Object} config - Config object to save
   * @returns {boolean} True on success
   */
  saveOpenClawConfig(config) {
    try {
      saveOpenClawConfig(config);
      this.config = config;
      logger.debug('OpenClaw config saved successfully');
      return true;
    } catch (error) {
      logger.error('Failed to save OpenClaw config', error);
      return false;
    }
  }

  /**
   * Get map of enabled plugins from plugins.entries
   * @returns {Object} Map of plugin name -> config for enabled plugins
   */
  getEnabledPlugins() {
    if (!this.config) {
      this.loadOpenClawConfig();
    }

    if (!this.config?.plugins?.entries) {
      return {};
    }

    const enabled = {};
    for (const [name, entry] of Object.entries(this.config.plugins.entries)) {
      if (entry.enabled) {
        enabled[name] = entry;
      }
    }
    return enabled;
  }

  /**
   * Validate required fields for a plugin config
   * @param {string} name - Plugin name
   * @param {Object} config - Plugin config
   * @returns {{valid: boolean, errors: string[]}}
   */
  validatePluginConfig(name, config) {
    const errors = [];

    if (name === 'memory-lancedb') {
      if (!config.embedding?.apiKey) {
        errors.push('OpenAI API key is required for Memory LanceDB');
      }
      if (!config.embedding?.model) {
        errors.push('Embedding model is required for Memory LanceDB');
      }
    }

    if (name === 'llm-task') {
      if (!config.defaultProvider) {
        errors.push('Default provider is required for LLM Task');
      }
      if (!config.defaultModel) {
        errors.push('Default model is required for LLM Task');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Enable a plugin by setting its config in plugins.entries
   * @param {string} name - Plugin name
   * @param {Object} pluginConfig - Plugin configuration
   * @param {string} [slot] - Optional slot to assign (e.g., 'memory')
   */
  enablePlugin(name, pluginConfig, slot = null) {
    if (!this.config) {
      this.loadOpenClawConfig();
    }

    if (!this.config) {
      logger.error('Cannot enable plugin: no config loaded');
      return false;
    }

    // Ensure plugins structure exists
    if (!this.config.plugins) {
      this.config.plugins = {};
    }
    if (!this.config.plugins.entries) {
      this.config.plugins.entries = {};
    }
    if (!this.config.plugins.slots) {
      this.config.plugins.slots = {};
    }

    // Merge with existing config (don't overwrite user-customized fields)
    const existing = this.config.plugins.entries[name]?.config || {};
    const mergedConfig = this.deepMerge(existing, pluginConfig);

    this.config.plugins.entries[name] = {
      enabled: true,
      config: mergedConfig,
    };

    if (slot) {
      this.config.plugins.slots[slot] = name;
    }

    logger.debug(`Plugin ${name} enabled`);
    return true;
  }

  /**
   * Deep merge two objects (source into target)
   * @param {Object} target
   * @param {Object} source
   * @returns {Object}
   */
  deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  /**
   * Run the interactive plugin wizard
   * @param {Object} options - Options from CLI (--yes, --dry-run)
   * @returns {Promise<Object>} Result of the wizard run
   */
  async runPluginWizard(options = {}) {
    const result = { plugins: [], skipped: [], errors: [] };

    const config = this.loadOpenClawConfig();
    if (!config) {
      if (options.dryRun) {
        console.log(chalk.gray('  [dry-run] Would configure plugins (no openclaw.json found)'));
        return result;
      }
      result.errors.push('OpenClaw config not found. Is OpenClaw installed?');
      return result;
    }

    const enabledPlugins = this.getEnabledPlugins();

    // --- Memory LanceDB ---
    console.log(chalk.bold('\n  Plugin: Memory LanceDB'));

    const lancedbEnabled = !!enabledPlugins['memory-lancedb'];
    if (lancedbEnabled) {
      console.log(chalk.green('    Currently: Enabled'));
    } else {
      console.log(chalk.gray('    Currently: Not configured'));
    }

    let configureLancedb = false;
    if (options.yes) {
      configureLancedb = !lancedbEnabled;
    } else {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: lancedbEnabled
          ? 'Memory LanceDB is already enabled. Reconfigure?'
          : 'Enable Memory LanceDB for persistent memory?',
        default: !lancedbEnabled,
      }]);
      configureLancedb = confirm;
    }

    if (configureLancedb) {
      try {
        const lanceConfig = await this.promptLancedbConfig(options);

        if (options.dryRun) {
          console.log(chalk.gray('    [dry-run] Would enable memory-lancedb'));
          result.plugins.push({ name: 'memory-lancedb', action: 'dry-run' });
        } else {
          const validation = this.validatePluginConfig('memory-lancedb', lanceConfig);
          if (validation.valid) {
            this.enablePlugin('memory-lancedb', lanceConfig, 'memory');
            result.plugins.push({ name: 'memory-lancedb', action: 'enabled' });
            logger.success('Memory LanceDB configured');
          } else {
            result.errors.push(...validation.errors);
          }
        }
      } catch (error) {
        result.errors.push(`Memory LanceDB setup failed: ${error.message}`);
      }
    } else {
      result.skipped.push('memory-lancedb');
    }

    // --- LLM Task ---
    console.log(chalk.bold('\n  Plugin: LLM Task'));

    const llmEnabled = !!enabledPlugins['llm-task'];
    if (llmEnabled) {
      console.log(chalk.green('    Currently: Enabled'));
    } else {
      console.log(chalk.gray('    Currently: Not configured'));
    }

    let configureLlm = false;
    if (options.yes) {
      configureLlm = !llmEnabled;
    } else {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: llmEnabled
          ? 'LLM Task is already enabled. Reconfigure?'
          : 'Enable LLM Task for AI-powered task execution?',
        default: !llmEnabled,
      }]);
      configureLlm = confirm;
    }

    if (configureLlm) {
      try {
        const llmConfig = await this.promptLlmTaskConfig(options);

        if (options.dryRun) {
          console.log(chalk.gray('    [dry-run] Would enable llm-task'));
          result.plugins.push({ name: 'llm-task', action: 'dry-run' });
        } else {
          const validation = this.validatePluginConfig('llm-task', llmConfig);
          if (validation.valid) {
            this.enablePlugin('llm-task', llmConfig);
            result.plugins.push({ name: 'llm-task', action: 'enabled' });
            logger.success('LLM Task configured');
          } else {
            result.errors.push(...validation.errors);
          }
        }
      } catch (error) {
        result.errors.push(`LLM Task setup failed: ${error.message}`);
      }
    } else {
      result.skipped.push('llm-task');
    }

    // Save config if changes were made and not dry-run
    if (!options.dryRun && result.plugins.length > 0) {
      this.backupConfig();
      this.saveOpenClawConfig(this.config);
    }

    return result;
  }

  /**
   * Prompt for Memory LanceDB configuration
   * @param {Object} options
   * @returns {Promise<Object>} Plugin config
   */
  async promptLancedbConfig(options) {
    if (options.yes) {
      return {
        embedding: {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: 'text-embedding-3-small',
        },
        autoCapture: true,
        autoRecall: true,
      };
    }

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'OpenAI API key for embeddings:',
        mask: '*',
        validate: (input) => input.length > 0 ? true : 'API key is required',
      },
      {
        type: 'list',
        name: 'model',
        message: 'Embedding model:',
        choices: [
          { name: 'text-embedding-3-small (recommended)', value: 'text-embedding-3-small' },
          { name: 'text-embedding-3-large', value: 'text-embedding-3-large' },
          { name: 'text-embedding-ada-002', value: 'text-embedding-ada-002' },
        ],
        default: 'text-embedding-3-small',
      },
      {
        type: 'confirm',
        name: 'autoCapture',
        message: 'Enable automatic memory capture?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'autoRecall',
        message: 'Enable automatic memory recall?',
        default: true,
      },
    ]);

    return {
      embedding: {
        apiKey: answers.apiKey,
        model: answers.model,
      },
      autoCapture: answers.autoCapture,
      autoRecall: answers.autoRecall,
    };
  }

  /**
   * Prompt for LLM Task configuration
   * @param {Object} options
   * @returns {Promise<Object>} Plugin config
   */
  async promptLlmTaskConfig(options) {
    if (options.yes) {
      return {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-sonnet-4-5',
        maxTokens: 4096,
        timeoutMs: 60000,
      };
    }

    const { provider } = await inquirer.prompt([{
      type: 'list',
      name: 'provider',
      message: 'LLM provider:',
      choices: [
        { name: 'Anthropic (recommended)', value: 'anthropic' },
        { name: 'OpenAI', value: 'openai' },
      ],
      default: 'anthropic',
    }]);

    const modelChoices = provider === 'anthropic'
      ? [
          { name: 'claude-sonnet-4-5 (recommended)', value: 'claude-sonnet-4-5' },
          { name: 'claude-opus-4-6', value: 'claude-opus-4-6' },
          { name: 'claude-haiku-4-5', value: 'claude-haiku-4-5' },
        ]
      : [
          { name: 'gpt-4o (recommended)', value: 'gpt-4o' },
          { name: 'gpt-4o-mini', value: 'gpt-4o-mini' },
          { name: 'gpt-4-turbo', value: 'gpt-4-turbo' },
        ];

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: 'Default model:',
        choices: modelChoices,
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: 'Max tokens per request:',
        default: 4096,
        validate: (input) => input > 0 ? true : 'Must be a positive number',
      },
    ]);

    return {
      defaultProvider: provider,
      defaultModel: answers.model,
      maxTokens: answers.maxTokens,
      timeoutMs: 60000,
    };
  }
}

export default new PluginManager();
