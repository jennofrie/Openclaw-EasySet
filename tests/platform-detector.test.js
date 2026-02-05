/**
 * Platform Detector Tests
 */

import { describe, it, expect } from '@jest/globals';
import platformDetector from '../src/core/platform-detector.js';

describe('PlatformDetector', () => {
  describe('detectOS', () => {
    it('should detect operating system', () => {
      const os = platformDetector.detectOS();

      expect(os).toHaveProperty('platform');
      expect(os).toHaveProperty('name');
      expect(os).toHaveProperty('isWindows');
      expect(os).toHaveProperty('isMacOS');
      expect(os).toHaveProperty('isLinux');

      expect(typeof os.platform).toBe('string');
      expect(typeof os.name).toBe('string');
    });

    it('should correctly identify platform type', () => {
      const os = platformDetector.detectOS();
      const platformCount = [os.isWindows, os.isMacOS, os.isLinux].filter(Boolean).length;

      expect(platformCount).toBe(1); // Exactly one should be true
    });
  });

  describe('detectArchitecture', () => {
    it('should detect system architecture', () => {
      const arch = platformDetector.detectArchitecture();

      expect(arch).toHaveProperty('arch');
      expect(arch).toHaveProperty('is64bit');
      expect(arch).toHaveProperty('isARM');
      expect(arch).toHaveProperty('isX64');

      expect(typeof arch.arch).toBe('string');
      expect(typeof arch.is64bit).toBe('boolean');
    });
  });

  describe('detectMemory', () => {
    it('should detect system memory', () => {
      const memory = platformDetector.detectMemory();

      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('free');
      expect(memory).toHaveProperty('used');
      expect(memory).toHaveProperty('totalFormatted');
      expect(memory).toHaveProperty('freeFormatted');
      expect(memory).toHaveProperty('usedFormatted');
      expect(memory).toHaveProperty('percentUsed');

      expect(memory.total).toBeGreaterThan(0);
      expect(memory.free).toBeGreaterThan(0);
      expect(memory.percentUsed).toBeGreaterThanOrEqual(0);
      expect(memory.percentUsed).toBeLessThanOrEqual(100);
    });
  });

  describe('detectCPUs', () => {
    it('should detect CPU information', () => {
      const cpus = platformDetector.detectCPUs();

      expect(cpus).toHaveProperty('count');
      expect(cpus).toHaveProperty('model');
      expect(cpus).toHaveProperty('speed');

      expect(cpus.count).toBeGreaterThan(0);
      expect(typeof cpus.model).toBe('string');
    });
  });

  describe('detectNode', () => {
    it('should detect Node.js installation', async () => {
      const node = await platformDetector.detectNode();

      expect(node).toHaveProperty('installed');
      expect(node).toHaveProperty('version');
      expect(node).toHaveProperty('npmVersion');
      expect(node).toHaveProperty('path');

      expect(node.installed).toBe(true); // Should be true since test is running in Node
      expect(typeof node.version).toBe('string');
    });
  });

  describe('checkRequirements', () => {
    it('should check system requirements', () => {
      const requirements = platformDetector.checkRequirements();

      expect(requirements).toHaveProperty('memory');
      expect(requirements).toHaveProperty('node');
      expect(requirements).toHaveProperty('allMet');

      expect(typeof requirements.allMet).toBe('boolean');
    });
  });

  describe('detect', () => {
    it('should detect complete platform information', async () => {
      const platformInfo = await platformDetector.detect();

      expect(platformInfo).toHaveProperty('os');
      expect(platformInfo).toHaveProperty('arch');
      expect(platformInfo).toHaveProperty('release');
      expect(platformInfo).toHaveProperty('node');
      expect(platformInfo).toHaveProperty('memory');
      expect(platformInfo).toHaveProperty('cpus');
      expect(platformInfo).toHaveProperty('packageManagers');
      expect(platformInfo).toHaveProperty('tools');
      expect(platformInfo).toHaveProperty('requirements');

      expect(typeof platformInfo.release).toBe('string');
    }, 10000); // 10 second timeout for full detection
  });

  describe('getRecommendations', () => {
    it('should provide installation recommendations', async () => {
      await platformDetector.detect();
      const recommendations = platformDetector.getRecommendations();

      expect(recommendations).toHaveProperty('mode');
      expect(recommendations).toHaveProperty('installDocker');
      expect(recommendations).toHaveProperty('installBrew');
      expect(recommendations).toHaveProperty('installNode');
      expect(recommendations).toHaveProperty('warnings');
      expect(recommendations).toHaveProperty('notes');

      expect(typeof recommendations.mode).toBe('string');
      expect(Array.isArray(recommendations.warnings)).toBe(true);
      expect(Array.isArray(recommendations.notes)).toBe(true);
    });
  });
});
