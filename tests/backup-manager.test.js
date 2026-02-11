import { describe, test, expect } from '@jest/globals';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('BackupManager', () => {
  let backupManager;
  const openclawDir = join(homedir(), '.openclaw');
  const openclawConfig = join(openclawDir, 'openclaw.json');
  let createdConfigFixture = false;

  beforeAll(async () => {
    if (!existsSync(openclawConfig)) {
      mkdirSync(openclawDir, { recursive: true });
      writeFileSync(openclawConfig, JSON.stringify({ gateway: { port: 18789 } }, null, 2));
      createdConfigFixture = true;
    }

    const module = await import('../src/core/backup-manager.js');
    backupManager = module.default;
  });

  afterAll(() => {
    if (createdConfigFixture && existsSync(openclawConfig)) {
      rmSync(openclawConfig, { force: true });
    }
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
