/**
 * Backup & Restore Command
 * Create and restore backups of OpenClaw configuration and workspace
 * @module commands/backup
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, createReadStream, createWriteStream } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir, platform } from 'os';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import logger from '../core/logger.js';
import { executeCommand } from '../core/utils.js';

/**
 * Default backup directory
 */
const DEFAULT_BACKUP_DIR = join(homedir(), '.openclaw', 'backups');

/**
 * Files and directories to backup
 */
const BACKUP_ITEMS = {
  config: {
    name: 'Configuration',
    path: 'openclaw.json',
    critical: true
  },
  workspace: {
    name: 'Workspace',
    path: 'workspace',
    critical: true
  },
  skills: {
    name: 'Custom Skills',
    path: 'workspace/skills',
    critical: false
  },
  memory: {
    name: 'Memory Files',
    path: 'workspace/memory',
    critical: true
  },
  logs: {
    name: 'Logs',
    path: 'logs',
    critical: false
  },
  docker: {
    name: 'Docker Config',
    path: 'docker',
    critical: false
  }
};

/**
 * Backup command handler
 * @param {Object} options - Command options
 */
export async function backupCommand(action, options = {}) {
  switch (action) {
    case 'create':
      return await createBackup(options);
    case 'restore':
      return await restoreBackup(options);
    case 'list':
      return await listBackups(options);
    case 'delete':
      return await deleteBackup(options);
    case 'export':
      return await exportBackup(options);
    case 'import':
      return await importBackup(options);
    default:
      // Interactive mode
      return await interactiveBackup(options);
  }
}

/**
 * Create a backup
 * @param {Object} options - Backup options
 * @returns {Promise<Object>} Backup result
 */
