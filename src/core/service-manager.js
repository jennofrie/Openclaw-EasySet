/**
 * Service Manager Module
 * Manages OpenClaw launchd services on macOS (gateway, gmail-watch)
 * @module core/service-manager
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { executeCommand, createSpinner } from './utils.js';
import logger from './logger.js';

const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents');
const OPENCLAW_LOGS_DIR = join(homedir(), '.openclaw', 'logs');

/**
 * Known OpenClaw service definitions
 */
const KNOWN_SERVICES = {
  gateway: {
    label: 'ai.openclaw.gateway',
    plist: 'ai.openclaw.gateway.plist',
    description: 'OpenClaw Gateway',
    logFile: 'gateway.log',
    errLogFile: 'gateway.err.log',
    port: 18789,
  },
  'gmail-watch': {
    label: 'ai.openclaw.gmail-watch',
    plist: 'ai.openclaw.gmail-watch.plist',
    description: 'Gmail Watch Webhook',
    logFile: 'gmail-watch.log',
    errLogFile: 'gmail-watch.err.log',
  },
};

class ServiceManager {
  /**
   * Discover all OpenClaw launchd services
   * @returns {Array<Object>} Array of discovered services
   */
  discoverServices() {
    const services = [];

    if (!existsSync(LAUNCH_AGENTS_DIR)) {
      logger.debug('LaunchAgents directory not found');
      return services;
    }

    try {
      const files = readdirSync(LAUNCH_AGENTS_DIR);
      const openclawPlists = files.filter(f => f.startsWith('ai.openclaw.') && f.endsWith('.plist'));

      for (const plistFile of openclawPlists) {
        const label = plistFile.replace('.plist', '');
        const shortName = label.replace('ai.openclaw.', '');
        const known = Object.values(KNOWN_SERVICES).find(s => s.label === label);

        services.push({
          label,
          shortName,
          plistPath: join(LAUNCH_AGENTS_DIR, plistFile),
          description: known?.description || shortName,
          logFile: known?.logFile || null,
          errLogFile: known?.errLogFile || null,
          port: known?.port || null,
        });
      }
    } catch (error) {
      logger.error('Failed to discover services', error);
    }

    return services;
  }

  /**
   * Check if a specific service is running
   * @param {string} label - Service label (e.g., 'ai.openclaw.gateway')
   * @returns {Promise<{running: boolean, pid: number|null, details: string}>}
   */
  async getServiceStatus(label) {
    try {
      const { stdout } = await executeCommand(`launchctl list | grep "${label}"`);
      const parts = stdout.trim().split(/\s+/);

      if (parts.length >= 3) {
        const pid = parts[0] === '-' ? null : parseInt(parts[0], 10);
        const exitCode = parseInt(parts[1], 10);

        return {
          running: pid !== null && pid > 0,
          pid,
          exitCode,
          details: pid ? `Running (PID: ${pid})` : `Not running (exit: ${exitCode})`,
        };
      }

      return { running: false, pid: null, exitCode: null, details: 'Not loaded' };
    } catch {
      return { running: false, pid: null, exitCode: null, details: 'Not loaded' };
    }
  }

  /**
   * Get status of all OpenClaw services
   * @returns {Promise<Array<Object>>} Services with status info
   */
  async getAllStatuses() {
    const services = this.discoverServices();
    const results = [];

    for (const svc of services) {
      const status = await this.getServiceStatus(svc.label);
      results.push({ ...svc, ...status });
    }

    return results;
  }

  /**
   * Start a service via launchctl
   * @param {string} label - Service label
   * @returns {Promise<boolean>}
   */
  async startService(label) {
    const service = this.discoverServices().find(s => s.label === label);
    if (!service) {
      logger.error(`Service not found: ${label}`);
      return false;
    }

    try {
      await executeCommand(`launchctl load "${service.plistPath}"`);
      logger.debug(`Service loaded: ${label}`);

      // Also try bootout/bootstrap for newer launchctl
      try {
        await executeCommand(`launchctl bootstrap gui/$(id -u) "${service.plistPath}" 2>/dev/null`);
      } catch {
        // Ignore - load already worked or bootstrap not needed
      }

      return true;
    } catch (error) {
      logger.error(`Failed to start service ${label}`, error);
      return false;
    }
  }

