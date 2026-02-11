/**
 * Security Hardening Command
 * Configure security settings for OpenClaw installation
 * @module commands/security
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import logger from '../core/logger.js';
import { executeCommand } from '../core/utils.js';
import { loadOpenClawConfig, updateOpenClawConfig } from '../core/openclaw-config.js';

/**
 * Security profiles with predefined settings
 */
const SECURITY_PROFILES = {
  minimal: {
    name: 'Minimal',
    description: 'Basic security - suitable for personal/trusted networks',
    settings: {
      pairing: false,
      webhookVerification: false,
      trustedProxies: [],
      rateLimiting: false,
      apiKeyRotation: false
    }
  },
  standard: {
    name: 'Standard',
    description: 'Recommended for most users - balanced security',
    settings: {
      pairing: true,
      webhookVerification: true,
      trustedProxies: ['127.0.0.1', '::1'],
      rateLimiting: true,
      apiKeyRotation: false
    }
  },
  hardened: {
    name: 'Hardened',
    description: 'Maximum security - for production/exposed deployments',
    settings: {
      pairing: true,
      webhookVerification: true,
      trustedProxies: ['127.0.0.1', '::1'],
      rateLimiting: true,
      apiKeyRotation: true,
      ipAllowlist: true,
      auditLogging: true
    }
  }
};

/**
 * Security command handler
 * @param {Object} options - Command options
 */
export async function securityCommand(options) {
  const { profile, audit, fix, dryRun } = options;

  if (audit) {
    return await runSecurityAudit(options);
  }

  if (profile) {
    return await applySecurityProfile(profile, options);
  }

  // Interactive mode
  return await interactiveSecuritySetup(options);
}

/**
 * Run security audit
 * @param {Object} options - Options
 * @returns {Promise<Object>} Audit results
 */