async function createBackup(options) {
  const {
    name = null,
    include = ['config', 'workspace', 'memory'],
    compress = true,
    dryRun = false,
    outputDir = DEFAULT_BACKUP_DIR
  } = options;

  const spinner = ora('Creating backup...').start();
  const openclawDir = join(homedir(), '.openclaw');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = name || `backup-${timestamp}`;
  const backupPath = join(outputDir, backupName);

  try {
    // Create backup directory
    if (!existsSync(outputDir)) {
      if (!dryRun) {
        mkdirSync(outputDir, { recursive: true });
      }
    }

    if (dryRun) {
      spinner.info('[DRY-RUN] Would create backup:');
      console.log(`  Name: ${backupName}`);
      console.log(`  Path: ${backupPath}`);
      console.log(`  Items: ${include.join(', ')}`);
      return { success: true, simulated: true };
    }

    // Create backup directory
    mkdirSync(backupPath, { recursive: true });

    // Backup manifest
    const manifest = {
      version: '1.0.0',
      created: new Date().toISOString(),
      platform: platform(),
      items: [],
      compressed: compress
    };

    // Backup each item
    for (const itemKey of include) {
      const item = BACKUP_ITEMS[itemKey];
      if (!item) continue;

      const sourcePath = join(openclawDir, item.path);
      if (!existsSync(sourcePath)) {
        logger.debug(`Skipping ${item.name} - not found`);
        continue;
      }

      spinner.text = `Backing up ${item.name}...`;

      const destPath = join(backupPath, item.path);
      const destDir = dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      const stats = statSync(sourcePath);
      if (stats.isDirectory()) {
        await copyDirectory(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }

      manifest.items.push({
        key: itemKey,
        name: item.name,
        path: item.path,
        size: await getSize(destPath)
      });
    }

    // Write manifest
    writeFileSync(
      join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Compress if requested
    let finalPath = backupPath;
    if (compress) {
      spinner.text = 'Compressing backup...';
      finalPath = await compressBackup(backupPath);
    }

    spinner.succeed(`Backup created: ${basename(finalPath)}`);

    console.log(chalk.gray(`\nBackup location: ${finalPath}`));
    console.log(chalk.gray(`Items backed up: ${manifest.items.map(i => i.name).join(', ')}`));

    return {
      success: true,
      path: finalPath,
      name: backupName,
      items: manifest.items
    };
  } catch (error) {
    spinner.fail('Backup failed');
    logger.error('Backup error', error);
    throw error;
  }
}

/**
 * Restore from a backup
 * @param {Object} options - Restore options
 * @returns {Promise<Object>} Restore result
 */
async function restoreBackup(options) {
  const {
    backup = null,
    items = null,
    force = false,
    dryRun = false
  } = options;

  const spinner = ora('Preparing restore...').start();
  const openclawDir = join(homedir(), '.openclaw');

  try {
    // Find backup
    let backupPath = backup;
    if (!backupPath) {
      // Interactive selection
      spinner.stop();
      const backups = await listBackups({ returnList: true });
      if (backups.length === 0) {
        console.log(chalk.yellow('No backups found'));
        return { success: false, error: 'No backups found' };
      }

      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'backup',
        message: 'Select backup to restore:',
        choices: backups.map(b => ({
          name: `${b.name} (${b.date}) - ${b.items.join(', ')}`,
          value: b.path
        }))
      }]);
      backupPath = answer.backup;
      spinner.start('Preparing restore...');
    }

    // Check if backup is compressed
    if (backupPath.endsWith('.tar.gz') || backupPath.endsWith('.tgz')) {
      spinner.text = 'Extracting backup...';
      backupPath = await extractBackup(backupPath);
    }

    // Read manifest
    const manifestPath = join(backupPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('Invalid backup: manifest.json not found');
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const itemsToRestore = items || manifest.items.map(i => i.key);

    if (dryRun) {
      spinner.info('[DRY-RUN] Would restore:');
      console.log(`  From: ${backupPath}`);
      console.log(`  Items: ${itemsToRestore.join(', ')}`);
      console.log(`  Created: ${manifest.created}`);
      return { success: true, simulated: true };
    }

    // Confirm if not forced
    if (!force) {
      spinner.stop();
      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: chalk.yellow('This will overwrite existing files. Continue?'),
        default: false
      }]);
      if (!confirm.proceed) {
        console.log(chalk.gray('Restore cancelled'));
        return { success: false, cancelled: true };
      }
      spinner.start('Restoring...');
    }

    // Create pre-restore backup
    spinner.text = 'Creating pre-restore backup...';
    const preRestoreBackup = await createBackup({
      name: `pre-restore-${Date.now()}`,
      include: itemsToRestore,
      compress: true
    });

    // Restore each item
    for (const item of manifest.items) {
      if (!itemsToRestore.includes(item.key)) continue;

      spinner.text = `Restoring ${item.name}...`;

      const sourcePath = join(backupPath, item.path);
      const destPath = join(openclawDir, item.path);

      if (!existsSync(sourcePath)) {
        logger.warn(`Item not found in backup: ${item.name}`);
        continue;
      }

      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      const stats = statSync(sourcePath);
      if (stats.isDirectory()) {
        await copyDirectory(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
    }

    spinner.succeed('Restore completed');

    console.log(chalk.gray(`\nRestored from: ${backupPath}`));
    console.log(chalk.gray(`Pre-restore backup: ${preRestoreBackup.path}`));
    console.log(chalk.yellow('\nRestart OpenClaw gateway for changes to take effect:'));
    console.log(chalk.cyan('  openclaw gateway restart'));

    return {
      success: true,
      restored: itemsToRestore,
      preRestoreBackup: preRestoreBackup.path
    };
  } catch (error) {
    spinner.fail('Restore failed');
    logger.error('Restore error', error);
    throw error;
  }
}

/**
 * List available backups
 * @param {Object} options - List options
 * @returns {Promise<Array>} Backups list
 */
