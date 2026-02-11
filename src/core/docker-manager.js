/**
 * Docker Manager Module
 * Handles Docker-based OpenClaw installation and management
 * @module core/docker-manager
 */

import { platform, homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { executeCommand, commandExists } from './utils.js';
import logger from './logger.js';

/**
 * Docker Manager Class
 */
class DockerManager {
  constructor() {
    this.platform = platform();
    this.containerName = 'openclaw-gateway';
    this.imageName = 'openclaw/openclaw:latest';
  }

  /**
   * Check if Docker is installed
   * @returns {Promise<boolean>} Docker availability
   */
  async isDockerInstalled() {
    return await commandExists('docker');
  }

  /**
   * Check if Docker daemon is running
   * @returns {Promise<boolean>} Docker running status
   */
  async isDockerRunning() {
    try {
      await executeCommand('docker info');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker installation instructions
   * @returns {Object} Installation instructions by platform
   */
  getInstallInstructions() {
    if (this.platform === 'win32') {
      return {
        method: 'Docker Desktop',
        steps: [
          'Download Docker Desktop from: https://www.docker.com/products/docker-desktop/',
          'Run the installer and follow prompts',
          'Enable WSL 2 backend when prompted',
          'Restart your computer if required',
          'Start Docker Desktop from Start Menu',
          'Wait for Docker to fully start (whale icon in taskbar)'
        ],
        command: 'winget install Docker.DockerDesktop',
        wingetAvailable: true
      };
    } else if (this.platform === 'darwin') {
      return {
        method: 'Docker Desktop',
        steps: [
          'Download Docker Desktop from: https://www.docker.com/products/docker-desktop/',
          'Open the .dmg file and drag Docker to Applications',
          'Launch Docker from Applications',
          'Grant required permissions when prompted',
          'Wait for Docker to fully start (whale icon in menu bar)'
        ],
        command: 'brew install --cask docker',
        brewAvailable: true
      };
    } else {
      return {
        method: 'Docker Engine',
        steps: [
          'Run the official install script:',
          '  curl -fsSL https://get.docker.com | sh',
          'Add your user to docker group:',
          '  sudo usermod -aG docker $USER',
          'Log out and back in for group changes',
          'Start Docker service:',
          '  sudo systemctl start docker'
        ],
        command: 'curl -fsSL https://get.docker.com | sh'
      };
    }
  }

  /**
   * Install Docker (automated where possible)
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Installation result
   */
  async installDocker(options = {}) {
    const { dryRun = false, interactive = true } = options;
    const instructions = this.getInstallInstructions();
    
    logger.info('Installing Docker...');
    
    if (dryRun) {
      logger.info('[DRY-RUN] Would install Docker via:', instructions.method);
      logger.info('[DRY-RUN] Command:', instructions.command);
      return { success: true, simulated: true };
    }
    
    try {
      if (this.platform === 'win32' && instructions.wingetAvailable) {
        // Try winget on Windows
        const hasWinget = await commandExists('winget');
        if (hasWinget) {
          await executeCommand('winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements');
          return { success: true, method: 'winget', needsRestart: true };
        }
      } else if (this.platform === 'darwin' && instructions.brewAvailable) {
        // Try brew on macOS
        const hasBrew = await commandExists('brew');
        if (hasBrew) {
          await executeCommand('brew install --cask docker');
          return { success: true, method: 'brew', needsLaunch: true };
        }
      } else if (this.platform === 'linux') {
        // Use official install script on Linux
        await executeCommand('curl -fsSL https://get.docker.com | sh');
        await executeCommand('sudo usermod -aG docker $USER');
        return { success: true, method: 'script', needsLogout: true };
      }
      
      // If automated installation failed, return instructions
      return {
        success: false,
        needsManual: true,
        instructions: instructions.steps
      };
    } catch (error) {
      logger.error('Docker installation failed', error);
      return {
        success: false,
        error: error.message,
        instructions: instructions.steps
      };
    }
  }

  /**
   * Generate docker-compose.yml for OpenClaw
   * @param {Object} config - Configuration options
   * @returns {string} Docker compose content
   */
  generateDockerCompose(config = {}) {
    const home = homedir();
    const port = config.port || 18789;
    const webchatPort = config.webchatPort || 3000;
    
    return `version: '3.8'

services:
  openclaw-gateway:
    image: ${this.imageName}
    container_name: ${this.containerName}
    restart: unless-stopped
    ports:
      - "${port}:${port}"
      - "${webchatPort}:3000"
    volumes:
      - ${home.replace(/\\/g, '/')}/.openclaw:/home/node/.openclaw
      - ${home.replace(/\\/g, '/')}/.openclaw/workspace:/home/node/.openclaw/workspace
    environment:
      - NODE_ENV=production
      - OPENCLAW_PORT=${port}
      - TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  default:
    name: openclaw-network
`;
  }

  /**
   * Generate Dockerfile for custom builds
   * @param {Object} config - Configuration
   * @returns {string} Dockerfile content
   */
  generateDockerfile(config = {}) {
    return `# OpenClaw Gateway Dockerfile
FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache git curl bash

# Create app directory
WORKDIR /home/node

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Create directories
RUN mkdir -p .openclaw/workspace .openclaw/logs

# Set permissions
RUN chown -R node:node /home/node

# Switch to non-root user
USER node

# Expose ports
EXPOSE 18789 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:18789/health || exit 1

# Start gateway
CMD ["openclaw", "gateway", "start"]
`;
  }

  /**
   * Install OpenClaw via Docker
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Installation result
   */
  async install(options = {}) {
    const { dryRun = false, config = {} } = options;
    const home = homedir();
    const dockerDir = join(home, '.openclaw', 'docker');
    
    logger.info('Installing OpenClaw via Docker...');
    
    // Check Docker is available
    if (!await this.isDockerInstalled()) {
      throw new Error('Docker is not installed. Please install Docker first.');
    }
    
    if (!await this.isDockerRunning()) {
      throw new Error('Docker is not running. Please start Docker Desktop.');
    }
    
    try {
      // Create docker directory
      if (!existsSync(dockerDir)) {
        if (!dryRun) {
          mkdirSync(dockerDir, { recursive: true });
        }
        logger.debug(`Created docker directory: ${dockerDir}`);
      }
      
      // Generate docker-compose.yml
      const composeContent = this.generateDockerCompose(config);
      const composePath = join(dockerDir, 'docker-compose.yml');
      
      if (dryRun) {
        logger.info('[DRY-RUN] Would create docker-compose.yml');
        logger.info('[DRY-RUN] Would run: docker-compose up -d');
        return { success: true, simulated: true };
      }
      
      writeFileSync(composePath, composeContent, 'utf-8');
      logger.debug(`Created docker-compose.yml: ${composePath}`);
      
      // Pull latest image
      logger.info('Pulling OpenClaw Docker image...');
      await executeCommand(`docker pull ${this.imageName}`);
      
      // Start container
      logger.info('Starting OpenClaw container...');
      await executeCommand(`docker-compose -f "${composePath}" up -d`);
      
      // Verify container is running
      const status = await this.getStatus();
      if (!status.running) {
        throw new Error('Container failed to start. Check docker logs for details.');
      }
      
      logger.info('OpenClaw Docker installation complete');
      return {
        success: true,
        containerName: this.containerName,
        composePath,
        ports: {
          gateway: config.port || 18789,
          webchat: config.webchatPort || 3000
        }
      };
    } catch (error) {
      logger.error('Docker installation failed', error);
      throw error;
    }
  }

  /**
   * Uninstall Docker-based OpenClaw
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async uninstall(options = {}) {
    const { dryRun = false, removeData = false } = options;
    const home = homedir();
    const composePath = join(home, '.openclaw', 'docker', 'docker-compose.yml');
    
    logger.info('Uninstalling OpenClaw Docker installation...');
    
    if (dryRun) {
      logger.info('[DRY-RUN] Would stop and remove container');
      if (removeData) {
        logger.info('[DRY-RUN] Would remove data volumes');
      }
      return { success: true, simulated: true };
    }
    
    try {
      // Stop and remove container
      if (existsSync(composePath)) {
        await executeCommand(`docker-compose -f "${composePath}" down`);
      } else {
        await executeCommand(`docker stop ${this.containerName}`).catch(() => {});
        await executeCommand(`docker rm ${this.containerName}`).catch(() => {});
      }
      
      // Optionally remove image
      if (removeData) {
        await executeCommand(`docker rmi ${this.imageName}`).catch(() => {});
      }
      
      logger.info('Docker installation removed');
      return { success: true };
    } catch (error) {
      logger.error('Docker uninstallation failed', error);
      throw error;
    }
  }

  /**
   * Get container status
   * @returns {Promise<Object>} Container status
   */
  async getStatus() {
    try {
      const { stdout } = await executeCommand(`docker inspect ${this.containerName} --format='{{.State.Status}}'`);
      const status = stdout.trim().replace(/'/g, '');
      
      return {
        installed: true,
        running: status === 'running',
        status,
        containerName: this.containerName
      };
    } catch {
      return {
        installed: false,
        running: false,
        status: 'not found',
        containerName: this.containerName
      };
    }
  }

  /**
   * Get container logs
   * @param {Object} options - Options
   * @returns {Promise<string>} Logs
   */
  async getLogs(options = {}) {
    const { lines = 100, follow = false } = options;
    
    try {
      const followFlag = follow ? '-f' : '';
      const { stdout } = await executeCommand(`docker logs ${this.containerName} --tail ${lines} ${followFlag}`);
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  /**
   * Start container
   * @returns {Promise<Object>} Result
   */
  async start() {
    logger.info('Starting OpenClaw container...');
    
    try {
      await executeCommand(`docker start ${this.containerName}`);
      return { success: true, running: true };
    } catch (error) {
      throw new Error(`Failed to start container: ${error.message}`);
    }
  }

  /**
   * Stop container
   * @returns {Promise<Object>} Result
   */
  async stop() {
    logger.info('Stopping OpenClaw container...');
    
    try {
      await executeCommand(`docker stop ${this.containerName}`);
      return { success: true, running: false };
    } catch (error) {
      throw new Error(`Failed to stop container: ${error.message}`);
    }
  }

  /**
   * Restart container
   * @returns {Promise<Object>} Result
   */
  async restart() {
    logger.info('Restarting OpenClaw container...');
    
    try {
      await executeCommand(`docker restart ${this.containerName}`);
      return { success: true, running: true };
    } catch (error) {
      throw new Error(`Failed to restart container: ${error.message}`);
    }
  }

  /**
   * Update to latest image
   * @returns {Promise<Object>} Result
   */
  async update() {
    logger.info('Updating OpenClaw Docker image...');
    
    try {
      // Pull latest
      await executeCommand(`docker pull ${this.imageName}`);
      
      // Recreate container
      const home = homedir();
      const composePath = join(home, '.openclaw', 'docker', 'docker-compose.yml');
      
      if (existsSync(composePath)) {
        await executeCommand(`docker-compose -f "${composePath}" up -d --force-recreate`);
      } else {
        await this.stop();
        await executeCommand(`docker rm ${this.containerName}`);
        // Would need config to recreate... this is a simplification
        logger.warn('Container removed. Please run install again with your config.');
      }
      
      return { success: true, updated: true };
    } catch (error) {
      throw new Error(`Failed to update: ${error.message}`);
    }
  }
}

export default new DockerManager();
