/**
 * Skill Manager Module
 * Discovers and manages skills from ~/.openclaw/workspace/skills/
 * @module core/skill-manager
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { commandExists } from './utils.js';
import logger from './logger.js';

const SKILLS_DIR = join(homedir(), '.openclaw', 'workspace', 'skills');

/**
 * Skill category mappings
 */
const SKILL_CATEGORIES = {
  Productivity: ['todo', 'notes', 'tasks', 'reminder', 'timer', 'pomodoro'],
  Communication: ['email', 'gmail', 'slack', 'teams', 'chat', 'sms', 'imessage'],
  Calendar: ['calendar', 'schedule', 'events', 'meeting', 'gcal'],
  Development: ['git', 'github', 'code', 'debug', 'deploy', 'docker', 'ci'],
  Media: ['image', 'photo', 'video', 'audio', 'music', 'podcast'],
};

/**
 * Skill Manager
 */
class SkillManager {
  constructor() {
    this.skills = [];
  }

  /**
   * Discover skills from the skills directory
   * @returns {Promise<Array>} Array of discovered skill objects
   */
  async discoverSkills() {
    this.skills = [];

    if (!existsSync(SKILLS_DIR)) {
      logger.warn(`Skills directory not found: ${SKILLS_DIR}`);
      return this.skills;
    }

    try {
      const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory());

      for (const dir of skillDirs) {
        const skillPath = join(SKILLS_DIR, dir.name);
        const skillMdPath = join(skillPath, 'SKILL.md');

        if (!existsSync(skillMdPath)) {
          logger.debug(`No SKILL.md found in ${dir.name}, skipping`);
          continue;
        }

        try {
          const content = readFileSync(skillMdPath, 'utf-8');
          const skill = this.parseSkillMd(content, dir.name, skillPath);
          if (skill) {
            skill.prerequisites = await this.checkSkillPrerequisites(skill);
            this.skills.push(skill);
          }
        } catch (error) {
          logger.debug(`Failed to parse skill ${dir.name}: ${error.message}`);
        }
      }

      logger.debug(`Discovered ${this.skills.length} skills`);
    } catch (error) {
      logger.error('Failed to discover skills', error);
    }

