/**
 * Doctor Command - Comprehensive health check and auto-fix
 * @module commands/doctor
 */

import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import healthChecker from '../core/health-checker.js';
import logger from '../core/logger.js';

/**
 * Execute doctor command
 * @param {Object} options - Command options
 */
export async function doctorCommand(options) {
  try {
    console.log(boxen(chalk.bold.blue('OpenClaw EasySet - Health Check'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
    }));

    console.log(chalk.gray('  Running diagnostics...\n'));

    // Run all checks
    const results = await healthChecker.runAll();
    const summary = healthChecker.printResults();

    // Auto-fix mode
    if (options.fix) {
      const fixableResults = results.filter(
        r => (r.status === 'fail' || r.status === 'warn') && r.fix
      );

      if (fixableResults.length === 0) {
        console.log(chalk.green('\n  No auto-fixable issues found.'));
        return;
      }

      console.log(chalk.bold(`\n  Auto-fixing ${fixableResults.length} issue(s)...\n`));

      const fixes = await healthChecker.autoFix();
      for (const fix of fixes) {
        const icon = fix.success ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${fix.check}: ${fix.action}`);
      }

      const fixedCount = fixes.filter(f => f.success).length;
      console.log(chalk.bold(`\n  Fixed ${fixedCount}/${fixes.length} issues`));

      if (fixedCount > 0) {
        console.log(chalk.gray('  Run "openclaw-easyset doctor" again to verify'));
      }
    } else if (summary.failCount > 0 || summary.warnCount > 0) {
      const fixable = results.filter(
        r => (r.status === 'fail' || r.status === 'warn') && r.fix
      );

      if (fixable.length > 0) {
        console.log(chalk.gray(`\n  ${fixable.length} issue(s) can be auto-fixed. Run with --fix to attempt repairs.`));
      }
    }

    // JSON output
    if (options.json) {
      console.log('\n' + JSON.stringify({
        results,
        summary: {
          pass: summary.passCount,
          warn: summary.warnCount,
          fail: summary.failCount,
          score: summary.score,
        },
      }, null, 2));
    }

  } catch (error) {
    logger.error('Health check failed', error);
    console.log(chalk.red(`\nHealth check failed: ${error.message}`));
  }
}
