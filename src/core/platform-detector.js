/**
 * Platform Detection Module
 * Detects OS, architecture, and system capabilities for OpenClaw installation
 * @module core/platform-detector
 */

import { platform, arch, release, totalmem, freemem, cpus } from 'os';
import { existsSync } from 'fs';
import { executeCommand, commandExists, getCommandVersion, formatBytes } from './utils.js';
import logger from './logger.js';

/**
 * Minimum system requirements
 */
const REQUIREMENTS = {
  memory: 4 * 1024 * 1024 * 1024, // 4GB
  diskSpace: 1 * 1024 * 1024 * 1024, // 1GB
  nodeVersion: '18.0.0',
};

/**
 * Platform Detector Class
 */
class PlatformDetector {
  constructor() {
    this.platformInfo = null;
  }

  /**
   * Detect complete platform information
   * @returns {Promise<Object>} Platform information
   */
  async detect() {
    logger.info('Detecting platform information...');

    const platformInfo = {
      os: this.detectOS(),
      arch: this.detectArchitecture(),
      release: release(),
      node: await this.detectNode(),
      memory: this.detectMemory(),
      cpus: this.detectCPUs(),
      packageManagers: await this.detectPackageManagers(),
      tools: await this.detectTools(),
      requirements: this.checkRequirements(),
    };

    this.platformInfo = platformInfo;
    logger.debug('Platform detection complete', platformInfo);

    return platformInfo;
  }

  /**
   * Detect operating system
   * @returns {Object} OS information
   */
  detectOS() {
    const platformName = platform();
    const osMap = {
      darwin: 'macOS',
      linux: 'Linux',
      win32: 'Windows',
    };

    return {
      platform: platformName,
      name: osMap[platformName] || platformName,
      isWindows: platformName === 'win32',
      isMacOS: platformName === 'darwin',
      isLinux: platformName === 'linux',
    };
  }

  /**
   * Detect system architecture
   * @returns {Object} Architecture information
   */
  detectArchitecture() {
    const architecture = arch();

    return {
      arch: architecture,
      is64bit: architecture.includes('64'),
      isARM: architecture.includes('arm'),
      isX64: architecture === 'x64',
    };
  }

  /**
   * Detect Node.js installation
   * @returns {Promise<Object>} Node.js information
   */
  async detectNode() {
    try {
      const version = process.version;
      const npmVersion = await getCommandVersion('npm');

      return {
        installed: true,
        version,
        npmVersion: npmVersion ? npmVersion.split('\n')[0] : null,
        path: process.execPath,
      };
    } catch (error) {
      logger.error('Failed to detect Node.js', error);
      return {
        installed: false,
        version: null,
        npmVersion: null,
        path: null,
      };
    }
  }

  /**
   * Detect system memory
   * @returns {Object} Memory information
   */
  detectMemory() {
    const total = totalmem();
    const free = freemem();
    const used = total - free;

    return {
      total,
      free,
      used,
      totalFormatted: formatBytes(total),
      freeFormatted: formatBytes(free),
      usedFormatted: formatBytes(used),
      percentUsed: Math.round((used / total) * 100),
    };
  }

  /**
   * Detect CPU information
   * @returns {Object} CPU information
   */
  detectCPUs() {
    const cpuInfo = cpus();

    return {
      count: cpuInfo.length,
      model: cpuInfo[0]?.model || 'Unknown',
      speed: cpuInfo[0]?.speed || 0,
    };
  }

  /**
   * Detect available package managers
   * @returns {Promise<Object>} Package manager availability
   */
  async detectPackageManagers() {
    const managers = {
      npm: await commandExists('npm'),
      yarn: await commandExists('yarn'),
      pnpm: await commandExists('pnpm'),
      brew: await commandExists('brew'),
      apt: await commandExists('apt-get'),
      yum: await commandExists('yum'),
      choco: await commandExists('choco'),
      docker: await commandExists('docker'),
    };

    // Get versions for installed managers
    for (const [name, installed] of Object.entries(managers)) {
      if (installed) {
        managers[`${name}Version`] = await getCommandVersion(name);
      }
    }

    return managers;
  }

  /**
   * Detect required tools for OpenClaw
   * @returns {Promise<Object>} Tool availability
   */
  async detectTools() {
    const tools = {
      git: await commandExists('git'),
      curl: await commandExists('curl'),
      wget: await commandExists('wget'),
      docker: await commandExists('docker'),
      imsg: await commandExists('imsg'),
      gog: await commandExists('gog'),
    };

    // Get versions
    for (const [name, installed] of Object.entries(tools)) {
      if (installed) {
        const version = await getCommandVersion(name);
        if (version) {
          tools[`${name}Version`] = version.split('\n')[0];
        }
      }
    }

    return tools;
  }

