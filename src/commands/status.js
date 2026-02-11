/**
 * Status Command - Live dashboard showing OpenClaw state
 * @module commands/status
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import boxen from 'boxen';
import { commandExists, getCommandVersion, formatBytes } from '../core/utils.js';
import serviceManager from '../core/service-manager.js';
import logger from '../core/logger.js';
import { loadOpenClawConfig } from '../core/openclaw-config.js';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json');
const CRON_FILE = join(OPENCLAW_DIR, 'cron', 'jobs.json');
const MEMORY_DB = join(OPENCLAW_DIR, 'memory', 'main.sqlite');
const SKILLS_DIR = join(OPENCLAW_DIR, 'workspace', 'skills');

/**
 * Execute status command
 * @param {Object} options - Command options
 */
export async function statusCommand(options) {
  try {
    console.log(boxen(chalk.bold.blue('OpenClaw EasySet - Status Dashboard'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
    }));

    const status = {};

    // --- OpenClaw Version ---
    console.log(chalk.bold('\n  OpenClaw'));
    const clawInstalled = await commandExists('openclaw');
    if (clawInstalled) {
      const version = await getCommandVersion('openclaw');
      const ver = version ? version.split('\n')[0].trim() : 'unknown';
      console.log(`    Version: ${chalk.green(ver)}`);
      status.version = ver;
    } else {
      console.log(`    ${chalk.red('Not installed')}`);
      status.version = null;
    }

    // Config status
    if (existsSync(OPENCLAW_CONFIG)) {
      try {
        const { config } = loadOpenClawConfig({ optional: false });
        const lastVersion = config.meta?.lastTouchedVersion || 'unknown';
        console.log(`    Config Version: ${chalk.gray(lastVersion)}`);

        if (config.meta?.lastTouchedAt) {
          const touched = new Date(config.meta.lastTouchedAt);
          console.log(`    Last Modified: ${chalk.gray(touched.toLocaleString())}`);
        }

        status.config = { exists: true, lastVersion };

        // --- Agent ---
        if (config.agents?.defaults) {
          console.log(chalk.bold('\n  Agent'));
          const agentModel = config.agents.defaults.model;
          const modelStr = typeof agentModel === 'object' ? agentModel.primary : agentModel;
          console.log(`    Model: ${chalk.cyan(modelStr || 'not set')}`);
          const fallbacks = typeof agentModel === 'object' && agentModel.fallbacks;
          if (fallbacks && fallbacks.length > 0) {
            console.log(`    Fallback: ${chalk.gray(fallbacks.join(', '))}`);
          } else if (config.agents.defaults.fallbackModel) {
            console.log(`    Fallback: ${chalk.gray(config.agents.defaults.fallbackModel)}`);
          }
          console.log(`    Max Concurrent: ${config.agents.defaults.maxConcurrent || 'default'}`);
        }

        // --- Channels ---
        console.log(chalk.bold('\n  Channels'));
        const channels = [];
        if (config.channels?.telegram?.enabled) {
          channels.push({ name: 'Telegram', status: 'enabled' });
          console.log(`    ${chalk.green('●')} Telegram: ${chalk.green('Enabled')}`);
        }
        if (config.channels?.imessage?.enabled) {
          channels.push({ name: 'iMessage', status: 'enabled' });
          const dmPolicy = config.channels.imessage.dmPolicy || 'default';
          console.log(`    ${chalk.green('●')} iMessage: ${chalk.green('Enabled')} ${chalk.gray(`(${dmPolicy})`)}`);
        }
        if (channels.length === 0) {
          console.log(chalk.gray('    No channels enabled'));
        }
        status.channels = channels;

        // --- Plugins ---
        console.log(chalk.bold('\n  Plugins'));
        const entries = config.plugins?.entries || {};
        const enabledPlugins = [];
        for (const [name, entry] of Object.entries(entries)) {
          if (entry.enabled) {
            enabledPlugins.push(name);
            let detail = '';
            if (name === 'memory-lancedb' && entry.config?.embedding?.model) {
              detail = chalk.gray(` (${entry.config.embedding.model})`);
            } else if (name === 'llm-task' && entry.config?.defaultModel) {
              detail = chalk.gray(` (${entry.config.defaultProvider}/${entry.config.defaultModel})`);
            } else if (name === 'voice-call' && entry.config?.provider) {
              detail = chalk.gray(` (${entry.config.provider})`);
            }
            console.log(`    ${chalk.green('●')} ${name}${detail}`);
          }
        }
        if (enabledPlugins.length === 0) {
          console.log(chalk.gray('    No plugins enabled'));
        }
        status.plugins = enabledPlugins;

        // --- Gateway ---
        console.log(chalk.bold('\n  Gateway'));
        if (config.gateway) {
          console.log(`    Port: ${config.gateway.port || 18789}`);
          console.log(`    Mode: ${config.gateway.mode || 'local'}`);
          console.log(`    Auth: ${config.gateway.auth?.mode || 'none'}`);
          if (config.gateway.tailscale?.mode) {
            console.log(`    Tailscale: ${chalk.green('Enabled')} (${config.gateway.tailscale.mode})`);
          }
        }

      } catch (error) {
        console.log(chalk.red(`    Config error: ${error.message}`));
        status.config = { exists: true, error: error.message };
      }
    } else {
      console.log(chalk.yellow('    Config: Not found'));
      status.config = { exists: false };
    }

    // --- Services ---
    console.log(chalk.bold('\n  Services'));
    await serviceManager.printStatus();

    // --- Cron Jobs ---
    console.log(chalk.bold('\n  Cron Jobs'));
    if (existsSync(CRON_FILE)) {
      try {
        const cronData = JSON.parse(readFileSync(CRON_FILE, 'utf-8'));
        const jobList = Array.isArray(cronData) ? cronData : (cronData.jobs || []);
        const activeJobs = jobList.filter(j => j.enabled !== false);
        status.cronJobs = activeJobs.length;

        for (const job of activeJobs) {
          const name = job.name || job.id || 'unnamed';
          const schedule = job.schedule?.expr || job.cron || 'no schedule';
          const tz = job.schedule?.tz ? ` ${job.schedule.tz}` : '';
          const lastStatus = job.state?.lastStatus || 'never';
          const statusIcon = lastStatus === 'ok' ? chalk.green('●')
            : lastStatus === 'never' ? chalk.gray('○')
            : chalk.yellow('●');
          console.log(`    ${statusIcon} ${chalk.bold(name)} ${chalk.gray(`[${schedule}${tz}]`)} - last: ${lastStatus}`);
        }

        if (activeJobs.length === 0) {
          console.log(chalk.gray('    No active cron jobs'));
        }
      } catch {
        console.log(chalk.yellow('    Failed to read cron jobs'));
      }
    } else {
      console.log(chalk.gray('    No cron jobs configured'));
      status.cronJobs = 0;
    }

    // --- Storage ---
    console.log(chalk.bold('\n  Storage'));
    if (existsSync(MEMORY_DB)) {
      try {
        const dbStat = statSync(MEMORY_DB);
        console.log(`    Memory DB: ${chalk.cyan(formatBytes(dbStat.size))}`);
      } catch {
        console.log(chalk.gray('    Memory DB: exists'));
      }
    } else {
      console.log(chalk.gray('    Memory DB: not initialized'));
    }

    // LanceDB
    const lanceDir = join(OPENCLAW_DIR, 'memory', 'lancedb');
    if (existsSync(lanceDir)) {
      console.log(`    Vector Store: ${chalk.green('Active')}`);
    } else {
      console.log(chalk.gray('    Vector Store: not initialized'));
    }

    // Skills count
    if (existsSync(SKILLS_DIR)) {
      try {
        const skillCount = readdirSync(SKILLS_DIR, { withFileTypes: true })
          .filter(e => e.isDirectory()).length;
        console.log(`    Skills: ${chalk.cyan(skillCount)} installed`);
        status.skills = skillCount;
      } catch {
        console.log(chalk.gray('    Skills: unknown'));
      }
    }

    // Session count
    const sessionsDir = join(OPENCLAW_DIR, 'agents', 'main', 'sessions');
    if (existsSync(sessionsDir)) {
      try {
        const sessionCount = readdirSync(sessionsDir, { withFileTypes: true })
          .filter(e => e.isDirectory()).length;
        console.log(`    Sessions: ${chalk.cyan(sessionCount)} total`);
        status.sessions = sessionCount;
      } catch { /* skip */ }
    }

    // --- Tools ---
    if (options.detailed) {
      console.log(chalk.bold('\n  Tools'));
      const tools = ['gog', 'imsg', 'git', 'docker', 'brew'];
      for (const tool of tools) {
        const exists = await commandExists(tool);
        const icon = exists ? chalk.green('●') : chalk.gray('○');
        if (exists) {
          const version = await getCommandVersion(tool);
          const ver = version ? version.split('\n')[0].trim() : '';
          console.log(`    ${icon} ${tool} ${chalk.gray(ver)}`);
        } else {
          console.log(`    ${icon} ${tool} ${chalk.gray('not installed')}`);
        }
      }
    }

    console.log('');

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
    }

  } catch (error) {
    logger.error('Status check failed', error);
    console.log(chalk.red(`\nStatus check failed: ${error.message}`));
  }
}
