import { describe, test, expect } from '@jest/globals';
import { parseOpenClawConfig } from '../src/core/openclaw-config.js';

describe('OpenClaw config helpers', () => {
  test('parses strict JSON config', () => {
    const raw = '{"gateway":{"port":18789}}';
    const parsed = parseOpenClawConfig(raw);

    expect(parsed.format).toBe('json');
    expect(parsed.config.gateway.port).toBe(18789);
  });

  test('parses JSON5 config with comments and trailing comma', () => {
    const raw = `{
      // OpenClaw config
      gateway: {
        port: 18789,
      },
    }`;

    const parsed = parseOpenClawConfig(raw);

    expect(parsed.format).toBe('json5');
    expect(parsed.config.gateway.port).toBe(18789);
  });
});
