import { describe, test, expect } from '@jest/globals';

describe('ServiceManager', () => {
  let serviceManager;

  beforeAll(async () => {
    const module = await import('../src/core/service-manager.js');
    serviceManager = module.default;
  });

  test('should discover OpenClaw services', () => {
    const services = serviceManager.discoverServices();

    expect(Array.isArray(services)).toBe(true);
    // On a system with OpenClaw installed, we expect at least the gateway
    for (const svc of services) {
      expect(svc).toHaveProperty('label');
      expect(svc).toHaveProperty('shortName');
      expect(svc).toHaveProperty('plistPath');
      expect(svc).toHaveProperty('description');
      expect(svc.label).toMatch(/^ai\.openclaw\./);
    }
  });

  test('should get service status', async () => {
    const status = await serviceManager.getServiceStatus('ai.openclaw.gateway');

    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('pid');
    expect(status).toHaveProperty('details');
    expect(typeof status.running).toBe('boolean');
    expect(typeof status.details).toBe('string');
  });

  test('should get all statuses', async () => {
    const statuses = await serviceManager.getAllStatuses();

    expect(Array.isArray(statuses)).toBe(true);
    for (const svc of statuses) {
      expect(svc).toHaveProperty('label');
      expect(svc).toHaveProperty('running');
    }
  }, 15000);

  test('should check gateway health', async () => {
    const health = await serviceManager.checkGatewayHealth();

    expect(health).toHaveProperty('responding');
    expect(health).toHaveProperty('statusCode');
    expect(typeof health.responding).toBe('boolean');
  });
});
