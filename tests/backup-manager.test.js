import { describe, test, expect } from '@jest/globals';
import { existsSync, rmSync } from 'fs';

describe('BackupManager', () => {
  let backupManager;

  beforeAll(async () => {
    const module = await import('../src/core/backup-manager.js');
    backupManager = module.default;
  });

  test('should list backups without error', () => {
    const backups = backupManager.listBackups();

    expect(Array.isArray(backups)).toBe(true);
    for (const backup of backups) {
      expect(backup).toHaveProperty('name');
      expect(backup).toHaveProperty('path');
      expect(backup).toHaveProperty('sizeFormatted');
    }
  });

  test('should create and verify a backup', () => {
    const result = backupManager.createBackup('test-run');

    expect(result.success).toBe(true);
    expect(result.files).toBeGreaterThan(0);
    expect(result.name).toContain('test-run');
    expect(existsSync(result.path)).toBe(true);

    // Clean up test backup
    rmSync(result.path, { recursive: true, force: true });
  });

  test('backup should contain metadata file', () => {
    const result = backupManager.createBackup('meta-test');

    expect(result.success).toBe(true);
    const metaPath = `${result.path}/.backup-meta.json`;
    expect(existsSync(metaPath)).toBe(true);

    // Clean up
    rmSync(result.path, { recursive: true, force: true });
  });
});
