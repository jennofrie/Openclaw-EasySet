/**
 * Detect Command - Platform detection command for CLI
 * @module commands/detect
 */

import platformDetector from '../core/platform-detector.js';
import logger from '../core/logger.js';
import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Execute detect command
 * @param {Object} options - Command options
 */
export async function detectCommand(options) {
  try {
    console.log(boxen(chalk.bold.blue('OpenClaw EasySet - Platform Detection'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
    }));

    // Run detection
    const platformInfo = await platformDetector.detect();

    // Print summary
    platformDetector.printSummary();

    // Show recommendations
    if (options.recommendations) {
      console.log('\n💡 Recommendations\n');
      const recommendations = platformDetector.getRecommendations();

      if (recommendations.warnings.length > 0) {
        console.log(chalk.yellow('Warnings:'));
        recommendations.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
      }

      if (recommendations.notes.length > 0) {
        console.log(chalk.blue('\nNotes:'));
        recommendations.notes.forEach(n => console.log(`  ℹ️  ${n}`));
      }

      console.log(chalk.green(`\nRecommended mode: ${recommendations.mode}`));
    }

    // JSON output
    if (options.json) {
      console.log('\n' + JSON.stringify(platformInfo, null, 2));
    }

    logger.success('Platform detection complete');
  } catch (error) {
    logger.error('Platform detection failed', error);
    process.exit(1);
  }
}
