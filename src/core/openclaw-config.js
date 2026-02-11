/**
 * OpenClaw config helpers.
 * Supports both JSON and JSON5 reads to match current OpenClaw config format.
 * @module core/openclaw-config
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import JSON5 from 'json5';

export const OPENCLAW_DIR = join(homedir(), '.openclaw');
export const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json');

/**
 * Parse config text as JSON first, then JSON5.
 * @param {string} raw
 * @returns {{config: Object, format: 'json'|'json5'}}
 */
export function parseOpenClawConfig(raw) {
  try {
    return { config: JSON.parse(raw), format: 'json' };
  } catch {
    return { config: JSON5.parse(raw), format: 'json5' };
  }
}

/**
 * Load ~/.openclaw/openclaw.json.
 * @param {{optional?: boolean}} [options]
 * @returns {{config: Object|null, raw: string|null, format: 'json'|'json5'|null, exists: boolean}}
 */
export function loadOpenClawConfig(options = {}) {
  const { optional = true } = options;

  if (!existsSync(OPENCLAW_CONFIG)) {
    if (optional) {
      return { config: null, raw: null, format: null, exists: false };
    }
    throw new Error(`OpenClaw config not found at ${OPENCLAW_CONFIG}`);
  }

  const raw = readFileSync(OPENCLAW_CONFIG, 'utf-8');
  const parsed = parseOpenClawConfig(raw);

  return {
    config: parsed.config,
    raw,
    format: parsed.format,
    exists: true,
  };
}

/**
 * Write config to ~/.openclaw/openclaw.json as stable JSON.
 * @param {Object} config
 * @param {{backup?: boolean}} [options]
 * @returns {{path: string, backupPath: string|null}}
 */
export function saveOpenClawConfig(config, options = {}) {
  const { backup = false } = options;
  let backupPath = null;

  if (backup && existsSync(OPENCLAW_CONFIG)) {
    backupPath = `${OPENCLAW_CONFIG}.easyset-backup.${Date.now()}`;
    copyFileSync(OPENCLAW_CONFIG, backupPath);
  }

  writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2), 'utf-8');

  return {
    path: OPENCLAW_CONFIG,
    backupPath,
  };
}