async function listBackups(options = {}) {
  const { outputDir = DEFAULT_BACKUP_DIR, returnList = false } = options;

  if (!existsSync(outputDir)) {
    if (!returnList) {
      console.log(chalk.gray('No backups found'));
    }
    return [];
  }

  const entries = readdirSync(outputDir, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    const fullPath = join(outputDir, entry.name);
    let manifestPath;
    let isCompressed = false;

    if (entry.isDirectory()) {
      manifestPath = join(fullPath, 'manifest.json');
    } else if (entry.name.endsWith('.tar.gz') || entry.name.endsWith('.tgz')) {
      // For compressed backups, we'd need to peek inside
      // For now, just show the filename
      isCompressed = true;
      backups.push({
        name: entry.name,
        path: fullPath,
        date: statSync(fullPath).mtime.toISOString(),
        compressed: true,
        items: ['(compressed)']
      });
      continue;
    } else {
      continue;
    }

    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      backups.push({
        name: entry.name,
        path: fullPath,
        date: manifest.created,
        compressed: manifest.compressed || false,
        items: manifest.items.map(i => i.name)
      });
    }
  }

  // Sort by date (newest first)
  backups.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (returnList) {
    return backups;
  }

  // Display backups
  console.log(chalk.bold('\n📦 Available Backups\n'));

  if (backups.length === 0) {
    console.log(chalk.gray('No backups found'));
    return [];
  }

  for (const backup of backups) {
    console.log(chalk.cyan(`${backup.name}`));
    console.log(chalk.gray(`  Date: ${new Date(backup.date).toLocaleString()}`));
    console.log(chalk.gray(`  Items: ${backup.items.join(', ')}`));
    console.log(chalk.gray(`  Path: ${backup.path}`));
    console.log();
  }

  return backups;
}

/**
 * Delete a backup
 * @param {Object} options - Delete options
 * @returns {Promise<Object>} Result
 */
async function deleteBackup(options) {
  const { backup = null, force = false, dryRun = false } = options;

  let backupPath = backup;
  if (!backupPath) {
    const backups = await listBackups({ returnList: true });
    if (backups.length === 0) {
      console.log(chalk.yellow('No backups found'));
      return { success: false };
    }

    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'backup',
      message: 'Select backup to delete:',
      choices: backups.map(b => ({
        name: `${b.name} (${new Date(b.date).toLocaleDateString()})`,
        value: b.path
      }))
    }]);
    backupPath = answer.backup;
  }

  if (!force) {
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: chalk.yellow(`Delete ${basename(backupPath)}? This cannot be undone.`),
      default: false
    }]);
    if (!confirm.proceed) {
      console.log(chalk.gray('Cancelled'));
      return { success: false, cancelled: true };
    }
  }

  if (dryRun) {
    console.log(chalk.cyan(`[DRY-RUN] Would delete: ${backupPath}`));
    return { success: true, simulated: true };
  }

  const { rmSync } = await import('fs');
  rmSync(backupPath, { recursive: true, force: true });

  console.log(chalk.green(`✓ Deleted: ${basename(backupPath)}`));
  return { success: true };
}

/**
 * Export backup to a portable format
 * @param {Object} options - Export options
 * @returns {Promise<Object>} Result
 */
async function exportBackup(options) {
  const { output = null, sanitize = true } = options;

  // Create a backup first
  const backup = await createBackup({
    ...options,
    compress: false
  });

  if (!backup.success) {
    return backup;
  }

  // Sanitize sensitive data if requested
  if (sanitize) {
    const configPath = join(backup.path, 'openclaw.json');
    if (existsSync(configPath)) {
      let config = JSON.parse(readFileSync(configPath, 'utf-8'));
      
      // Remove sensitive fields
      const sensitiveFields = [
        'anthropic.apiKey',
        'openai.apiKey',
        'telegram.token',
        'whatsapp.credentials',
        'gmail.credentials'
      ];

      for (const field of sensitiveFields) {
        const parts = field.split('.');
        let obj = config;
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]]) obj = obj[parts[i]];
        }
        if (obj && obj[parts[parts.length - 1]]) {
          obj[parts[parts.length - 1]] = '[REMOVED]';
        }
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
  }

  // Compress to final output
  const outputPath = output || join(DEFAULT_BACKUP_DIR, `export-${Date.now()}.tar.gz`);
  const compressed = await compressBackup(backup.path, outputPath);

  // Clean up uncompressed backup
  const { rmSync } = await import('fs');
  rmSync(backup.path, { recursive: true, force: true });

  console.log(chalk.green(`\n✓ Exported to: ${compressed}`));
  if (sanitize) {
    console.log(chalk.gray('Sensitive data has been removed'));
  }

  return { success: true, path: compressed };
}

