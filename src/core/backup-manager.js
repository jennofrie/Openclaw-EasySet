/**
 * Backup Manager Module
 * Backup and restore OpenClaw configuration
 * @module core/backup-manager
 */

import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, copyFileSync, statSync,
} from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { formatBytes, createSpinner } from './utils.js';
import logger from './logger.js';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const BACKUP_DIR = join(homedir(), '.openclaw-easyset', 'backups');

/**
 * Files to include in backup
 */
const BACKUP_TARGETS = [
  { path: 'openclaw.json', required: true, description: 'Main configuration' },
  { path: '.env', required: false, description: 'Environment variables' },
  { path: '.env.template', required: false, description: 'Env template' },
  { path: 'cron/jobs.json', required: false, description: 'Cron jobs' },
  { path: 'exec-approvals.json', required: false, description: 'Exec approvals' },
  { path: 'settings/tts.json', required: false, description: 'TTS settings' },
];

/**
 * Credential files to include
 */
const CREDENTIAL_PATTERNS = [
  'credentials/*.json',
];

class BackupManager {
  constructor() {
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Create a full backup
   * @param {string} [label] - Optional label for the backup
   * @returns {{success: boolean, path: string|null, files: number}}
   */
  createBackup(label = null) {
    const spinner = createSpinner('Creating backup...');
    spinner.start();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = label ? `${timestamp}_${label}` : timestamp;
    const backupPath = join(BACKUP_DIR, backupName);

    try {
      mkdirSync(backupPath, { recursive: true });
      let fileCount = 0;

      // Copy config files
      for (const target of BACKUP_TARGETS) {
        const srcPath = join(OPENCLAW_DIR, target.path);
        if (existsSync(srcPath)) {
          const destDir = join(backupPath, target.path.includes('/') ? target.path.split('/').slice(0, -1).join('/') : '');
          if (destDir !== backupPath) {
            mkdirSync(destDir, { recursive: true });
          }
          copyFileSync(srcPath, join(backupPath, target.path));
          fileCount++;
          logger.debug(`Backed up: ${target.path}`);
        } else if (target.required) {
          logger.warn(`Required file not found: ${target.path}`);
        }
      }

      // Copy credential files
      const credDir = join(OPENCLAW_DIR, 'credentials');
      if (existsSync(credDir)) {
        const destCredDir = join(backupPath, 'credentials');
        mkdirSync(destCredDir, { recursive: true });

        const credFiles = readdirSync(credDir).filter(f => f.endsWith('.json'));
        for (const file of credFiles) {
          copyFileSync(join(credDir, file), join(destCredDir, file));
          fileCount++;
        }
      }

      // Write backup metadata
      const metadata = {
        created: new Date().toISOString(),
        label: label || null,
        files: fileCount,
        openclawDir: OPENCLAW_DIR,
        easyset: 'openclaw-easyset',
      };
      writeFileSync(join(backupPath, '.backup-meta.json'), JSON.stringify(metadata, null, 2));

      spinner.succeed(`Backup created: ${backupName} (${fileCount} files)`);
      return { success: true, path: backupPath, name: backupName, files: fileCount };
    } catch (error) {
      spinner.fail('Backup failed');
      logger.error('Backup creation failed', error);
      return { success: false, path: null, name: null, files: 0 };
    }
  }

  /**
   * List all available backups
   * @returns {Array<Object>} Backup info objects
   */
  listBackups() {
    if (!existsSync(BACKUP_DIR)) return [];

    try {
      const entries = readdirSync(BACKUP_DIR, { withFileTypes: true });
      const backups = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metaPath = join(BACKUP_DIR, entry.name, '.backup-meta.json');
        let meta = {};

        if (existsSync(metaPath)) {
          try {
            meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          } catch { /* skip */ }
        }

        // Calculate total size
        let totalSize = 0;
        const backupPath = join(BACKUP_DIR, entry.name);
        try {
          const files = this.listFilesRecursive(backupPath);
          for (const file of files) {
            try {
              totalSize += statSync(file).size;
            } catch { /* skip */ }
          }
        } catch { /* skip */ }

        backups.push({
          name: entry.name,
          path: backupPath,
          created: meta.created || null,
          label: meta.label || null,
          files: meta.files || 0,
          size: totalSize,
          sizeFormatted: formatBytes(totalSize),
        });
      }

      // Sort by name (which is timestamp-based) descending
      backups.sort((a, b) => b.name.localeCompare(a.name));
      return backups;
    } catch (error) {
      logger.error('Failed to list backups', error);
      return [];
    }
  }

