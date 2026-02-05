/**
 * Configuration Management Module
 * @module core/config
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import logger from './logger.js';

const CONFIG_DIR = join(homedir(), '.openclaw-easyset');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  version: '1.0.0',
  mode: 'native',
  platform: {
    os: null,
    arch: null,
  },
  installation: {
    path: join(homedir(), '.openclaw'),
    workspacePath: join(homedir(), '.openclaw', 'workspace'),
    installDaemon: true,
  },
  gateway: {
    port: 18789,
    bind: 'loopback',
    auth: {
      mode: 'token',
    },
  },
  channels: {
    enabled: [],
  },
  skills: {
    enabled: [],
  },
  security: {
    pairing: true,
    webhookVerification: true,
  },
};

/**
 * Configuration Manager
 */
class ConfigManager {
  constructor() {
    this.config = null;
    this.ensureConfigDir();
  }

  /**
   * Ensure config directory exists
   */
  ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
      logger.debug(`Created config directory: ${CONFIG_DIR}`);
    }
  }

  /**
   * Load configuration from file
   * @returns {Object} Configuration object
   */
  load() {
    try {
      if (existsSync(CONFIG_FILE)) {
        const data = readFileSync(CONFIG_FILE, 'utf-8');
        this.config = JSON.parse(data);
        logger.debug('Configuration loaded from file');
      } else {
        this.config = { ...DEFAULT_CONFIG };
        logger.debug('Using default configuration');
      }
      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration', error);
      this.config = { ...DEFAULT_CONFIG };
      return this.config;
    }
  }

  /**
   * Save configuration to file
   * @param {Object} [config] - Configuration to save (uses current if not provided)
   */
  save(config = null) {
    try {
      const configToSave = config || this.config;
      writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf-8');
      logger.debug('Configuration saved to file');
      return true;
    } catch (error) {
      logger.error('Failed to save configuration', error);
      return false;
    }
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot-notation path (e.g., 'gateway.port')
   * @param {*} [defaultValue] - Default value if path not found
   * @returns {*} Configuration value
   */
  get(path, defaultValue = null) {
    if (!this.config) {
      this.load();
    }

    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Set configuration value by path
   * @param {string} path - Dot-notation path (e.g., 'gateway.port')
   * @param {*} value - Value to set
   */
  set(path, value) {
    if (!this.config) {
      this.load();
    }

    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    logger.debug(`Config updated: ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * Merge configuration with provided object
   * @param {Object} newConfig - Configuration to merge
   */
  merge(newConfig) {
    if (!this.config) {
      this.load();
    }

    this.config = this.deepMerge(this.config, newConfig);
    logger.debug('Configuration merged');
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
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
   * Reset configuration to defaults
   */
  reset() {
    this.config = { ...DEFAULT_CONFIG };
    logger.debug('Configuration reset to defaults');
  }

  /**
   * Get config file path
   * @returns {string} Config file path
   */
  getConfigPath() {
    return CONFIG_FILE;
  }

  /**
   * Check if config file exists
   * @returns {boolean} True if config exists
   */
  exists() {
    return existsSync(CONFIG_FILE);
  }

  /**
   * Export configuration to YAML
   * @param {string} filePath - Output file path
   */
  exportToYAML(filePath) {
    try {
      const yamlString = YAML.stringify(this.config);
      writeFileSync(filePath, yamlString, 'utf-8');
      logger.success(`Configuration exported to ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to export configuration to YAML', error);
      return false;
    }
  }

  /**
   * Import configuration from YAML
   * @param {string} filePath - Input file path
   */
  importFromYAML(filePath) {
    try {
      const yamlString = readFileSync(filePath, 'utf-8');
      const imported = YAML.parse(yamlString);
      this.merge(imported);
      logger.success(`Configuration imported from ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to import configuration from YAML', error);
      return false;
    }
  }
}

export default new ConfigManager();