async function runSecurityAudit(options) {
  const spinner = ora('Running security audit...').start();
  const { fix = false, dryRun = false } = options;

  const results = {
    score: 0,
    maxScore: 0,
    issues: [],
    passed: [],
    warnings: []
  };

  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    let config = {};

    if (existsSync(configPath)) {
      config = loadOpenClawConfig({ optional: false }).config;
    }

    // Check 1: Pairing/allowlist mode
    results.maxScore += 20;
    const dmPolicies = getDmPolicies(config);
    const openPolicies = dmPolicies.filter(p => p.policy === 'open');
    if (openPolicies.length === 0) {
      results.score += 20;
      results.passed.push('DM policies are not publicly open');
    } else {
      results.issues.push({
        severity: 'high',
        title: 'Open DM policy detected',
        description: `Public DM access enabled for: ${openPolicies.map(p => p.channel).join(', ')}`,
        fix: 'Use dmPolicy "pairing" or "allowlist" for exposed channels'
      });
    }

    // Check 2: Gateway auth
    results.maxScore += 15;
    if (config.gateway?.auth?.token || config.gateway?.auth?.password) {
      results.score += 15;
      results.passed.push('Gateway auth secret configured');
    } else {
      results.issues.push({
        severity: 'high',
        title: 'Gateway auth not configured',
        description: 'Gateway token/password is missing',
        fix: 'Run: openclaw doctor --generate-gateway-token'
      });
    }

    // Check 3: File permissions (Unix only)
    if (platform() !== 'win32') {
      results.maxScore += 15;
      const configStats = await checkFilePermissions(configPath);
      if (configStats.secure) {
        results.score += 15;
        results.passed.push('Config file permissions are secure');
      } else {
        results.issues.push({
          severity: 'high',
          title: 'Insecure file permissions',
          description: `Config file readable by others (${configStats.mode})`,
          fix: 'Run: chmod 600 ~/.openclaw/openclaw.json',
          autoFix: async () => {
            chmodSync(configPath, 0o600);
          }
        });
      }
    }

    // Check 4: Auth profiles / API key storage
    results.maxScore += 10;
    const hasAuthProfiles = !!config.auth?.profiles && Object.keys(config.auth.profiles).length > 0;
    const hasEnvApiKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
    if (hasAuthProfiles || hasEnvApiKey) {
      results.score += 10;
      results.passed.push('Model authentication source configured');
    } else if (config.anthropic?.apiKey || config.openai?.apiKey) {
      results.warnings.push({
        severity: 'low',
        title: 'API key in config file',
        description: 'Recommended to use environment variables for API keys',
        fix: 'Move API key to environment variable'
      });
      results.score += 5; // Partial credit
    }

    // Check 5: Gateway bind address
    results.maxScore += 15;
    const bindAddress = config.gateway?.bind || 'loopback';
    if (bindAddress === 'loopback' || bindAddress === '127.0.0.1') {
      results.score += 15;
      results.passed.push('Gateway bound to loopback only');
    } else if (bindAddress === 'lan') {
      results.score += 10;
      results.warnings.push({
        severity: 'medium',
        title: 'Gateway accessible on LAN',
        description: 'Gateway is accessible from local network',
        fix: 'Consider using loopback or Tailscale for remote access'
      });
    } else {
      results.issues.push({
        severity: 'high',
        title: 'Gateway publicly accessible',
        description: `Gateway bound to ${bindAddress}`,
        fix: 'Bind to loopback and use Tailscale for secure remote access'
      });
    }

    // Check 6: Trusted proxies configuration
    results.maxScore += 10;
    const trustedProxies = config.gateway?.trustedProxies || config.security?.trustedProxies || [];
    if (Array.isArray(trustedProxies) && trustedProxies.length > 0) {
      results.score += 10;
      results.passed.push('Trusted proxies configured');
    } else if (bindAddress !== 'loopback') {
      results.issues.push({
        severity: 'medium',
        title: 'No trusted proxies configured',
        description: 'IP-based access control not configured',
        fix: 'Configure trusted proxies in security settings'
      });
    }

    // Check 7: Control UI dangerous settings
    results.maxScore += 10;
    if (config.gateway?.controlUi?.dangerouslyDisableDeviceAuth) {
      results.issues.push({
        severity: 'high',
        title: 'Control UI device auth disabled',
        description: 'dangerouslyDisableDeviceAuth is enabled',
        fix: 'Set gateway.controlUi.dangerouslyDisableDeviceAuth to false'
      });
    } else {
      results.score += 10;
      results.passed.push('Control UI device auth guard is enabled');
    }

    // Check 8: Log directory permissions
    if (platform() !== 'win32') {
      results.maxScore += 10;
      const logDir = join(homedir(), '.openclaw', 'logs');
      if (existsSync(logDir)) {
        const logStats = await checkFilePermissions(logDir);
        if (logStats.secure) {
          results.score += 10;
          results.passed.push('Log directory permissions are secure');
        } else {
          results.issues.push({
            severity: 'medium',
            title: 'Insecure log directory permissions',
            description: 'Log files may be readable by other users',
            fix: 'Run: chmod 700 ~/.openclaw/logs',
            autoFix: async () => {
              chmodSync(logDir, 0o700);
            }
          });
        }
      }
    }

    // Check 9: Workspace permissions
    if (platform() !== 'win32') {
      results.maxScore += 5;
      const workspaceDir = join(homedir(), '.openclaw', 'workspace');
      if (existsSync(workspaceDir)) {
        const wsStats = await checkFilePermissions(workspaceDir);
        if (wsStats.ownerOnly) {
          results.score += 5;
          results.passed.push('Workspace directory permissions are secure');
        } else {
          results.warnings.push({
            severity: 'low',
            title: 'Workspace directory readable by others',
            description: 'Consider restricting workspace permissions',
            fix: 'Run: chmod 700 ~/.openclaw/workspace'
          });
        }
      }
    }

    spinner.stop();

    // Calculate grade
    const percentage = (results.score / results.maxScore) * 100;
    let grade, gradeColor;
    if (percentage >= 90) {
      grade = 'A';
      gradeColor = chalk.green;
    } else if (percentage >= 80) {
      grade = 'B';
      gradeColor = chalk.green;
    } else if (percentage >= 70) {
      grade = 'C';
      gradeColor = chalk.yellow;
    } else if (percentage >= 60) {
      grade = 'D';
      gradeColor = chalk.yellow;
    } else {
      grade = 'F';
      gradeColor = chalk.red;
    }

    // Print results
    console.log(chalk.bold('\n🔒 Security Audit Results\n'));
    console.log(`Score: ${gradeColor(`${results.score}/${results.maxScore} (${grade})`)}\n`);

    if (results.passed.length > 0) {
      console.log(chalk.green.bold('✓ Passed Checks:'));
      results.passed.forEach(p => console.log(chalk.green(`  ✓ ${p}`)));
      console.log();
    }

    if (results.warnings.length > 0) {
      console.log(chalk.yellow.bold('⚠ Warnings:'));
      results.warnings.forEach(w => {
        console.log(chalk.yellow(`  ⚠ ${w.title}`));
        console.log(chalk.gray(`    ${w.description}`));
        if (w.fix) console.log(chalk.gray(`    Fix: ${w.fix}`));
      });
      console.log();
    }

    if (results.issues.length > 0) {
      console.log(chalk.red.bold('✗ Issues Found:'));
      results.issues.forEach(i => {
        const severityColor = i.severity === 'high' ? chalk.red : i.severity === 'medium' ? chalk.yellow : chalk.gray;
        console.log(severityColor(`  ✗ [${i.severity.toUpperCase()}] ${i.title}`));
        console.log(chalk.gray(`    ${i.description}`));
        if (i.fix) console.log(chalk.gray(`    Fix: ${i.fix}`));
      });
      console.log();
    }

    // Auto-fix if requested
    if (fix && results.issues.length > 0) {
      const fixableIssues = results.issues.filter(i => i.autoFix);
      if (fixableIssues.length > 0) {
        console.log(chalk.cyan('Applying automatic fixes...\n'));
        for (const issue of fixableIssues) {
          if (dryRun) {
            console.log(chalk.gray(`[DRY-RUN] Would fix: ${issue.title}`));
          } else {
            try {
              await issue.autoFix();
              console.log(chalk.green(`✓ Fixed: ${issue.title}`));
            } catch (error) {
              console.log(chalk.red(`✗ Failed to fix: ${issue.title} - ${error.message}`));
            }
          }
        }
      }
    }

    return results;
  } catch (error) {
    spinner.fail('Security audit failed');
    logger.error('Audit error', error);
    throw error;
  }
}

