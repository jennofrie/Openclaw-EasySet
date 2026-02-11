/**
 * Install Command - Main installation orchestrator
 * @module commands/install
 */

import chalk from 'chalk';
import boxen from 'boxen';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import platformDetector from '../core/platform-detector.js';
import pluginManager from '../core/plugin-manager.js';
import skillManager from '../core/skill-manager.js';
import gogSetup from '../core/gog-setup.js';
import { commandExists, createSpinner, executeCommand, printStatus } from '../core/utils.js';
import logger from '../core/logger.js';

const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json');

/**
 * Execute install command
 * @param {Object} options - Command options
 */
export async function installCommand(options) {
  const results = {
    steps: [],
    success: true,
  };

  try {
    console.log(boxen(chalk.bold.blue('OpenClaw EasySet - Installation'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
    }));

    if (options.dryRun) {
      console.log(chalk.yellow('  Running in dry-run mode - no changes will be made\n'));
    }

    // Step 1: Platform Detection
    console.log(chalk.bold.underline('\nStep 1/7: Platform Detection\n'));
    const platformResult = await runStep('Platform Detection', async () => {
      const platformInfo = await platformDetector.detect();
      platformDetector.printSummary();
      return { status: 'success', platformInfo };
    });
    results.steps.push(platformResult);

    const platformInfo = platformResult.data?.platformInfo;

    // Step 2: Check Existing Installation
    console.log(chalk.bold.underline('\nStep 2/7: Check Existing Installation\n'));
    const checkResult = await runStep('Check Existing', async () => {
      const openclawInstalled = await commandExists('openclaw');
      const configExists = existsSync(OPENCLAW_CONFIG);

      if (openclawInstalled) {
        printStatus('success', 'OpenClaw CLI is installed');
      } else {
        printStatus('warn', 'OpenClaw CLI not found');
      }

      if (configExists) {
        printStatus('success', 'OpenClaw config exists');
      } else {
        printStatus('warn', 'OpenClaw config not found');
      }

      return { status: 'success', openclawInstalled, configExists };
    });
    results.steps.push(checkResult);

    // Step 3: Install OpenClaw
    console.log(chalk.bold.underline('\nStep 3/7: Install OpenClaw\n'));
    const installResult = await runStep('Install OpenClaw', async () => {
      if (checkResult.data?.openclawInstalled) {
        console.log(chalk.green('  OpenClaw already installed, skipping'));
        return { status: 'skipped', reason: 'already-installed' };
      }

      if (options.dryRun) {
        console.log(chalk.gray('  [dry-run] Would run: npm install -g openclaw@latest'));
        return { status: 'dry-run' };
      }

      const spinner = createSpinner('Installing OpenClaw...');
      spinner.start();

      try {
        await executeCommand('npm install -g openclaw@latest');
        spinner.succeed('OpenClaw installed successfully');
        return { status: 'success' };
      } catch (error) {
        spinner.fail('OpenClaw installation failed');
        logger.warn(`Install failed: ${error.message}`);
        console.log(chalk.yellow('  You can install manually: npm install -g openclaw@latest'));
        return { status: 'failed', error: error.message };
      }
    });
    results.steps.push(installResult);

    // Step 4: Plugin Setup Wizard
    console.log(chalk.bold.underline('\nStep 4/7: Plugin Configuration\n'));
    const pluginResult = await runStep('Plugin Setup', async () => {
      const wizardResult = await pluginManager.runPluginWizard({
        yes: options.yes,
        dryRun: options.dryRun,
      });
      return { status: 'success', ...wizardResult };
    });
    results.steps.push(pluginResult);

    // Step 5: GOG CLI Setup
    console.log(chalk.bold.underline('\nStep 5/7: Google Workspace (gog) Setup\n'));
    const gogResult = await runStep('GOG Setup', async () => {
      const setupResult = await gogSetup.runSetup(platformInfo, {
        yes: options.yes,
        dryRun: options.dryRun,
      });
      return { status: setupResult.status, ...setupResult };
    });
    results.steps.push(gogResult);

    // Step 6: Skills Selection
    console.log(chalk.bold.underline('\nStep 6/7: Skills Selection\n'));
    const skillResult = await runStep('Skills Selection', async () => {
      const wizardResult = await skillManager.runSkillWizard({
        yes: options.yes,
        dryRun: options.dryRun,
      });
      return { status: 'success', ...wizardResult };
    });
    results.steps.push(skillResult);

    // Step 7: Final Validation
    console.log(chalk.bold.underline('\nStep 7/7: Final Validation\n'));
    const validationResult = await runStep('Validation', async () => {
      const checks = [];

      // Verify config is valid JSON
      if (existsSync(OPENCLAW_CONFIG) && !options.dryRun) {
        try {
          const { readFileSync } = await import('fs');
          JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'));
          checks.push({ name: 'Config valid JSON', passed: true });
          printStatus('success', 'openclaw.json is valid JSON');
        } catch {
          checks.push({ name: 'Config valid JSON', passed: false });
          printStatus('error', 'openclaw.json is NOT valid JSON');
        }
      }

      // Check OpenClaw command
      const clawExists = await commandExists('openclaw');
      checks.push({ name: 'OpenClaw CLI', passed: clawExists });
      printStatus(clawExists ? 'success' : 'warn', `OpenClaw CLI: ${clawExists ? 'available' : 'not found'}`);

      // Check gog
      const gogExists = await commandExists('gog');
      checks.push({ name: 'gog CLI', passed: gogExists });
      printStatus(gogExists ? 'success' : 'info', `gog CLI: ${gogExists ? 'available' : 'not found'}`);

      return { status: 'success', checks };
    });
    results.steps.push(validationResult);

    // Print final summary
    printFinalSummary(results, options);

  } catch (error) {
    logger.error('Installation failed', error);
    console.log(chalk.red(`\nInstallation failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Run a step with error handling (failures are non-fatal)
 * @param {string} name - Step name
 * @param {Function} fn - Async function to run
 * @returns {Promise<Object>} Step result
 */
async function runStep(name, fn) {
  try {
    const data = await fn();
    return { name, success: true, data };
  } catch (error) {
    logger.warn(`Step "${name}" failed: ${error.message}`);
    console.log(chalk.yellow(`  Warning: ${name} encountered an error: ${error.message}`));
    return { name, success: false, error: error.message, data: null };
  }
}

/**
 * Print the final installation summary
 * @param {Object} results - All step results
 * @param {Object} options - CLI options
 */
function printFinalSummary(results, options) {
  const lines = [chalk.bold('Installation Summary')];

  if (options.dryRun) {
    lines.push(chalk.yellow('(Dry Run - no changes were made)'));
  }

  lines.push('');

  for (const step of results.steps) {
    const icon = step.success ? chalk.green('✓') : chalk.yellow('⚠');
    const status = step.data?.status || (step.success ? 'done' : 'warning');
    lines.push(`${icon} ${step.name}: ${status}`);
  }

  console.log('\n' + boxen(lines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'green',
  }));

  if (!options.dryRun) {
    console.log(chalk.gray('  Run "openclaw-easyset configure" to modify settings later.'));
  }
}
