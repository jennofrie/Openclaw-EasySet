/**
 * OpenClaw Installation Command
 * Handles installation and configuration of OpenClaw
 * @module commands/install
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import platformDetector from '../core/platform-detector.js';
import { executeCommand, commandExists } from '../core/utils.js';
import logger from '../core/logger.js';
import { getWorkspaceTemplates } from '../templates/workspace.js';

/**
 * Install command handler
 * @param {Object} options - Command options
 */
export async function installCommand(options) {
  logger.info('Starting OpenClaw installation...');
  
  const spinner = ora('Detecting platform...').start();
  
  try {
    // Detect platform
    const platform = await platformDetector.detect();
    spinner.succeed('Platform detected');
    
    // Check requirements
    if (!platform.requirements.allMet) {
      spinner.fail('System requirements not met');
      console.log(chalk.red('\n⚠️  System Requirements Check Failed\n'));
      
      if (!platform.requirements.node.met) {
        console.log(chalk.yellow(`Node.js ${platform.requirements.node.required}+ required`));
        console.log(`Current version: ${platform.requirements.node.actual}`);
        console.log(`Download from: ${chalk.cyan('https://nodejs.org')}\n`);
      }
      
      if (!platform.requirements.memory.met) {
        console.log(chalk.yellow(`Minimum 4GB RAM recommended`));
        console.log(`Current memory: ${platform.requirements.memory.actual}\n`);
      }
      
      if (!options.force) {
        console.log(chalk.gray('Use --force to install anyway (not recommended)'));
        process.exit(1);
      }
    }
    
    // Interactive prompts (unless --yes flag)
    let config = {
      instanceName: 'profexor',
      emoji: '🦾',
      mode: options.mode || 'auto',
      channels: {
        telegram: false,
        whatsapp: false,
        webchat: true
      }
    };
    
    if (!options.yes) {
      config = await promptConfiguration(platform, options);
    }
    
    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.cyan('\n🔍 Dry Run Mode - No changes will be made\n'));
      printInstallationPlan(platform, config);
      return;
    }
    
    // Execute installation
    await executeInstallation(platform, config, options);
    
    console.log(chalk.green('\n✅ OpenClaw installation complete!\n'));
    printNextSteps(platform, config);
    
  } catch (error) {
    spinner.fail('Installation failed');
    logger.error('Installation error', error);
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * Prompt user for configuration
 * @param {Object} platform - Platform information
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Configuration
 */
async function promptConfiguration(platform, options) {
  console.log(chalk.cyan('\n🔧 OpenClaw Configuration Wizard\n'));
  
  const questions = [
    {
      type: 'input',
      name: 'instanceName',
      message: 'Instance name (e.g., profexor, tokyoneon):',
      default: platform.os.isWindows ? 'tokyoneon' : 'profexor',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Instance name is required';
        }
        if (!/^[a-z0-9-]+$/i.test(input)) {
          return 'Only letters, numbers, and hyphens allowed';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'emoji',
      message: 'Instance emoji:',
      default: (answers) => {
        const emojiMap = {
          profexor: '🦾',
          tokyoneon: '🌃',
          forge: '🔥'
        };
        return emojiMap[answers.instanceName.toLowerCase()] || '🦞';
      }
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Installation mode:',
      choices: [
        { name: 'Native (recommended)', value: 'native' },
        { name: 'Docker', value: 'docker' },
        { name: 'Auto-detect', value: 'auto' }
      ],
      default: 'native'
    },
    {
      type: 'checkbox',
      name: 'channels',
      message: 'Select communication channels:',
      choices: [
        { name: 'Telegram', value: 'telegram', checked: true },
        { name: 'WhatsApp (for brainstorming)', value: 'whatsapp', checked: false },
        { name: 'Webchat', value: 'webchat', checked: true },
        ...(platform.os.isMacOS ? [{ name: 'iMessage (macOS only)', value: 'imessage', checked: false }] : [])
      ]
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  // Convert channels array to object
  const channels = {
    telegram: answers.channels.includes('telegram'),
    whatsapp: answers.channels.includes('whatsapp'),
    webchat: answers.channels.includes('webchat'),
    imessage: answers.channels.includes('imessage')
  };
  
  return {
    instanceName: answers.instanceName,
    emoji: answers.emoji,
    mode: answers.mode,
    channels
  };
}

/**
 * Print installation plan
 * @param {Object} platform - Platform information
 * @param {Object} config - Configuration
 */
function printInstallationPlan(platform, config) {
  console.log(chalk.bold('Installation Plan:\n'));
  console.log(`Instance Name: ${chalk.cyan(config.instanceName)} ${config.emoji}`);
  console.log(`Platform:      ${chalk.cyan(platform.os.name)}`);
  console.log(`Mode:          ${chalk.cyan(config.mode)}`);
  console.log(`Channels:      ${Object.entries(config.channels)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => chalk.cyan(name))
    .join(', ')}`);
  
  console.log(chalk.bold('\nSteps:\n'));
  console.log('1. Install OpenClaw globally (npm install -g openclaw)');
  console.log('2. Create workspace directory');
  console.log('3. Generate identity files (SOUL.md, IDENTITY.md, etc.)');
  console.log('4. Initialize git repository');
  console.log('5. Configure gateway settings');
  console.log('6. Display next steps (API keys, channel setup)');
}

/**
 * Execute installation
 * @param {Object} platform - Platform information
 * @param {Object} config - Configuration
 * @param {Object} options - Command options
 */
async function executeInstallation(platform, config, options) {
  const spinner = ora('Installing OpenClaw...').start();
  
  try {
    // Step 1: Install OpenClaw CLI
    spinner.text = 'Installing OpenClaw CLI (npm install -g openclaw)...';
    if (!options.skipNpm) {
      const openclawExists = await commandExists('openclaw');
      if (!openclawExists) {
        await executeCommand('npm install -g openclaw');
        spinner.succeed('OpenClaw CLI installed');
      } else {
        spinner.info('OpenClaw CLI already installed');
      }
    } else {
      spinner.info('Skipping npm installation (--skip-npm)');
    }
    
    // Step 2: Create workspace directory
    spinner.start('Creating workspace directory...');
    const workspacePath = join(homedir(), '.openclaw', 'workspace');
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }
    
    // Create subdirectories
    const subdirs = ['memory', 'projects', 'brainstorms'];
    subdirs.forEach(dir => {
      const dirPath = join(workspacePath, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    });
    spinner.succeed('Workspace directory created');
    
    // Step 3: Generate identity files
    spinner.start('Generating identity files...');
    const templates = getWorkspaceTemplates(config.instanceName, config.emoji, platform.os.isWindows);
    
    Object.entries(templates).forEach(([filename, content]) => {
      const filePath = join(workspacePath, filename);
      writeFileSync(filePath, content, 'utf-8');
    });
    spinner.succeed('Identity files created');
    
    // Step 4: Initialize git
    spinner.start('Initializing git repository...');
    try {
      await executeCommand('git init', { cwd: workspacePath });
      await executeCommand('git add .', { cwd: workspacePath });
      await executeCommand(`git commit -m "Initial ${config.instanceName} workspace setup"`, { cwd: workspacePath });
      spinner.succeed('Git repository initialized');
    } catch (error) {
      spinner.warn('Git initialization skipped (git not found or already initialized)');
    }
    
    // Step 5: Display configuration template
    spinner.succeed('Installation complete');
    
  } catch (error) {
    spinner.fail('Installation failed');
    throw error;
  }
}

/**
 * Print next steps
 * @param {Object} platform - Platform information
 * @param {Object} config - Configuration
 */
function printNextSteps(platform, config) {
  console.log(chalk.bold('📋 Next Steps:\n'));
  
  console.log(chalk.yellow('1. Add your Anthropic API key:'));
  console.log(chalk.gray('   Set environment variable or add to gateway config'));
  console.log(chalk.gray(`   export ANTHROPIC_API_KEY="sk-ant-..."\n`));
  
  if (config.channels.telegram) {
    console.log(chalk.yellow('2. Configure Telegram:'));
    console.log(chalk.gray('   - Create bot via @BotFather'));
    console.log(chalk.gray('   - Get bot token'));
    console.log(chalk.gray('   - Get your chat ID (send message, check /getUpdates)'));
    console.log(chalk.gray('   - Add to gateway config\n'));
  }
  
  if (config.channels.whatsapp) {
    console.log(chalk.yellow('3. Configure WhatsApp:'));
    console.log(chalk.gray('   - Setup will be provided by Jin'));
    console.log(chalk.gray('   - Used for brainstorming between instances\n'));
  }
  
  console.log(chalk.yellow('4. Start OpenClaw gateway:'));
  console.log(chalk.cyan('   openclaw gateway start\n'));
  
  console.log(chalk.yellow('5. Test your instance:'));
  if (config.channels.webchat) {
    console.log(chalk.cyan('   Visit: http://localhost:3000'));
  }
  if (config.channels.telegram) {
    console.log(chalk.gray('   Send a message to your Telegram bot'));
  }
  
  console.log(chalk.yellow('\n6. Create private GitHub repository:'));
  console.log(chalk.gray(`   cd ~/.openclaw/workspace`));
  console.log(chalk.gray(`   git remote add origin https://github.com/yourusername/${config.instanceName}-workspace.git`));
  console.log(chalk.gray(`   git push -u origin main\n`));
  
  console.log(chalk.bold('📚 Documentation:\n'));
  console.log(chalk.cyan('   https://docs.openclaw.ai'));
  console.log(chalk.cyan('   https://github.com/openclaw/openclaw\n'));
  
  console.log(chalk.green(`🌟 Welcome to OpenClaw, ${config.instanceName}! ${config.emoji}\n`));
}
