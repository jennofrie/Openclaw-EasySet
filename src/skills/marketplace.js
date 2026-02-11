/**
 * Skills Marketplace Module
 * Browse, install, and manage OpenClaw skills from ClawHub
 * @module skills/marketplace
 */

import { homedir } from 'os';
import { join, basename } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs';
import { executeCommand, commandExists } from '../core/utils.js';
import logger from '../core/logger.js';
import axios from 'axios';

/**
 * ClawHub API URL
 */
const CLAWHUB_API = 'https://clawhub.com/api';
const CLAWHUB_REGISTRY = 'https://clawhub.com/skills';

/**
 * Skills Marketplace Class
 */
class SkillsMarketplace {
  constructor() {
    this.skillsDir = join(homedir(), '.openclaw', 'workspace', 'skills');
    this.builtinSkillsDir = null; // Set after detecting OpenClaw install
    this.cache = new Map();
  }

  /**
   * Initialize marketplace
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create skills directory if it doesn't exist
    if (!existsSync(this.skillsDir)) {
      mkdirSync(this.skillsDir, { recursive: true });
    }

    // Try to find builtin skills directory
    try {
      const { stdout } = await executeCommand('npm root -g');
      const globalRoot = stdout.trim();
      const openclawSkills = join(globalRoot, 'openclaw', 'skills');
      if (existsSync(openclawSkills)) {
        this.builtinSkillsDir = openclawSkills;
      }
    } catch {
      // Ignore - builtin skills dir not found
    }
  }

  /**
   * Fetch skills catalog from ClawHub
   * @param {Object} options - Fetch options
   * @returns {Promise<Array>} Skills list
   */
  async fetchCatalog(options = {}) {
    const { category = null, search = null, limit = 50 } = options;

    logger.info('Fetching skills catalog from ClawHub...');

    try {
      // Try to fetch from ClawHub API
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('q', search);
      params.append('limit', limit.toString());

      const response = await axios.get(`${CLAWHUB_API}/skills?${params}`, {
        timeout: 10000
      });

      if (response.data && response.data.skills) {
        return response.data.skills;
      }
    } catch (error) {
      logger.warn('Could not fetch from ClawHub API, using builtin catalog');
    }

    // Fallback to builtin catalog
    return this.getBuiltinCatalog();
  }