/**
 * Import backup from external file
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Result
 */
async function importBackup(options) {
  const { file = null } = options;

  if (!file) {
    console.log(chalk.red('Please specify a file to import: --file <path>'));
    return { success: false };
  }

  if (!existsSync(file)) {
    console.log(chalk.red(`File not found: ${file}`));
    return { success: false };
  }

  // Copy to backup directory
  const destName = `imported-${basename(file)}`;
  const destPath = join(DEFAULT_BACKUP_DIR, destName);

  if (!existsSync(DEFAULT_BACKUP_DIR)) {
    mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
  }

  await copyFile(file, destPath);

  console.log(chalk.green(`\n✓ Imported: ${destName}`));
  console.log(chalk.gray(`To restore: openclaw-easyset backup restore --backup "${destPath}"`));

  return { success: true, path: destPath };
}

/**
 * Interactive backup mode
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result
 */
async function interactiveBackup(options) {
  console.log(chalk.bold('\n📦 OpenClaw Backup & Restore\n'));

  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Create a new backup', value: 'create' },
      { name: 'Restore from backup', value: 'restore' },
      { name: 'List existing backups', value: 'list' },
      { name: 'Delete a backup', value: 'delete' },
      { name: 'Export backup (portable)', value: 'export' },
      { name: 'Import backup', value: 'import' }
    ]
  }]);

  return await backupCommand(answer.action, options);
}

// ============ Utility Functions ============

/**
 * Copy a file
 * @param {string} source - Source path
 * @param {string} dest - Destination path
 */
async function copyFile(source, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const content = readFileSync(source);
  writeFileSync(dest, content);
}

/**
 * Copy a directory recursively
 * @param {string} source - Source directory
 * @param {string} dest - Destination directory
 */
async function copyDirectory(source, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(source, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Get size of file or directory
 * @param {string} path - Path
 * @returns {Promise<number>} Size in bytes
 */
async function getSize(path) {
  const stats = statSync(path);
  if (stats.isFile()) {
    return stats.size;
  }

  let size = 0;
  const entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    size += await getSize(join(path, entry.name));
  }
  return size;
}

/**
 * Compress a directory to tar.gz
 * @param {string} source - Source directory
 * @param {string} dest - Destination file (optional)
 * @returns {Promise<string>} Output path
 */
async function compressBackup(source, dest = null) {
  const outputPath = dest || `${source}.tar.gz`;
  
  // Use tar command (available on all platforms with git or built-in)
  try {
    const sourceDir = dirname(source);
    const sourceName = basename(source);
    await executeCommand(`tar -czf "${outputPath}" -C "${sourceDir}" "${sourceName}"`);
    
    // Remove uncompressed directory
    const { rmSync } = await import('fs');
    rmSync(source, { recursive: true, force: true });
    
    return outputPath;
  } catch (error) {
    // Fallback: keep uncompressed
    logger.warn('Could not compress backup, keeping uncompressed');
    return source;
  }
}

/**
 * Extract a tar.gz backup
 * @param {string} source - Source tar.gz file
 * @returns {Promise<string>} Extracted directory path
 */
async function extractBackup(source) {
  const outputDir = source.replace(/\.(tar\.gz|tgz)$/, '');
  
  try {
    mkdirSync(outputDir, { recursive: true });
    await executeCommand(`tar -xzf "${source}" -C "${dirname(outputDir)}"`);
    return outputDir;
  } catch (error) {
    throw new Error(`Failed to extract backup: ${error.message}`);
  }
}

export default backupCommand;
