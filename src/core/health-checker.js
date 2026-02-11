/**
 * Health Checker Module
 * Comprehensive diagnostics for OpenClaw installation
 * @module core/health-checker
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { commandExists, executeCommand, formatBytes } from './utils.js';
import serviceManager from './service-manager.js';
import logger from './logger.js';
import { loadOpenClawConfig, OPENCLAW_CONFIG } from './openclaw-config.js';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_ENV = join(OPENCLAW_DIR, '.env');
const MEMORY_DIR = join(OPENCLAW_DIR, 'memory');
const WORKSPACE_DIR = join(OPENCLAW_DIR, 'workspace');
const LOGS_DIR = join(OPENCLAW_DIR, 'logs');
const CRON_FILE = join(OPENCLAW_DIR, 'cron', 'jobs.json');
const CREDENTIALS_DIR = join(OPENCLAW_DIR, 'credentials');

/**
 * A single health check result
 * @typedef {Object} CheckResult
 * @property {string} name - Check name
 * @property {string} category - Category (config, services, connectivity, security, storage)
 * @property {'pass'|'warn'|'fail'} status
 * @property {string} message - Human-readable result
 * @property {string|null} fix - Suggested fix command or action
 */

class HealthChecker {
  constructor() {
    this.results = [];
  }

  /**
   * Run all health checks
   * @returns {Promise<Array<CheckResult>>}
   */
  async runAll() {
    this.results = [];

    await this.checkConfig();
    await this.checkServices();
    await this.checkConnectivity();
    await this.checkStorage();
    await this.checkCredentials();
    await this.checkTools();
    await this.checkLogs();

    return this.results;
  }

  /**
   * Add a check result
   */
  addResult(name, category, status, message, fix = null) {
    this.results.push({ name, category, status, message, fix });
  }

  // --- Configuration Checks ---

  async checkConfig() {
    // Check openclaw.json exists
    if (!existsSync(OPENCLAW_CONFIG)) {
      this.addResult('OpenClaw Config', 'config', 'fail',
        'openclaw.json not found', 'Run: openclaw setup');
      return;
    }

    // Check it's valid JSON
    try {
      const { config } = loadOpenClawConfig({ optional: false });
      this.addResult('Config Valid JSON', 'config', 'pass', 'openclaw.json is valid');

      // Check essential sections exist
      const agentModel = config.agents?.defaults?.model;
      const modelStr = typeof agentModel === 'object' ? agentModel.primary : agentModel;
      if (modelStr) {
        this.addResult('Agent Model', 'config', 'pass',
          `Default model: ${modelStr}`);
      } else {
        this.addResult('Agent Model', 'config', 'warn',
          'No default agent model configured', 'Set agents.defaults.model in openclaw.json');
      }

      // Check plugins
      const pluginEntries = config.plugins?.entries || {};
      const enabledCount = Object.values(pluginEntries).filter(p => p.enabled).length;
      this.addResult('Plugins', 'config', enabledCount > 0 ? 'pass' : 'warn',
        `${enabledCount} plugin(s) enabled`,
        enabledCount === 0 ? 'Run: openclaw-easyset configure plugins' : null);

      // Check channels
      const channels = [];
      if (config.channels?.telegram?.enabled) channels.push('telegram');
      if (config.channels?.imessage?.enabled) channels.push('imessage');
      this.addResult('Channels', 'config', channels.length > 0 ? 'pass' : 'warn',
        channels.length > 0 ? `Active: ${channels.join(', ')}` : 'No channels enabled');

      // Check gateway config
      if (config.gateway?.port) {
        this.addResult('Gateway Config', 'config', 'pass',
          `Port ${config.gateway.port}, mode: ${config.gateway.mode || 'local'}`);
      } else {
        this.addResult('Gateway Config', 'config', 'warn', 'Gateway not configured');
      }

    } catch (error) {
      this.addResult('Config Valid JSON', 'config', 'fail',
        `openclaw.json is corrupted: ${error.message}`,
        'Restore from backup: cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json');
    }

    // Check .env file
    if (existsSync(OPENCLAW_ENV)) {
      this.addResult('Environment File', 'config', 'pass', '.env file present');
    } else {
      this.addResult('Environment File', 'config', 'warn',
        '.env file not found', 'Copy from template: cp ~/.openclaw/.env.template ~/.openclaw/.env');
    }
  }