  /**
   * Recursively list files in a directory
   */
  listFilesRecursive(dir) {
    const files = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.listFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  /**
   * Restore a backup
   * @param {string} backupName - Name of backup to restore
   * @returns {{success: boolean, restored: number}}
   */
  restoreBackup(backupName) {
    const backupPath = join(BACKUP_DIR, backupName);

    if (!existsSync(backupPath)) {
      logger.error(`Backup not found: ${backupName}`);
      return { success: false, restored: 0 };
    }

    const spinner = createSpinner('Restoring backup...');
    spinner.start();

    try {
      // First, create a safety backup of current state
      const safetyBackup = this.createQuickBackup('pre-restore');
      logger.debug(`Safety backup created: ${safetyBackup}`);

      let restored = 0;

      // Restore each config target
      for (const target of BACKUP_TARGETS) {
        const srcPath = join(backupPath, target.path);
        if (existsSync(srcPath)) {
          const destPath = join(OPENCLAW_DIR, target.path);
          const destDir = join(destPath, '..');
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }
          copyFileSync(srcPath, destPath);
          restored++;
          logger.debug(`Restored: ${target.path}`);
        }
      }

      // Restore credentials
      const credBackupDir = join(backupPath, 'credentials');
      if (existsSync(credBackupDir)) {
        const destCredDir = join(OPENCLAW_DIR, 'credentials');
        if (!existsSync(destCredDir)) {
          mkdirSync(destCredDir, { recursive: true });
        }

        const files = readdirSync(credBackupDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          copyFileSync(join(credBackupDir, file), join(destCredDir, file));
          restored++;
        }
      }

      spinner.succeed(`Restored ${restored} files from ${backupName}`);
      return { success: true, restored };
    } catch (error) {
      spinner.fail('Restore failed');
      logger.error('Backup restore failed', error);
      return { success: false, restored: 0 };
    }
  }

  /**
   * Quick backup of just openclaw.json (for internal use before modifications)
   * @param {string} label
   * @returns {string|null} Backup path
   */
  createQuickBackup(label) {
    if (!existsSync(OPENCLAW_DIR)) return null;

    const timestamp = Date.now();
    const backupFile = join(OPENCLAW_DIR, `openclaw.json.easyset-backup.${label}.${timestamp}`);

    try {
      if (existsSync(join(OPENCLAW_DIR, 'openclaw.json'))) {
        copyFileSync(join(OPENCLAW_DIR, 'openclaw.json'), backupFile);
        return backupFile;
      }
    } catch { /* skip */ }

    return null;
  }

  /**
   * Print backup list in a formatted table
   */
  printBackupList() {
    const backups = this.listBackups();

    if (backups.length === 0) {
      console.log(chalk.gray('  No backups found'));
      console.log(chalk.gray('  Create one with: openclaw-easyset backup create'));
      return;
    }

    console.log(chalk.bold(`\n  Available Backups (${backups.length}):\n`));

    for (const backup of backups) {
      const date = backup.created
        ? new Date(backup.created).toLocaleString()
        : backup.name;
      const label = backup.label ? chalk.cyan(` [${backup.label}]`) : '';

      console.log(`  ${chalk.bold(backup.name)}${label}`);
      console.log(chalk.gray(`    Created: ${date} | Files: ${backup.files} | Size: ${backup.sizeFormatted}`));
    }
  }
}

export default new BackupManager();
