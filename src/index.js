#!/usr/bin/env node

/**
 * OpenClaw EasySet - Main CLI Entry Point
 * @module index
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { detectCommand } from './commands/detect.js';
import { installCommand } from './commands/install.js';
import { securityCommand } from './commands/security.js';
import { backupCommand } from './commands/backup.js';
import logger from './core/logger.js';
import serviceManager from './services/service-manager.js';
import dockerManager from './core/docker-manager.js';
import skillsMarketplace from './skills/marketplace.js';
import terminalOrchestrator from './core/terminal-orchestrator.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('openclaw-easyset')
  .description('Automated OpenClaw setup and configuration tool')
  .version(packageJson.version, '-v, --version', 'Output the version number')
  .option('--verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug logging')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      logger.setLevel('debug');
    } else if (opts.verbose) {
      logger.setLevel('verbose');
    }
  });

// =============================================================================
// DETECTION & INSTALLATION
// =============================================================================

// Detect command
program
  .command('detect')
  .description('Detect platform and system capabilities')
  .option('-r, --recommendations', 'Show installation recommendations')
  .option('--json', 'Output as JSON')
  .action(detectCommand);

// Install command
program
  .command('install')
  .description('Install and configure OpenClaw')
  .option('-m, --mode <type>', 'Installation mode (native|docker|auto)', 'auto')
  .option('--dry-run', 'Simulate installation without making changes')
  .option('--yes', 'Accept all defaults')
  .option('--skip-npm', 'Skip npm install (for testing)')
  .option('--force', 'Install even if requirements not met (not recommended)')
  .action(installCommand);

// =============================================================================
// DOCKER MANAGEMENT
// =============================================================================

const dockerCmd = program
  .command('docker')
  .description('Docker-based installation and management');

dockerCmd
  .command('install')
  .description('Install OpenClaw using Docker')
  .option('--dry-run', 'Simulate without making changes')
  .option('--port <port>', 'Gateway port', '18789')
  .option('--webchat-port <port>', 'Webchat port', '3000')
  .action(async (options) => {
    try {
      const result = await dockerManager.install({
        dryRun: options.dryRun,
        config: {
          port: parseInt(options.port),
          webchatPort: parseInt(options.webchatPort)
        }
      });
      if (result.success) {
        console.log(chalk.green('\n✓ Docker installation complete'));
        console.log(chalk.gray(`Container: ${result.containerName}`));
        console.log(chalk.gray(`Gateway: http://localhost:${result.ports?.gateway || 18789}`));
        console.log(chalk.gray(`Webchat: http://localhost:${result.ports?.webchat || 3000}`));
      }
    } catch (error) {
      console.log(chalk.red(`\n✗ Error: ${error.message}`));
      process.exit(1);
    }
  });

dockerCmd
  .command('status')
  .description('Check Docker container status')
  .action(async () => {
    try {
      const status = await dockerManager.getStatus();
      console.log(chalk.bold('\n🐳 Docker Status\n'));
      console.log(`Container: ${status.containerName}`);
      console.log(`Installed: ${status.installed ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`Running: ${status.running ? chalk.green('Yes') : chalk.yellow('No')}`);
      if (status.status) console.log(`Status: ${status.status}`);
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

dockerCmd
  .command('start')
  .description('Start Docker container')
  .action(async () => {
    try {
      await dockerManager.start();
      console.log(chalk.green('✓ Container started'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

dockerCmd
  .command('stop')
  .description('Stop Docker container')
  .action(async () => {
    try {
      await dockerManager.stop();
      console.log(chalk.green('✓ Container stopped'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

dockerCmd
  .command('logs')
  .description('View Docker container logs')
  .option('-n, --lines <num>', 'Number of lines', '50')
  .action(async (options) => {
    try {
      const logs = await dockerManager.getLogs({ lines: parseInt(options.lines) });
      console.log(logs);
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

dockerCmd
  .command('uninstall')
  .description('Remove Docker installation')
  .option('--remove-data', 'Also remove data volumes')
  .action(async (options) => {
    try {
      await dockerManager.uninstall({ removeData: options.removeData });
      console.log(chalk.green('✓ Docker installation removed'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

// =============================================================================
// SERVICE MANAGEMENT
// =============================================================================

const serviceCmd = program
  .command('service')
  .description('Manage OpenClaw as a system service');

serviceCmd
  .command('install')
  .description('Install OpenClaw as a system service')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (options) => {
    try {
      const result = await serviceManager.install({ dryRun: options.dryRun });
      if (result.success) {
        console.log(chalk.green(`\n✓ Service installed (${result.type})`));
        console.log(chalk.gray('\nTo start the service:'));
        console.log(chalk.cyan('  openclaw-easyset service start'));
      }
    } catch (error) {
      console.log(chalk.red(`\n✗ Error: ${error.message}`));
      process.exit(1);
    }
  });

serviceCmd
  .command('uninstall')
  .description('Uninstall system service')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (options) => {
    try {
      await serviceManager.uninstall({ dryRun: options.dryRun });
      console.log(chalk.green('✓ Service uninstalled'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

serviceCmd
  .command('start')
  .description('Start the service')
  .action(async () => {
    try {
      await serviceManager.start();
      console.log(chalk.green('✓ Service started'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

serviceCmd
  .command('stop')
  .description('Stop the service')
  .action(async () => {
    try {
      await serviceManager.stop();
      console.log(chalk.green('✓ Service stopped'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

serviceCmd
  .command('restart')
  .description('Restart the service')
  .action(async () => {
    try {
      await serviceManager.restart();
      console.log(chalk.green('✓ Service restarted'));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

serviceCmd
  .command('status')
  .description('Check service status')
  .action(async () => {
    try {
      const status = await serviceManager.getStatus();
      console.log(chalk.bold('\n⚙️ Service Status\n'));
      console.log(`Type: ${status.type}`);
      console.log(`Installed: ${status.installed ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`Running: ${status.running ? chalk.green('Yes') : chalk.yellow('No')}`);
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

// =============================================================================
// SKILLS MARKETPLACE
// =============================================================================

const skillsCmd = program
  .command('skills')
  .description('Manage OpenClaw skills');

skillsCmd
  .command('list')
  .description('List installed skills')
  .action(async () => {
    try {
      await skillsMarketplace.initialize();
      const installed = await skillsMarketplace.getInstalled();
      
      console.log(chalk.bold('\n🎯 Installed Skills\n'));
      
      if (installed.length === 0) {
        console.log(chalk.gray('No skills installed'));
        return;
      }
      
      for (const skill of installed) {
        const locationBadge = skill.location === 'builtin' ? chalk.blue('[builtin]') : chalk.green('[user]');
        console.log(`${chalk.cyan(skill.name)} ${locationBadge}`);
        if (skill.description) console.log(chalk.gray(`  ${skill.description}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

skillsCmd
  .command('search <query>')
  .description('Search for skills')
  .option('-c, --category <cat>', 'Filter by category')
  .action(async (query, options) => {
    try {
      await skillsMarketplace.initialize();
      const results = await skillsMarketplace.search(query, { category: options.category });
      
      console.log(chalk.bold(`\n🔍 Search Results for "${query}"\n`));
      
      if (results.length === 0) {
        console.log(chalk.gray('No skills found'));
        return;
      }
      
      for (const skill of results) {
        console.log(`${chalk.cyan(skill.name)} ${chalk.gray(`by ${skill.author || 'unknown'}`)}`);
        console.log(chalk.gray(`  ${skill.description || 'No description'}`));
        if (skill.category) console.log(chalk.gray(`  Category: ${skill.category}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

skillsCmd
  .command('install <skill>')
  .description('Install a skill')
  .option('--force', 'Overwrite if exists')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (skill, options) => {
    try {
      await skillsMarketplace.initialize();
      const result = await skillsMarketplace.install(skill, {
        force: options.force,
        dryRun: options.dryRun
      });
      
      if (result.success) {
        console.log(chalk.green(`\n✓ Skill '${skill}' installed`));
        if (result.path) console.log(chalk.gray(`  Location: ${result.path}`));
      } else {
        console.log(chalk.red(`\n✗ ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

skillsCmd
  .command('uninstall <skill>')
  .description('Uninstall a skill')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (skill, options) => {
    try {
      await skillsMarketplace.initialize();
      const result = await skillsMarketplace.uninstall(skill, { dryRun: options.dryRun });
      
      if (result.success) {
        console.log(chalk.green(`\n✓ Skill '${skill}' uninstalled`));
      } else {
        console.log(chalk.red(`\n✗ ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

skillsCmd
  .command('update <skill>')
  .description('Update a skill')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (skill, options) => {
    try {
      await skillsMarketplace.initialize();
      const result = await skillsMarketplace.update(skill, { dryRun: options.dryRun });
      
      if (result.success) {
        console.log(chalk.green(`\n✓ Skill '${skill}' updated`));
      } else {
        console.log(chalk.red(`\n✗ ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

skillsCmd
  .command('catalog')
  .description('Browse skill catalog')
  .option('-c, --category <cat>', 'Filter by category')
  .action(async (options) => {
    try {
      await skillsMarketplace.initialize();
      const catalog = await skillsMarketplace.fetchCatalog({ category: options.category });
      const categories = skillsMarketplace.getCategories();
      
      console.log(chalk.bold('\n📚 Skills Catalog\n'));
      
      // Group by category
      const byCategory = {};
      for (const skill of catalog) {
        const cat = skill.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(skill);
      }
      
      for (const [catId, skills] of Object.entries(byCategory)) {
        const catInfo = categories.find(c => c.id === catId) || { name: catId, emoji: '📦' };
        console.log(chalk.bold(`${catInfo.emoji} ${catInfo.name}`));
        for (const skill of skills) {
          const badge = skill.builtin ? chalk.blue('[builtin]') : '';
          console.log(`  ${chalk.cyan(skill.name)} ${badge}`);
          console.log(chalk.gray(`    ${skill.description || 'No description'}`));
        }
        console.log();
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

// =============================================================================
// SECURITY
// =============================================================================

program
  .command('security')
  .description('Security hardening and audit')
  .option('--audit', 'Run security audit')
  .option('--fix', 'Auto-fix security issues')
  .option('--profile <name>', 'Apply security profile (minimal|standard|hardened)')
  .option('--dry-run', 'Simulate without making changes')
  .action(securityCommand);

// =============================================================================
// BACKUP & RESTORE
// =============================================================================

const backupCmd = program
  .command('backup [action]')
  .description('Backup and restore OpenClaw configuration')
  .option('--name <name>', 'Backup name')
  .option('--backup <path>', 'Backup path for restore')
  .option('--output <dir>', 'Output directory')
  .option('--force', 'Force overwrite')
  .option('--dry-run', 'Simulate without making changes')
  .action(backupCommand);

// =============================================================================
// TERMINAL ORCHESTRATION
// =============================================================================

program
  .command('terminals')
  .description('Open multiple terminals for installation')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (options) => {
    try {
      const terminals = await terminalOrchestrator.detectTerminals();
      
      console.log(chalk.bold('\n🖥️ Available Terminals\n'));
      console.log(`Platform: ${terminals.platform}`);
      console.log('Terminals:');
      for (const t of terminals.terminals) {
        const rec = t.recommended ? chalk.green(' (recommended)') : '';
        console.log(`  - ${t.name}${rec}`);
      }
      
      console.log(chalk.bold('\n🚀 Starting Installation Terminals...\n'));
      
      const result = await terminalOrchestrator.setupInstallationTerminals({
        dryRun: options.dryRun
      });
      
      if (result.success) {
        console.log(chalk.green(`✓ Opened ${result.count || result.terminals?.length || 3} terminal windows`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

// =============================================================================
// STATUS & DOCTOR
// =============================================================================

program
  .command('status')
  .description('Check OpenClaw installation status')
  .option('--detailed', 'Show detailed status')
  .action(async (options) => {
    try {
      console.log(chalk.bold('\n🦞 OpenClaw Status\n'));
      
      // Check native installation
      const { commandExists } = await import('./core/utils.js');
      const hasOpenclaw = await commandExists('openclaw');
      console.log(`OpenClaw CLI: ${hasOpenclaw ? chalk.green('Installed') : chalk.red('Not installed')}`);
      
      // Check service
      const serviceStatus = await serviceManager.getStatus();
      console.log(`Service (${serviceStatus.type}): ${serviceStatus.installed ? 
        (serviceStatus.running ? chalk.green('Running') : chalk.yellow('Stopped')) : 
        chalk.gray('Not installed')}`);
      
      // Check Docker
      const dockerStatus = await dockerManager.getStatus();
      if (dockerStatus.installed) {
        console.log(`Docker: ${dockerStatus.running ? chalk.green('Running') : chalk.yellow('Stopped')}`);
      }
      
      // Check skills
      await skillsMarketplace.initialize();
      const skills = await skillsMarketplace.getInstalled();
      console.log(`Skills: ${chalk.cyan(skills.length)} installed`);
      
      if (options.detailed) {
        console.log(chalk.bold('\n📊 Detailed Info\n'));
        
        // Platform
        const platformDetector = (await import('./core/platform-detector.js')).default;
        const platform = await platformDetector.detect();
        console.log(`OS: ${platform.os.name} (${platform.arch.arch})`);
        console.log(`Node: ${platform.node.version}`);
        console.log(`Memory: ${platform.memory.totalFormatted}`);
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('doctor')
  .description('Diagnose and fix installation issues')
  .option('--fix', 'Auto-fix issues')
  .option('--deep', 'Deep system check')
  .action(async (options) => {
    console.log(chalk.bold('\n🩺 OpenClaw Doctor\n'));
    
    const issues = [];
    const checks = [];
    
    // Check 1: OpenClaw installed
    const { commandExists } = await import('./core/utils.js');
    const hasOpenclaw = await commandExists('openclaw');
    if (hasOpenclaw) {
      checks.push('OpenClaw CLI installed');
    } else {
      issues.push({ severity: 'high', message: 'OpenClaw CLI not installed', fix: 'npm install -g openclaw' });
    }
    
    // Check 2: Node version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
      checks.push(`Node.js version OK (${nodeVersion})`);
    } else {
      issues.push({ severity: 'high', message: `Node.js ${nodeVersion} is too old`, fix: 'Install Node.js 18+' });
    }
    
    // Check 3: Config file exists
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const { homedir } = await import('os');
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    if (existsSync(configPath)) {
      checks.push('Configuration file exists');
    } else {
      issues.push({ severity: 'medium', message: 'Configuration file not found', fix: 'Run openclaw onboard' });
    }
    
    // Check 4: Workspace exists
    const workspacePath = join(homedir(), '.openclaw', 'workspace');
    if (existsSync(workspacePath)) {
      checks.push('Workspace directory exists');
    } else {
      issues.push({ severity: 'low', message: 'Workspace not initialized', fix: 'Run openclaw-easyset install' });
    }
    
    // Print results
    if (checks.length > 0) {
      console.log(chalk.green.bold('✓ Passed:'));
      checks.forEach(c => console.log(chalk.green(`  ✓ ${c}`)));
      console.log();
    }
    
    if (issues.length > 0) {
      console.log(chalk.red.bold('✗ Issues Found:'));
      issues.forEach(i => {
        const color = i.severity === 'high' ? chalk.red : i.severity === 'medium' ? chalk.yellow : chalk.gray;
        console.log(color(`  ✗ [${i.severity.toUpperCase()}] ${i.message}`));
        console.log(chalk.gray(`    Fix: ${i.fix}`));
      });
    } else {
      console.log(chalk.green.bold('✓ All checks passed!'));
    }
  });

// =============================================================================
// PARSE & RUN
// =============================================================================

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