/**
 * Check file permissions
 * @param {string} filePath - Path to check
 * @returns {Promise<Object>} Permission check result
 */
async function checkFilePermissions(filePath) {
  try {
    const { stdout } = await executeCommand(`stat -f "%OLp" "${filePath}"`).catch(() =>
      executeCommand(`stat -c "%a" "${filePath}"`)
    );
    const mode = stdout.trim();
    const modeNum = parseInt(mode, 8);

    return {
      mode,
      secure: modeNum <= 0o700,
      ownerOnly: (modeNum & 0o077) === 0
    };
  } catch {
    return { mode: 'unknown', secure: false, ownerOnly: false };
  }
}

/**
 * Apply security profile
 * @param {string} profileName - Profile name
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result
 */
async function applySecurityProfile(profileName, options) {
  const { dryRun = false } = options;
  const profile = SECURITY_PROFILES[profileName];

  if (!profile) {
    console.log(chalk.red(`Unknown profile: ${profileName}`));
    console.log('Available profiles:', Object.keys(SECURITY_PROFILES).join(', '));
    return { success: false };
  }

  console.log(chalk.bold(`\nApplying '${profile.name}' security profile...\n`));
  console.log(chalk.gray(profile.description));
  console.log();

  const configPath = join(homedir(), '.openclaw', 'openclaw.json');

  if (dryRun) {
    console.log(chalk.cyan('[DRY-RUN] Would apply settings:'));
    console.log(JSON.stringify(profile.settings, null, 2));
    return { success: true, simulated: true };
  }

  updateOpenClawConfig((_, tools) => {
    tools.merge('security', profile.settings);

    if (Array.isArray(profile.settings.trustedProxies)) {
      tools.set('gateway.trustedProxies', profile.settings.trustedProxies);
    }

    if (profile.settings.pairing === true) {
      const channels = ['telegram', 'imessage', 'whatsapp', 'discord', 'slack'];
      for (const channel of channels) {
        const channelConfig = tools.get(`channels.${channel}`);
        if (channelConfig && typeof channelConfig === 'object') {
          const currentPolicy = tools.get(`channels.${channel}.dmPolicy`);
          if (!currentPolicy || currentPolicy === 'open') {
            tools.set(`channels.${channel}.dmPolicy`, 'pairing');
          }
        }
      }
    }

    if (profile.settings.pairing === false) {
      const channels = ['telegram', 'imessage', 'whatsapp', 'discord', 'slack'];
      for (const channel of channels) {
        const channelConfig = tools.get(`channels.${channel}`);
        if (channelConfig && typeof channelConfig === 'object') {
          const currentPolicy = tools.get(`channels.${channel}.dmPolicy`);
          if (!currentPolicy) {
            tools.set(`channels.${channel}.dmPolicy`, 'open');
          }
        }
      }
    }
  }, { backup: true, create: true });

  // Fix file permissions on Unix
  if (platform() !== 'win32') {
    chmodSync(configPath, 0o600);
  }

  console.log(chalk.green(`✓ Applied '${profile.name}' security profile`));
  console.log(chalk.gray('\nRestart OpenClaw gateway for changes to take effect:'));
  console.log(chalk.cyan('  openclaw gateway restart'));

  return { success: true, profile: profileName };
}

