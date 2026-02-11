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
  const { backup = false, format = 'json' } = options;
  let backupPath = null;

  if (backup && existsSync(OPENCLAW_CONFIG)) {
    backupPath = `${OPENCLAW_CONFIG}.easyset-backup.${Date.now()}`;
    copyFileSync(OPENCLAW_CONFIG, backupPath);
  }

  const serialized = format === 'json5'
    ? JSON5.stringify(config, null, 2)
    : JSON.stringify(config, null, 2);
  writeFileSync(OPENCLAW_CONFIG, `${serialized}\n`, 'utf-8');

  return {
    path: OPENCLAW_CONFIG,
    backupPath,
  };
}

/**
 * Update config using targeted path operations and preserve original format.
 * @param {(config: Object, tools: Object) => void} mutator
 * @param {{backup?: boolean, create?: boolean}} [options]
 * @returns {{config: Object, path: string, backupPath: string|null, format: 'json'|'json5'}}
 */
export function updateOpenClawConfig(mutator, options = {}) {
  const { backup = false, create = false } = options;

  let loaded;
  if (existsSync(OPENCLAW_CONFIG)) {
    loaded = loadOpenClawConfig({ optional: false });
  } else if (create) {
    loaded = { config: {}, format: 'json', exists: false };
  } else {
    throw new Error(`OpenClaw config not found at ${OPENCLAW_CONFIG}`);
  }

  const config = loaded.config || {};
  const tools = {
    get: (path, defaultValue = undefined) => getPath(config, path, defaultValue),
    set: (path, value) => setPath(config, path, value),
    merge: (path, value) => mergePath(config, path, value),
    pushUnique: (path, value) => pushUniquePath(config, path, value),
    remove: (path) => removePath(config, path),
  };

  mutator(config, tools);

  const writeResult = saveOpenClawConfig(config, {
    backup,
    format: loaded.format || 'json',
  });

  return {
    config,
    path: writeResult.path,
    backupPath: writeResult.backupPath,
    format: loaded.format || 'json',
  };
}

function getPath(target, path, defaultValue = undefined) {
  const keys = splitPath(path);
  let current = target;

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current;
}

function setPath(target, path, value) {
  const keys = splitPath(path);
  let current = target;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

function mergePath(target, path, value) {
  const existing = getPath(target, path, {});
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  setPath(target, path, deepMerge(base, value));
}

function pushUniquePath(target, path, value) {
  const existing = getPath(target, path, []);
  const array = Array.isArray(existing) ? existing : [];
  if (!array.includes(value)) {
    array.push(value);
  }
  setPath(target, path, array);
}

function removePath(target, path) {
  const keys = splitPath(path);
  if (keys.length === 0) return;

  let current = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      return;
    }
    current = current[key];
  }

  delete current[keys[keys.length - 1]];
}

function splitPath(path) {
  if (!path || typeof path !== 'string') {
    return [];
  }
  return path.split('.').map(s => s.trim()).filter(Boolean);
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