  /**
   * Check system requirements
   * @returns {Object} Requirements check results
   */
  checkRequirements() {
    const memory = this.platformInfo?.memory || this.detectMemory();

    const results = {
      memory: {
        required: formatBytes(REQUIREMENTS.memory),
        actual: memory.totalFormatted,
        met: memory.total >= REQUIREMENTS.memory,
      },
      node: {
        required: REQUIREMENTS.nodeVersion,
        actual: process.version,
        met: this.compareVersions(process.version, `v${REQUIREMENTS.nodeVersion}`) >= 0,
      },
    };

    results.allMet = Object.values(results).every(r => r.met);

    return results;
  }

  /**
   * Compare version strings (simplified)
   * @param {string} v1 - Version 1
   * @param {string} v2 - Version 2
   * @returns {number} -1, 0, or 1
   */
  compareVersions(v1, v2) {
    const clean1 = v1.replace(/^v/, '').split('.').map(Number);
    const clean2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (clean1[i] > clean2[i]) return 1;
      if (clean1[i] < clean2[i]) return -1;
    }

    return 0;
  }

  /**
   * Detect if running in Docker
   * @returns {Promise<boolean>} True if in Docker
   */
  async isDocker() {
    try {
      // Check for .dockerenv file
      if (existsSync('/.dockerenv')) return true;

      // Check cgroup
      const { stdout } = await executeCommand('cat /proc/1/cgroup');
      return stdout.includes('docker');
    } catch {
      return false;
    }
  }

  /**
   * Detect WSL (Windows Subsystem for Linux)
   * @returns {Promise<boolean>} True if in WSL
   */
  async isWSL() {
    if (platform() !== 'linux') return false;

    try {
      const { stdout } = await executeCommand('uname -r');
      return stdout.toLowerCase().includes('microsoft') || stdout.toLowerCase().includes('wsl');
    } catch {
      return false;
    }
  }

  /**
   * Get installation recommendations
   * @returns {Object} Installation recommendations
   */
  getRecommendations() {
    if (!this.platformInfo) {
      throw new Error('Platform detection must be run first');
    }

    const recommendations = {
      mode: 'native',
      installDocker: false,
      installBrew: false,
      installNode: false,
      warnings: [],
      notes: [],
    };

    const { os, packageManagers, tools, requirements } = this.platformInfo;

    // Memory warning
    if (!requirements.memory.met) {
      recommendations.warnings.push(
        `Low memory: ${requirements.memory.actual} (recommended: ${requirements.memory.required})`
      );
    }

    // Node.js check
    if (!requirements.node.met) {
      recommendations.installNode = true;
      recommendations.warnings.push(
        `Node.js ${requirements.node.required}+ required (current: ${requirements.node.actual})`
      );
    }

    // macOS recommendations
    if (os.isMacOS) {
      if (!packageManagers.brew) {
        recommendations.installBrew = true;
        recommendations.notes.push('Homebrew installation recommended for macOS');
      }

      if (!tools.imsg) {
        recommendations.notes.push('imsg CLI recommended for iMessage integration');
      }
    }

    // Docker recommendation
    if (!packageManagers.docker) {
      recommendations.notes.push('Docker installation optional for containerized deployment');
    }

    return recommendations;
  }

  /**
   * Print platform summary
   */
  printSummary() {
    if (!this.platformInfo) {
      console.log('Platform detection not run yet. Call detect() first.');
      return;
    }

    const { os, arch, node, memory, cpus, requirements } = this.platformInfo;

    console.log('\n📊 Platform Detection Summary\n');
    console.log(`OS:           ${os.name} (${os.platform})`);
    console.log(`Architecture: ${arch.arch}`);
    console.log(`Node.js:      ${node.version}`);
    console.log(`NPM:          ${node.npmVersion || 'N/A'}`);
    console.log(`Memory:       ${memory.totalFormatted} (${memory.percentUsed}% used)`);
    console.log(`CPUs:         ${cpus.count}x ${cpus.model}`);

    console.log('\n✓ Requirements Check\n');
    console.log(`Memory:       ${requirements.memory.met ? '✓' : '✗'} ${requirements.memory.actual} / ${requirements.memory.required}`);
    console.log(`Node.js:      ${requirements.node.met ? '✓' : '✗'} ${requirements.node.actual} / ${requirements.node.required}`);

    if (requirements.allMet) {
      console.log('\n✅ All system requirements met!');
    } else {
      console.log('\n⚠️  Some requirements not met. Installation may fail.');
    }
  }
}

export default new PlatformDetector();