  // --- Service Checks ---

  async checkServices() {
    const statuses = await serviceManager.getAllStatuses();

    if (statuses.length === 0) {
      this.addResult('LaunchD Services', 'services', 'warn',
        'No OpenClaw services found in LaunchAgents');
      return;
    }

    for (const svc of statuses) {
      if (svc.running) {
        this.addResult(svc.description, 'services', 'pass',
          `Running (PID: ${svc.pid})`);
      } else {
        this.addResult(svc.description, 'services', 'fail',
          'Not running',
          `Run: launchctl load ~/Library/LaunchAgents/${svc.label}.plist`);
      }
    }
  }

  // --- Connectivity Checks ---

  async checkConnectivity() {
    // Gateway HTTP check
    const gateway = await serviceManager.checkGatewayHealth();
    if (gateway.responding) {
      this.addResult('Gateway HTTP', 'connectivity', 'pass',
        `Responding on port 18789 (HTTP ${gateway.statusCode})`);
    } else {
      this.addResult('Gateway HTTP', 'connectivity', 'fail',
        'Gateway not responding on port 18789',
        'Check: openclaw-easyset doctor --fix');
    }

    // Internet connectivity
    try {
      await executeCommand('curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com 2>/dev/null');
      this.addResult('Internet Access', 'connectivity', 'pass', 'Can reach external APIs');
    } catch {
      this.addResult('Internet Access', 'connectivity', 'warn',
        'Cannot reach external APIs');
    }
  }

  // --- Storage Checks ---

