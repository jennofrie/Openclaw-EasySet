import { describe, test, expect, beforeEach } from '@jest/globals';

// We test the health checker by running it against the real system
// These tests validate the check structure and output format

describe('HealthChecker', () => {
  let healthChecker;

  beforeEach(async () => {
    const module = await import('../src/core/health-checker.js');
    healthChecker = module.default;
  });

  test('should run all checks and return results array', async () => {
    const results = await healthChecker.runAll();

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  }, 30000);

  test('each result should have required fields', async () => {
    const results = await healthChecker.runAll();

    for (const result of results) {
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(['pass', 'warn', 'fail']).toContain(result.status);
      expect(typeof result.name).toBe('string');
      expect(typeof result.message).toBe('string');
    }
  }, 30000);

  test('results should include expected categories', async () => {
    const results = await healthChecker.runAll();
    const categories = [...new Set(results.map(r => r.category))];

    expect(categories).toContain('config');
    expect(categories).toContain('tools');
  }, 30000);

  test('fix field should be string or null', async () => {
    const results = await healthChecker.runAll();

    for (const result of results) {
      if (result.fix !== null) {
        expect(typeof result.fix).toBe('string');
      }
    }
  }, 30000);
});