    return this.skills;
  }

  /**
   * Parse SKILL.md YAML frontmatter and content
   * @param {string} content - File content
   * @param {string} dirName - Directory name
   * @param {string} skillPath - Full path to skill directory
   * @returns {Object|null} Parsed skill object
   */
  parseSkillMd(content, dirName, skillPath) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    const skill = {
      name: dirName,
      path: skillPath,
      title: dirName,
      description: '',
      category: 'Uncategorized',
      requires: { bins: [] },
    };

    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];

      // Simple YAML parsing for the fields we need
      const nameMatch = yaml.match(/^name:\s*(.+)$/m);
      if (nameMatch) skill.title = nameMatch[1].trim().replace(/^["']|["']$/g, '');

      const descMatch = yaml.match(/^description:\s*(.+)$/m);
      if (descMatch) skill.description = descMatch[1].trim().replace(/^["']|["']$/g, '');

      const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
      if (categoryMatch) skill.category = categoryMatch[1].trim().replace(/^["']|["']$/g, '');

      // Parse requires.bins array
      const binsSection = yaml.match(/bins:\s*\n((?:\s+-\s+.+\n?)*)/);
      if (binsSection) {
        const bins = binsSection[1].match(/-\s+(.+)/g);
        if (bins) {
          skill.requires.bins = bins.map(b => b.replace(/^-\s+/, '').trim().replace(/^["']|["']$/g, ''));
        }
      }
    }

    // Auto-categorize if no category in frontmatter
    if (skill.category === 'Uncategorized') {
      skill.category = this.categorizeSkill(skill.name);
    }

    return skill;
  }

  /**
   * Auto-categorize a skill by name
   * @param {string} name - Skill name
   * @returns {string} Category name
   */
  categorizeSkill(name) {
    const lower = name.toLowerCase();
    for (const [category, keywords] of Object.entries(SKILL_CATEGORIES)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return category;
      }
    }
    return 'Uncategorized';
  }

  /**
   * Check prerequisites for a skill
   * @param {Object} skill - Skill object
   * @returns {Promise<Object>} Prerequisites status
   */
  async checkSkillPrerequisites(skill) {
    const result = { met: true, missing: [] };

    if (!skill.requires?.bins?.length) {
      return result;
    }

    for (const bin of skill.requires.bins) {
      const exists = await commandExists(bin);
      if (!exists) {
        result.met = false;
        result.missing.push(bin);
      }
    }

    return result;
  }

  /**
   * Print a summary of discovered skills with prerequisite status
   */
  printSkillSummary() {
    if (this.skills.length === 0) {
      console.log(chalk.gray('  No skills discovered'));
      return;
    }

    // Group by category
    const grouped = {};
    for (const skill of this.skills) {
      const cat = skill.category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(skill);
    }

    for (const [category, skills] of Object.entries(grouped)) {
      console.log(chalk.bold(`\n  ${category}:`));
      for (const skill of skills) {
        const prereqStatus = skill.prerequisites?.met
          ? chalk.green('ready')
          : chalk.yellow(`missing: ${skill.prerequisites?.missing?.join(', ')}`);
        const title = skill.title || skill.name;
        const desc = skill.description ? chalk.gray(` - ${skill.description}`) : '';
        console.log(`    ${chalk.cyan(title)}${desc} [${prereqStatus}]`);
      }
    }
  }

  /**
   * Run the interactive skill selection wizard
   * @param {Object} options - Options from CLI (--yes, --dry-run)
   * @returns {Promise<Object>} Result with selected skills
   */
  async runSkillWizard(options = {}) {
    const result = { selected: [], skipped: [], errors: [] };

    console.log(chalk.bold('\n  Discovering available skills...'));
    const skills = await this.discoverSkills();

    if (skills.length === 0) {
      console.log(chalk.gray('  No skills found in workspace'));
      result.skipped.push('no-skills-found');
      return result;
    }

    this.printSkillSummary();

    if (options.dryRun) {
      console.log(chalk.gray('\n  [dry-run] Would prompt for skill selection'));
      return result;
    }

    if (options.yes) {
      // Auto-select all skills with met prerequisites
      const ready = skills.filter(s => s.prerequisites?.met);
      result.selected = ready.map(s => s.name);
      console.log(chalk.green(`\n  Auto-selected ${ready.length} skills with met prerequisites`));
      return result;
    }

    // Group skills for checkbox prompt
    const grouped = {};
    for (const skill of skills) {
      const cat = skill.category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(skill);
    }

    // Build choices with separators for categories
    const choices = [];
    for (const [category, catSkills] of Object.entries(grouped)) {
      choices.push(new inquirer.Separator(`--- ${category} ---`));
      for (const skill of catSkills) {
        const prereqNote = skill.prerequisites?.met
          ? ''
          : chalk.yellow(` (missing: ${skill.prerequisites?.missing?.join(', ')})`);
        choices.push({
          name: `${skill.title || skill.name}${prereqNote}`,
          value: skill.name,
          checked: skill.prerequisites?.met,
        });
      }
    }

    const { selectedSkills } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedSkills',
      message: 'Select skills to enable:',
      choices,
      pageSize: 20,
    }]);

    result.selected = selectedSkills;

    // Warn about skills with missing prerequisites
    for (const name of selectedSkills) {
      const skill = skills.find(s => s.name === name);
      if (skill && !skill.prerequisites?.met) {
        console.log(chalk.yellow(`  Warning: ${skill.title} has unmet prerequisites: ${skill.prerequisites.missing.join(', ')}`));
      }
    }

    return result;
  }
}

export default new SkillManager();
