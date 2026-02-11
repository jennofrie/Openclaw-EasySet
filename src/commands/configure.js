/**
 * Configure Command - Post-install configuration for subsystems
 * @module commands/configure
 */

import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import pluginManager from '../core/plugin-manager.js';
import skillManager from '../core/skill-manager.js';
import gogSetup from '../core/gog-setup.js';
import platformDetector from '../core/platform-detector.js';
import logger from '../core/logger.js';

/**
 * Execute configure command
 * @param {string} [section] - Optional section: 'plugins', 'skills', 'gog'
 * @param {Object} options - Command options
 */
export async function configureCommand(section, options) {
  try {
    console.log(boxen(chalk.bold.blue('OpenClaw EasySet - Configuration'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
    }));

    // If no section specified, show interactive menu
    if (!section) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'What would you like to configure?',
        choices: [
          { name: 'Plugins (Memory LanceDB, LLM Task)', value: 'plugins' },
          { name: 'Skills (Discover & enable workspace skills)', value: 'skills' },
          { name: 'Google Workspace (gog CLI)', value: 'gog' },
          { name: 'All', value: 'all' },
          new inquirer.Separator(),
          { name: 'Cancel', value: 'cancel' },
        ],
      }]);

      if (choice === 'cancel') {
        console.log(chalk.gray('  Configuration cancelled'));
        return;
      }

      section = choice;
    }

    if (section === 'all') {
      await configurePlugins(options);
      await configureGog(options);
      await configureSkills(options);
    } else if (section === 'plugins') {
      await configurePlugins(options);
    } else if (section === 'skills') {
      await configureSkills(options);
    } else if (section === 'gog') {
      await configureGog(options);
    } else {
      console.log(chalk.red(`  Unknown section: ${section}`));
      console.log(chalk.gray('  Valid sections: plugins, skills, gog'));
      return;
    }

    logger.success('Configuration complete');
  } catch (error) {
    logger.error('Configuration failed', error);
    console.log(chalk.red(`\nConfiguration failed: ${error.message}`));
  }
}

/**
 * Configure plugins subsystem
 * @param {Object} options
 */
async function configurePlugins(options) {
  console.log(chalk.bold.underline('\nPlugin Configuration\n'));

  // Show current status
  const config = pluginManager.loadOpenClawConfig();
  if (config) {
    const enabled = pluginManager.getEnabledPlugins();
    const pluginNames = Object.keys(enabled);

    if (pluginNames.length > 0) {
      console.log(chalk.bold('  Currently enabled plugins:'));
      for (const [name, entry] of Object.entries(enabled)) {
        console.log(chalk.green(`    ✓ ${name}`));
        if (entry.config?.defaultProvider) {
          console.log(chalk.gray(`      Provider: ${entry.config.defaultProvider}, Model: ${entry.config.defaultModel}`));
        }
        if (entry.config?.embedding?.model) {
          console.log(chalk.gray(`      Embedding: ${entry.config.embedding.model}`));
        }
      }
      console.log('');
    } else {
      console.log(chalk.gray('  No plugins currently enabled\n'));
    }
  }

  await pluginManager.runPluginWizard({
    yes: options.yes,
    dryRun: options.dryRun,
  });
}

/**
 * Configure skills subsystem
 * @param {Object} options
 */
async function configureSkills(options) {
  console.log(chalk.bold.underline('\nSkills Configuration\n'));

  await skillManager.runSkillWizard({
    yes: options.yes,
    dryRun: options.dryRun,
  });
}

/**
 * Configure gog subsystem
 * @param {Object} options
 */
async function configureGog(options) {
  console.log(chalk.bold.underline('\nGoogle Workspace (gog) Configuration\n'));

  // Detect platform for brew availability
  const platformInfo = await platformDetector.detect();

  await gogSetup.runSetup(platformInfo, {
    yes: options.yes,
    dryRun: options.dryRun,
  });
}