  /**
   * Stop a service via launchctl
   * @param {string} label - Service label
   * @returns {Promise<boolean>}
   */
  async stopService(label) {
    const service = this.discoverServices().find(s => s.label === label);
    if (!service) {
      logger.error(`Service not found: ${label}`);
      return false;
    }

    try {
      await executeCommand(`launchctl unload "${service.plistPath}"`);
      logger.debug(`Service unloaded: ${label}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop service ${label}`, error);
      return false;
    }
  }

  /**
   * Restart a service
   * @param {string} label - Service label
   * @returns {Promise<boolean>}
   */
  async restartService(label) {
    const spinner = createSpinner(`Restarting ${label}...`);
    spinner.start();

    await this.stopService(label);
    // Brief pause for clean shutdown
    await new Promise(r => setTimeout(r, 1500));
    const result = await this.startService(label);

    if (result) {
      spinner.succeed(`Restarted ${label}`);
    } else {
      spinner.fail(`Failed to restart ${label}`);
    }
    return result;
  }

  /**
   * Check if the gateway is responding on its port
   * @param {number} [port=18789] - Gateway port
   * @returns {Promise<{responding: boolean, statusCode: number|null}>}
   */
  async checkGatewayHealth(port = 18789) {
    try {
      const { stdout } = await executeCommand(
        `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/health 2>/dev/null || echo "000"`,
      );
      const code = parseInt(stdout.trim(), 10);
      return {
        responding: code > 0 && code < 500,
        statusCode: code || null,
      };
    } catch {
      return { responding: false, statusCode: null };
    }
  }

  /**
   * Get recent log lines for a service
   * @param {string} shortName - Service short name (e.g., 'gateway')
   * @param {number} [lines=20] - Number of lines
   * @returns {string} Log content
   */
  getRecentLogs(shortName, lines = 20) {
    const known = KNOWN_SERVICES[shortName];
    if (!known) return '';

    const logPath = join(OPENCLAW_LOGS_DIR, known.logFile);
    if (!existsSync(logPath)) return '';

    try {
      const content = readFileSync(logPath, 'utf-8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines).join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Get recent error log lines
   * @param {string} shortName - Service short name
   * @param {number} [lines=20] - Number of lines
   * @returns {string} Error log content
   */
  getRecentErrors(shortName, lines = 20) {
    const known = KNOWN_SERVICES[shortName];
    if (!known?.errLogFile) return '';

    const logPath = join(OPENCLAW_LOGS_DIR, known.errLogFile);
    if (!existsSync(logPath)) return '';

    try {
      const content = readFileSync(logPath, 'utf-8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines).join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Get log file sizes
   * @returns {Object} Map of log file name -> size in bytes
   */
  getLogSizes() {
    const sizes = {};
    if (!existsSync(OPENCLAW_LOGS_DIR)) return sizes;

    try {
      const { statSync } = require('fs');
      const files = readdirSync(OPENCLAW_LOGS_DIR);
      for (const file of files) {
        try {
          const stat = require('fs').statSync(join(OPENCLAW_LOGS_DIR, file));
          sizes[file] = stat.size;
        } catch { /* skip */ }
      }
    } catch {
      // Fallback for ESM
      try {
        const files = readdirSync(OPENCLAW_LOGS_DIR);
        sizes._count = files.length;
      } catch { /* skip */ }
    }

    return sizes;
  }

  /**
   * Print formatted service status table
   */
  async printStatus() {
    const statuses = await this.getAllStatuses();

    if (statuses.length === 0) {
      console.log(chalk.gray('  No OpenClaw services found'));
      return statuses;
    }

    for (const svc of statuses) {
      const icon = svc.running ? chalk.green('●') : chalk.red('○');
      const state = svc.running
        ? chalk.green(`Running (PID: ${svc.pid})`)
        : chalk.red('Stopped');
      console.log(`  ${icon} ${chalk.bold(svc.description)} ${chalk.gray(`[${svc.label}]`)}`);
      console.log(`    Status: ${state}`);

      if (svc.port) {
        const health = await this.checkGatewayHealth(svc.port);
        const healthStr = health.responding
          ? chalk.green(`Responding (HTTP ${health.statusCode})`)
          : chalk.yellow('Not responding');
        console.log(`    Health: ${healthStr}`);
      }
    }

    return statuses;
  }
}

export default new ServiceManager();