/**
 * Interactive security setup
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result
 */
async function interactiveSecuritySetup(options) {
  console.log(chalk.bold('\n🔒 OpenClaw Security Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: 'Select a security profile:',
      choices: Object.entries(SECURITY_PROFILES).map(([key, value]) => ({
        name: `${value.name} - ${value.description}`,
        value: key
      }))
    },
    {
      type: 'confirm',
      name: 'customize',
      message: 'Do you want to customize individual settings?',
      default: false
    }
  ]);

  if (!answers.customize) {
    return await applySecurityProfile(answers.profile, options);
  }

  // Custom settings
  const customAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'pairing',
      message: 'Enable pairing mode (require approval for new devices)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'webhookVerification',
      message: 'Enable webhook signature verification?',
      default: true
    },
    {
      type: 'confirm',
      name: 'rateLimiting',
      message: 'Enable rate limiting?',
      default: true
    },
    {
      type: 'input',
      name: 'trustedProxies',
      message: 'Trusted proxy IPs (comma-separated, or leave empty):',
      default: '127.0.0.1, ::1',
      filter: (input) => input.split(',').map(s => s.trim()).filter(Boolean)
    }
  ]);

  const configPath = join(homedir(), '.openclaw', 'openclaw.json');

  const plannedSecurityConfig = {
    pairing: customAnswers.pairing,
    webhookVerification: customAnswers.webhookVerification,
    rateLimiting: customAnswers.rateLimiting,
    trustedProxies: customAnswers.trustedProxies,
  };

  if (options.dryRun) {
    console.log(chalk.cyan('\n[DRY-RUN] Would save settings:'));
    console.log(JSON.stringify(plannedSecurityConfig, null, 2));
    return { success: true, simulated: true };
  }

  updateOpenClawConfig((_, tools) => {
    tools.merge('security', plannedSecurityConfig);
    tools.set('gateway.trustedProxies', customAnswers.trustedProxies);

    const channels = ['telegram', 'imessage', 'whatsapp', 'discord', 'slack'];
    for (const channel of channels) {
      const channelConfig = tools.get(`channels.${channel}`);
      if (!channelConfig || typeof channelConfig !== 'object') continue;

      const currentPolicy = tools.get(`channels.${channel}.dmPolicy`);
      if (!currentPolicy || currentPolicy === 'open' || currentPolicy === 'pairing') {
        tools.set(`channels.${channel}.dmPolicy`, customAnswers.pairing ? 'pairing' : 'open');
      }
    }
  }, { backup: true, create: true });

  if (platform() !== 'win32') {
    chmodSync(configPath, 0o600);
  }

  console.log(chalk.green('\n✓ Security settings saved'));
  console.log(chalk.gray('\nRestart OpenClaw gateway for changes to take effect:'));
  console.log(chalk.cyan('  openclaw gateway restart'));

  return { success: true, custom: true };
}

export default securityCommand;

/**
 * Collect DM policies across common channels.
 * @param {Object} config
 * @returns {Array<{channel: string, policy: string}>}
 */
function getDmPolicies(config) {
  const channels = ['whatsapp', 'telegram', 'signal', 'imessage', 'mattermost', 'googlechat'];
  const policies = [];

  for (const channel of channels) {
    const value = config.channels?.[channel];
    if (!value) continue;
    const policy = value.dmPolicy || value.dm?.policy;
    if (policy) {
      policies.push({ channel, policy });
    }
  }

  return policies;
}