  async checkStorage() {
    // Workspace directory
    if (existsSync(WORKSPACE_DIR)) {
      this.addResult('Workspace', 'storage', 'pass', 'Workspace directory exists');
    } else {
      this.addResult('Workspace', 'storage', 'fail',
        'Workspace directory missing', 'Run: mkdir -p ~/.openclaw/workspace');
    }

    // Memory database
    const mainSqlite = join(MEMORY_DIR, 'main.sqlite');
    if (existsSync(mainSqlite)) {
      try {
        const stat = statSync(mainSqlite);
        this.addResult('Memory Database', 'storage', 'pass',
          `main.sqlite: ${formatBytes(stat.size)}`);
      } catch {
        this.addResult('Memory Database', 'storage', 'pass', 'main.sqlite exists');
      }
    } else {
      this.addResult('Memory Database', 'storage', 'warn',
        'Memory database not found (will be created on first use)');
    }

    // LanceDB vector store
    const lanceDir = join(MEMORY_DIR, 'lancedb');
    if (existsSync(lanceDir)) {
      this.addResult('Vector Store', 'storage', 'pass', 'LanceDB directory exists');
    } else {
      this.addResult('Vector Store', 'storage', 'warn',
        'LanceDB not initialized',
        'Run: openclaw-easyset configure plugins (enable memory-lancedb)');
    }

    // Cron jobs
    if (existsSync(CRON_FILE)) {
      try {
        const cronData = JSON.parse(readFileSync(CRON_FILE, 'utf-8'));
        const jobList = Array.isArray(cronData) ? cronData : (cronData.jobs || []);
        const activeJobs = jobList.filter(j => j.enabled !== false);
        this.addResult('Cron Jobs', 'storage', 'pass',
          `${activeJobs.length} active cron job(s)`);
      } catch {
        this.addResult('Cron Jobs', 'storage', 'warn', 'Cron jobs file is corrupted');
      }
    } else {
      this.addResult('Cron Jobs', 'storage', 'warn', 'No cron jobs configured');
    }

    // Disk space check
    try {
      const { stdout } = await executeCommand(`df -k "${OPENCLAW_DIR}" | tail -1`);
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 4) {
        const availKB = parseInt(parts[3], 10);
        const availBytes = availKB * 1024;
        const status = availBytes > 1024 * 1024 * 1024 ? 'pass' : 'warn';
        this.addResult('Disk Space', 'storage', status,
          `${formatBytes(availBytes)} available`,
          status === 'warn' ? 'Free up disk space (< 1GB remaining)' : null);
      }
    } catch { /* skip */ }
  }

  // --- Credential/Security Checks ---

  async checkCredentials() {
    if (!existsSync(OPENCLAW_CONFIG)) return;

    try {
      const { config } = loadOpenClawConfig({ optional: false });

      // Check auth profiles
      const profiles = config.auth?.profiles || {};
      const profileCount = Array.isArray(profiles) ? profiles.length : Object.keys(profiles).length;
      if (profileCount > 0) {
        this.addResult('Auth Profiles', 'security', 'pass',
          `${profileCount} auth profile(s) configured`);
      } else {
        this.addResult('Auth Profiles', 'security', 'warn',
          'No auth profiles', 'Run: openclaw auth add');
      }

      // Check gateway auth token
      if (config.gateway?.auth?.token || config.gateway?.auth?.password) {
        const secret = config.gateway.auth.token || config.gateway.auth.password;
        const tokenLen = secret.length;
        this.addResult('Gateway Auth', 'security', tokenLen >= 24 ? 'pass' : 'warn',
          tokenLen >= 24 ? 'Gateway auth configured (strong)' : 'Gateway auth secret may be weak',
          tokenLen < 24 ? 'Use a longer gateway token/password' : null);
      } else {
        this.addResult('Gateway Auth', 'security', 'fail',
          'No gateway auth secret found', 'Run: openclaw doctor --generate-gateway-token');
      }

      // Check credentials directory
      if (existsSync(CREDENTIALS_DIR)) {
        const credFiles = readdirSync(CREDENTIALS_DIR).filter(f => f.endsWith('.json'));
        this.addResult('Credentials', 'security', 'pass',
          `${credFiles.length} credential file(s)`);
      }

      // Check config file permissions
      try {
        const stat = statSync(OPENCLAW_CONFIG);
        const mode = stat.mode & 0o777;
        if (mode & 0o077) {
          this.addResult('Config Permissions', 'security', 'warn',
            `openclaw.json is world-readable (${mode.toString(8)})`,
            'Run: chmod 600 ~/.openclaw/openclaw.json');
        } else {
          this.addResult('Config Permissions', 'security', 'pass',
            'Config file has restricted permissions');
        }
      } catch { /* skip */ }

      // Check .env file permissions
      if (existsSync(OPENCLAW_ENV)) {
        try {
          const stat = statSync(OPENCLAW_ENV);
          const mode = stat.mode & 0o777;
          if (mode & 0o077) {
            this.addResult('.env Permissions', 'security', 'warn',
              `.env file is world-readable (${mode.toString(8)})`,
              'Run: chmod 600 ~/.openclaw/.env');
          } else {
            this.addResult('.env Permissions', 'security', 'pass',
              '.env file has restricted permissions');
          }
        } catch { /* skip */ }
      }

    } catch { /* config parse failed, already reported */ }
  }

  // --- Tool Checks ---

  async checkTools() {
    const tools = [
      { name: 'openclaw', required: true, label: 'OpenClaw CLI' },
      { name: 'node', required: true, label: 'Node.js' },
      { name: 'npm', required: true, label: 'npm' },
      { name: 'git', required: false, label: 'Git' },
      { name: 'gog', required: false, label: 'Google Workspace CLI' },
      { name: 'imsg', required: false, label: 'iMessage CLI' },
    ];

    for (const tool of tools) {
      const exists = await commandExists(tool.name);
      if (exists) {
        this.addResult(tool.label, 'tools', 'pass', 'Installed');
      } else if (tool.required) {
        this.addResult(tool.label, 'tools', 'fail',
          'Not installed (required)',
          `Install ${tool.name}`);
      } else {
        this.addResult(tool.label, 'tools', 'warn',
          'Not installed (optional)');
      }
    }
  }

  // --- Log Checks ---

  async checkLogs() {
    if (!existsSync(LOGS_DIR)) {
      this.addResult('Log Directory', 'logs', 'warn', 'Log directory missing');
      return;
    }

    // Check gateway error log for recent errors
    const errLog = join(LOGS_DIR, 'gateway.err.log');
    if (existsSync(errLog)) {
      try {
        const stat = statSync(errLog);
        if (stat.size > 10 * 1024 * 1024) {
          this.addResult('Gateway Error Log', 'logs', 'warn',
            `Error log is large: ${formatBytes(stat.size)}`,
            'Consider rotating: > ~/.openclaw/logs/gateway.err.log');
        } else if (stat.size > 0) {
          // Check last few lines for recent errors
          const content = readFileSync(errLog, 'utf-8');
          const lines = content.trim().split('\n');
          const lastLine = lines[lines.length - 1] || '';
          const hasRecentError = lastLine.toLowerCase().includes('error') ||
            lastLine.toLowerCase().includes('fatal');

          this.addResult('Gateway Error Log', 'logs',
            hasRecentError ? 'warn' : 'pass',
            hasRecentError
              ? `Recent errors detected (${formatBytes(stat.size)})`
              : `${formatBytes(stat.size)}, no recent errors`);
        } else {
          this.addResult('Gateway Error Log', 'logs', 'pass', 'No errors');
        }
      } catch { /* skip */ }
    }
  }

  /**
   * Print formatted results grouped by category
   */
  printResults() {
    const categories = ['config', 'services', 'connectivity', 'storage', 'security', 'tools', 'logs'];
    const categoryLabels = {
      config: 'Configuration',
      services: 'Services',
      connectivity: 'Connectivity',
      storage: 'Storage & Data',
      security: 'Security',
      tools: 'Tools',
      logs: 'Logs',
    };

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const cat of categories) {
      const catResults = this.results.filter(r => r.category === cat);
      if (catResults.length === 0) continue;

      console.log(chalk.bold(`\n  ${categoryLabels[cat] || cat}`));

      for (const r of catResults) {
        let icon, color;
        if (r.status === 'pass') {
          icon = chalk.green('✓');
          color = chalk.white;
          passCount++;
        } else if (r.status === 'warn') {
          icon = chalk.yellow('⚠');
          color = chalk.yellow;
          warnCount++;
        } else {
          icon = chalk.red('✗');
          color = chalk.red;
          failCount++;
        }

        console.log(`    ${icon} ${chalk.bold(r.name)}: ${color(r.message)}`);
        if (r.fix) {
          console.log(chalk.gray(`      Fix: ${r.fix}`));
        }
      }
    }

    // Summary
    const total = passCount + warnCount + failCount;
    console.log(chalk.bold('\n  Summary'));
    console.log(`    ${chalk.green(`${passCount} passed`)}, ${chalk.yellow(`${warnCount} warnings`)}, ${chalk.red(`${failCount} failed`)} (${total} total)`);

    const score = total > 0 ? Math.round((passCount / total) * 100) : 0;
    let scoreColor = chalk.green;
    if (score < 60) scoreColor = chalk.red;
    else if (score < 80) scoreColor = chalk.yellow;
    console.log(`    Health Score: ${scoreColor(`${score}%`)}`);

    return { passCount, warnCount, failCount, score };
  }

  /**
   * Auto-fix common issues
   * @returns {Promise<Array<{check: string, action: string, success: boolean}>>}
   */
  async autoFix() {
    const fixes = [];

    for (const result of this.results) {
      if (result.status !== 'fail' && result.status !== 'warn') continue;
      if (!result.fix) continue;

      // Only auto-fix safe operations
      if (result.fix.startsWith('Run: chmod')) {
        try {
          const cmd = result.fix.replace('Run: ', '');
          await executeCommand(cmd);
          fixes.push({ check: result.name, action: cmd, success: true });
        } catch (error) {
          fixes.push({ check: result.name, action: result.fix, success: false });
        }
      } else if (result.fix.startsWith('Run: mkdir')) {
        try {
          const cmd = result.fix.replace('Run: ', '');
          await executeCommand(cmd);
          fixes.push({ check: result.name, action: cmd, success: true });
        } catch (error) {
          fixes.push({ check: result.name, action: result.fix, success: false });
        }
      } else if (result.fix.startsWith('Run: launchctl load')) {
        try {
          const cmd = result.fix.replace('Run: ', '');
          await executeCommand(cmd);
          fixes.push({ check: result.name, action: cmd, success: true });
        } catch (error) {
          fixes.push({ check: result.name, action: result.fix, success: false });
        }
      }
    }

    return fixes;
  }
}

export default new HealthChecker();