  /**
   * Get builtin skills catalog
   * @returns {Array} Builtin skills
   */
  getBuiltinCatalog() {
    return [
      {
        name: 'github',
        description: 'Interact with GitHub using the gh CLI',
        category: 'development',
        author: 'openclaw',
        version: '1.0.0',
        requirements: { bins: ['gh'] },
        builtin: true
      },
      {
        name: 'gog',
        description: 'Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, and Docs',
        category: 'productivity',
        author: 'openclaw',
        version: '1.0.0',
        requirements: { bins: ['gog'] },
        builtin: true
      },
      {
        name: 'weather',
        description: 'Get current weather and forecasts (no API key required)',
        category: 'utilities',
        author: 'openclaw',
        version: '1.0.0',
        requirements: {},
        builtin: true
      },
      {
        name: 'openai-image-gen',
        description: 'Batch-generate images via OpenAI Images API',
        category: 'ai',
        author: 'openclaw',
        version: '1.0.0',
        requirements: { env: ['OPENAI_API_KEY'] },
        builtin: true
      },
      {
        name: 'openai-whisper-api',
        description: 'Transcribe audio via OpenAI Audio Transcriptions API (Whisper)',
        category: 'ai',
        author: 'openclaw',
        version: '1.0.0',
        requirements: { env: ['OPENAI_API_KEY'] },
        builtin: true
      },
      {
        name: 'healthcheck',
        description: 'Host security hardening and risk-tolerance configuration',
        category: 'security',
        author: 'openclaw',
        version: '1.0.0',
        requirements: {},
        builtin: true
      },
      {
        name: 'imsg',
        description: 'iMessage/SMS CLI for listing chats, history, watch, and sending',
        category: 'communication',
        author: 'openclaw',
        version: '1.0.0',
        requirements: { bins: ['imsg'], platforms: ['darwin'] },
        builtin: true
      },
      {
        name: 'skill-creator',
        description: 'Create or update AgentSkills with scripts, references, and assets',
        category: 'development',
        author: 'openclaw',
        version: '1.0.0',
        requirements: {},
        builtin: true
      },
      {
        name: 'voice-call',
        description: 'Make phone calls with TTS voice using Twilio, Telnyx, or Plivo',
        category: 'communication',
        author: 'community',
        version: '1.0.0',
        requirements: { env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'] },
        builtin: false
      },
      {
        name: 'calendar',
        description: 'Access and manage macOS Calendar events using AppleScript',
        category: 'productivity',
        author: 'community',
        version: '1.0.0',
        requirements: { platforms: ['darwin'] },
        builtin: false
      },
      {
        name: 'reminders',
        description: 'Manage macOS Reminders - create, complete, and organize tasks',
        category: 'productivity',
        author: 'community',
        version: '1.0.0',
        requirements: { platforms: ['darwin'] },
        builtin: false
      },
      {
        name: 'notes',
        description: 'Read, create, and search Apple Notes using AppleScript',
        category: 'productivity',
        author: 'community',
        version: '1.0.0',
        requirements: { platforms: ['darwin'] },
        builtin: false
      }
    ];
  }

  /**
   * Get installed skills
   * @returns {Promise<Array>} Installed skills
   */
  async getInstalled() {
    const installed = [];

    // Check user skills directory
    if (existsSync(this.skillsDir)) {
      const dirs = readdirSync(this.skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const dir of dirs) {
        const skillPath = join(this.skillsDir, dir, 'SKILL.md');
        if (existsSync(skillPath)) {
          const info = this.parseSkillFile(skillPath);
          installed.push({
            name: dir,
            ...info,
            location: 'user',
            path: join(this.skillsDir, dir)
          });
        }
      }
    }

    // Check builtin skills
    if (this.builtinSkillsDir && existsSync(this.builtinSkillsDir)) {
      const dirs = readdirSync(this.builtinSkillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const dir of dirs) {
        const skillPath = join(this.builtinSkillsDir, dir, 'SKILL.md');
        if (existsSync(skillPath)) {
          const info = this.parseSkillFile(skillPath);
          installed.push({
            name: dir,
            ...info,
            location: 'builtin',
            path: join(this.builtinSkillsDir, dir)
          });
        }
      }
    }

    return installed;
  }

  /**
   * Parse SKILL.md file for metadata
   * @param {string} skillPath - Path to SKILL.md
   * @returns {Object} Skill metadata
   */
  parseSkillFile(skillPath) {
    try {
      const content = readFileSync(skillPath, 'utf-8');
      const lines = content.split('\n');

      // Parse YAML frontmatter if present
      let metadata = {};
      let inFrontmatter = false;
      let frontmatterContent = '';

      for (const line of lines) {
        if (line.trim() === '---') {
          if (!inFrontmatter) {
            inFrontmatter = true;
            continue;
          } else {
            break;
          }
        }
        if (inFrontmatter) {
          frontmatterContent += line + '\n';
        }
      }

      // Simple YAML parsing for basic fields
      const yamlLines = frontmatterContent.split('\n');
      for (const line of yamlLines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          metadata[match[1]] = match[2].trim();
        }
      }

      // Extract description from first paragraph
      const descMatch = content.match(/^#[^#].*?\n\n(.*?)(?:\n\n|$)/s);
      if (descMatch && !metadata.description) {
        metadata.description = descMatch[1].trim().substring(0, 200);
      }

      return metadata;
    } catch {
      return {};
    }
  }

  /**
   * Install a skill
   * @param {string} skillName - Skill name or git URL
   * @param {Object} options - Install options
   * @returns {Promise<Object>} Installation result
   */
  async install(skillName, options = {}) {
    const { dryRun = false, force = false } = options;

    logger.info(`Installing skill: ${skillName}`);

    // Check if already installed
    const installed = await this.getInstalled();
    const existing = installed.find(s => s.name === skillName);
    if (existing && !force) {
      return {
        success: false,
        error: `Skill '${skillName}' is already installed at ${existing.path}`,
        existing: true
      };
    }

    try {
      // Determine source
      const isGitUrl = skillName.includes('://') || skillName.includes('@');
      const skillPath = join(this.skillsDir, isGitUrl ? basename(skillName).replace('.git', '') : skillName);

      if (dryRun) {
        logger.info(`[DRY-RUN] Would install skill '${skillName}' to ${skillPath}`);
        return { success: true, simulated: true };
      }

      if (isGitUrl) {
        // Clone from git
        if (force && existsSync(skillPath)) {
          rmSync(skillPath, { recursive: true, force: true });
        }
        await executeCommand(`git clone "${skillName}" "${skillPath}"`);
      } else {
        // Try to fetch from ClawHub or use template
        const catalog = await this.fetchCatalog({ search: skillName });
        const skill = catalog.find(s => s.name === skillName);

        if (skill && skill.repository) {
          if (force && existsSync(skillPath)) {
            rmSync(skillPath, { recursive: true, force: true });
          }
          await executeCommand(`git clone "${skill.repository}" "${skillPath}"`);
        } else if (skill && skill.builtin) {
          return {
            success: false,
            error: `Skill '${skillName}' is a builtin skill and cannot be installed separately`,
            builtin: true
          };
        } else {
          return {
            success: false,
            error: `Skill '${skillName}' not found in ClawHub catalog`,
            notFound: true
          };
        }
      }

      // Verify installation
      const skillMdPath = join(skillPath, 'SKILL.md');
      if (!existsSync(skillMdPath)) {
        return {
          success: false,
          error: `Installed directory does not contain SKILL.md`,
          invalid: true
        };
      }

      logger.info(`Skill '${skillName}' installed successfully`);
      return {
        success: true,
        name: skillName,
        path: skillPath
      };
    } catch (error) {
      logger.error(`Failed to install skill: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Uninstall a skill
   * @param {string} skillName - Skill name
   * @param {Object} options - Uninstall options
   * @returns {Promise<Object>} Result
   */
  async uninstall(skillName, options = {}) {
    const { dryRun = false } = options;

    logger.info(`Uninstalling skill: ${skillName}`);

    const installed = await this.getInstalled();
    const skill = installed.find(s => s.name === skillName);

    if (!skill) {
      return {
        success: false,
        error: `Skill '${skillName}' is not installed`
      };
    }

    if (skill.location === 'builtin') {
      return {
        success: false,
        error: `Cannot uninstall builtin skill '${skillName}'`
      };
    }

    if (dryRun) {
      logger.info(`[DRY-RUN] Would remove skill from ${skill.path}`);
      return { success: true, simulated: true };
    }

    try {
      rmSync(skill.path, { recursive: true, force: true });
      logger.info(`Skill '${skillName}' uninstalled successfully`);
      return { success: true, name: skillName };
    } catch (error) {
      return {
        success: false,
        error: `Failed to uninstall: ${error.message}`
      };
    }
  }

  /**
   * Update a skill
   * @param {string} skillName - Skill name
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Result
   */
  async update(skillName, options = {}) {
    const { dryRun = false } = options;

    logger.info(`Updating skill: ${skillName}`);

    const installed = await this.getInstalled();
    const skill = installed.find(s => s.name === skillName);

    if (!skill) {
      return {
        success: false,
        error: `Skill '${skillName}' is not installed`
      };
    }

    if (skill.location === 'builtin') {
      return {
        success: false,
        error: `Builtin skill '${skillName}' is updated with OpenClaw`
      };
    }

    // Check if it's a git repository
    const gitDir = join(skill.path, '.git');
    if (!existsSync(gitDir)) {
      return {
        success: false,
        error: `Skill '${skillName}' is not a git repository and cannot be updated`
      };
    }

    if (dryRun) {
      logger.info(`[DRY-RUN] Would run git pull in ${skill.path}`);
      return { success: true, simulated: true };
    }

    try {
      await executeCommand(`git -C "${skill.path}" pull`);
      logger.info(`Skill '${skillName}' updated successfully`);
      return { success: true, name: skillName };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update: ${error.message}`
      };
    }
  }

  /**
   * Search skills
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    const { category = null, installed = false } = options;

    let skills = await this.fetchCatalog({ search: query, category });

    // Also search installed skills
    if (installed) {
      const installedSkills = await this.getInstalled();
      const matchingInstalled = installedSkills.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(query.toLowerCase()))
      );

      // Merge and deduplicate
      for (const skill of matchingInstalled) {
        if (!skills.find(s => s.name === skill.name)) {
          skills.push({ ...skill, installed: true });
        }
      }
    }

    return skills;
  }

  /**
   * Get skill categories
   * @returns {Array} Categories
   */
  getCategories() {
    return [
      { id: 'productivity', name: 'Productivity', emoji: '📊' },
      { id: 'communication', name: 'Communication', emoji: '💬' },
      { id: 'development', name: 'Development', emoji: '💻' },
      { id: 'ai', name: 'AI & ML', emoji: '🤖' },
      { id: 'utilities', name: 'Utilities', emoji: '🔧' },
      { id: 'security', name: 'Security', emoji: '🔒' },
      { id: 'automation', name: 'Automation', emoji: '⚡' },
      { id: 'entertainment', name: 'Entertainment', emoji: '🎮' }
    ];
  }

  /**
   * Check skill requirements
   * @param {Object} skill - Skill metadata
   * @returns {Promise<Object>} Requirements check result
   */
  async checkRequirements(skill) {
    const results = {
      satisfied: true,
      missing: [],
      warnings: []
    };

    const requirements = skill.requirements || {};

    // Check required binaries
    if (requirements.bins) {
      for (const bin of requirements.bins) {
        const exists = await commandExists(bin);
        if (!exists) {
          results.satisfied = false;
          results.missing.push({ type: 'binary', name: bin });
        }
      }
    }

    // Check environment variables
    if (requirements.env) {
      for (const envVar of requirements.env) {
        if (!process.env[envVar]) {
          results.warnings.push({ type: 'env', name: envVar });
        }
      }
    }

    // Check platform
    if (requirements.platforms) {
      const currentPlatform = process.platform;
      if (!requirements.platforms.includes(currentPlatform)) {
        results.satisfied = false;
        results.missing.push({
          type: 'platform',
          name: currentPlatform,
          required: requirements.platforms
        });
      }
    }

    return results;
  }
}

export default new SkillsMarketplace();
