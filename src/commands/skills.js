/**
 * Skills Command - Browse, install, and manage OpenClaw skills
 * @module commands/skills
 */

import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import marketplace from '../skills/marketplace.js';
import logger from '../core/logger.js';

/**
 * Execute skills command
 * @param {string} [action] - Action: list, search, install, uninstall, update, catalog
 * @param {Object} options - Command options
 */
export async function skillsCommand(action, options = {}) {
  try {
    await marketplace.initialize();

    // If no action, show interactive menu
    if (!action) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'Skills management:',
        choices: [
          { name: 'List installed skills', value: 'list' },
          { name: 'Browse skill catalog', value: 'catalog' },
          { name: 'Search skills', value: 'search' },
          { name: 'Install a skill', value: 'install' },
          { name: 'Uninstall a skill', value: 'uninstall' },
          { name: 'Update a skill', value: 'update' },
          new inquirer.Separator(),
          { name: 'Cancel', value: 'cancel' },
        ],
      }]);

      if (choice === 'cancel') return;
      action = choice;
    }

    switch (action) {
      case 'list':
        await listInstalled();
        break;
      case 'catalog':
        await showCatalog(options);
        break;
      case 'search':
        await searchSkills(options);
        break;
      case 'install':
        await installSkill(options);
        break;
      case 'uninstall':
        await uninstallSkill(options);
        break;
      case 'update':
        await updateSkill(options);
        break;
      default:
        console.log(chalk.red(`  Unknown action: ${action}`));
        console.log(chalk.gray('  Actions: list, catalog, search, install, uninstall, update'));
    }
  } catch (error) {
    logger.error('Skills command failed', error);
    console.log(chalk.red(`\nSkills command failed: ${error.message}`));
  }
}

/**
 * List installed skills
 */
async function listInstalled() {
  const installed = await marketplace.getInstalled();

  if (installed.length === 0) {
    console.log(chalk.gray('  No skills installed'));
    console.log(chalk.gray('  Browse available skills: openclaw-easyset skills catalog'));
    return;
  }

  console.log(chalk.bold(`\n  Installed Skills (${installed.length}):\n`));

  for (const skill of installed) {
    const location = skill.location === 'builtin' ? chalk.gray(' [builtin]') : '';
    const desc = skill.description ? chalk.gray(` - ${skill.description}`) : '';
    console.log(`    ${chalk.cyan(skill.name)}${desc}${location}`);
  }
  console.log('');
}

/**
 * Show skill catalog
 * @param {Object} options - Options
 */
async function showCatalog(options) {
  const catalog = await marketplace.fetchCatalog({ category: options.category });
  const categories = marketplace.getCategories();

  console.log(chalk.bold('\n  Skill Catalog:\n'));

  // Group by category
  const grouped = {};
  for (const skill of catalog) {
    const cat = skill.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(skill);
  }

  for (const category of categories) {
    const skills = grouped[category.id];
    if (!skills || skills.length === 0) continue;

    console.log(chalk.bold(`  ${category.name}:`));
    for (const skill of skills) {
      const desc = skill.description ? chalk.gray(` - ${skill.description}`) : '';
      const author = skill.author ? chalk.gray(` (${skill.author})`) : '';
      console.log(`    ${chalk.cyan(skill.name)}${desc}${author}`);
    }
    console.log('');
  }
}

/**
 * Search skills
 * @param {Object} options - Options
 */
async function searchSkills(options) {
  let query = options.query;

  if (!query) {
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Search query:',
      validate: input => input.trim() ? true : 'Please enter a search query',
    }]);
    query = answer.query;
  }

  const results = await marketplace.search(query, { installed: true });

  if (results.length === 0) {
    console.log(chalk.gray(`  No skills found matching "${query}"`));
    return;
  }

  console.log(chalk.bold(`\n  Results for "${query}" (${results.length}):\n`));
  for (const skill of results) {
    const desc = skill.description ? chalk.gray(` - ${skill.description}`) : '';
    console.log(`    ${chalk.cyan(skill.name)}${desc}`);
  }
  console.log('');
}

/**
 * Install a skill
 * @param {Object} options - Options
 */
async function installSkill(options) {
  let skillName = options.name;

  if (!skillName) {
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Skill name or git URL:',
      validate: input => input.trim() ? true : 'Please enter a skill name or URL',
    }]);
    skillName = answer.name;
  }

  const result = await marketplace.install(skillName, {
    dryRun: options.dryRun,
    force: options.force,
  });

  if (result.success) {
    console.log(chalk.green(`  Skill "${skillName}" installed at ${result.path}`));
  } else {
    console.log(chalk.red(`  Failed: ${result.error}`));
  }
}

/**
 * Uninstall a skill
 * @param {Object} options - Options
 */
async function uninstallSkill(options) {
  const installed = await marketplace.getInstalled();
  const userSkills = installed.filter(s => s.location !== 'builtin');

  if (userSkills.length === 0) {
    console.log(chalk.gray('  No user-installed skills to uninstall'));
    return;
  }

  let skillName = options.name;

  if (!skillName) {
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'name',
      message: 'Which skill to uninstall?',
      choices: userSkills.map(s => ({
        name: `${s.name}${s.description ? ` - ${s.description}` : ''}`,
        value: s.name,
      })),
    }]);
    skillName = answer.name;
  }

  const result = await marketplace.uninstall(skillName, { dryRun: options.dryRun });

  if (result.success) {
    console.log(chalk.green(`  Skill "${skillName}" uninstalled`));
  } else {
    console.log(chalk.red(`  Failed: ${result.error}`));
  }
}

/**
 * Update a skill
 * @param {Object} options - Options
 */
async function updateSkill(options) {
  const installed = await marketplace.getInstalled();
  const updatable = installed.filter(s => s.location !== 'builtin');

  if (updatable.length === 0) {
    console.log(chalk.gray('  No updatable skills found'));
    return;
  }

  let skillName = options.name;

  if (!skillName) {
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'name',
      message: 'Which skill to update?',
      choices: updatable.map(s => ({
        name: s.name,
        value: s.name,
      })),
    }]);
    skillName = answer.name;
  }

  const result = await marketplace.update(skillName, { dryRun: options.dryRun });

  if (result.success) {
    console.log(chalk.green(`  Skill "${skillName}" updated`));
  } else {
    console.log(chalk.red(`  Failed: ${result.error}`));
  }
}

export default skillsCommand;
