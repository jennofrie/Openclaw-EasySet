/**
 * Service Manager Module
 * Handles installation and management of OpenClaw as a system service
 * Supports: Windows (Task Scheduler), macOS (launchd), Linux (systemd)
 * @module services/service-manager
 */

import { platform, homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { executeCommand, commandExists } from '../core/utils.js';
import logger from '../core/logger.js';

/**
 * Service Manager Class
 */
class ServiceManager {
  constructor() {
    this.platform = platform();
    this.serviceName = 'openclaw-gateway';
    this.serviceLabel = 'ai.openclaw.gateway';
  }

  /**
   * Get service configuration paths based on platform
   * @returns {Object} Service paths
   */
  getServicePaths() {
    const home = homedir();
    
    if (this.platform === 'win32') {
      return {
        type: 'task-scheduler',
        taskName: 'OpenClawGateway',
        xmlPath: join(home, '.openclaw', 'service', 'openclaw-task.xml'),
        logPath: join(home, '.openclaw', 'logs')
      };
    } else if (this.platform === 'darwin') {
      return {
        type: 'launchd',
        plistPath: join(home, 'Library', 'LaunchAgents', `${this.serviceLabel}.plist`),
        logPath: join(home, '.openclaw', 'logs')
      };
    } else {
      // Linux
      return {
        type: 'systemd',
        servicePath: join(home, '.config', 'systemd', 'user', `${this.serviceName}.service`),
        logPath: join(home, '.openclaw', 'logs')
      };
    }
  }

  /**
   * Generate Windows Task Scheduler XML
   * @param {Object} config - Service configuration
   * @returns {string} XML content
   */
  generateWindowsTaskXml(config = {}) {
    const home = homedir().replace(/\\/g, '\\\\');
    const nodePath = process.execPath.replace(/\\/g, '\\\\');
    
    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>OpenClaw Gateway Service - AI Assistant Backend</Description>
    <Author>OpenClaw</Author>
    <URI>\\OpenClaw\\Gateway</URI>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>openclaw</Command>
      <Arguments>gateway start</Arguments>
      <WorkingDirectory>${home}\\.openclaw</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
  }

  /**
   * Generate macOS launchd plist
   * @param {Object} config - Service configuration
   * @returns {string} Plist content
   */
  generateMacOSPlist(config = {}) {
    const home = homedir();
    const openclawPath = '/usr/local/bin/openclaw';
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${this.serviceLabel}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${openclawPath}</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>WorkingDirectory</key>
    <string>${home}/.openclaw</string>
    <key>StandardOutPath</key>
    <string>${home}/.openclaw/logs/gateway.log</string>
    <key>StandardErrorPath</key>
    <string>${home}/.openclaw/logs/gateway-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${home}</string>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>`;
  }

  /**
   * Generate Linux systemd service file
   * @param {Object} config - Service configuration
   * @returns {string} Service content
   */
  generateLinuxSystemdService(config = {}) {
    const home = homedir();
    
    return `[Unit]
Description=OpenClaw Gateway Service
Documentation=https://docs.openclaw.ai
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/openclaw gateway start
WorkingDirectory=${home}/.openclaw
Restart=on-failure
RestartSec=10
StandardOutput=append:${home}/.openclaw/logs/gateway.log
StandardError=append:${home}/.openclaw/logs/gateway-error.log
Environment=HOME=${home}
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
`;
  }

  /**
   * Install service
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Installation result
   */
  async install(options = {}) {
    const { dryRun = false } = options;
    const paths = this.getServicePaths();
    
    logger.info(`Installing service for ${paths.type}...`);
    
    try {
      // Create log directory
      if (!existsSync(paths.logPath)) {
        if (!dryRun) {
          mkdirSync(paths.logPath, { recursive: true });
        }
        logger.debug(`Created log directory: ${paths.logPath}`);
      }
      
      if (this.platform === 'win32') {
        return await this.installWindowsService(paths, dryRun);
      } else if (this.platform === 'darwin') {
        return await this.installMacOSService(paths, dryRun);
      } else {
        return await this.installLinuxService(paths, dryRun);
      }
    } catch (error) {
      logger.error('Service installation failed', error);
      throw error;
    }
  }

  /**
   * Install Windows Task Scheduler service
   * @param {Object} paths - Service paths
   * @param {boolean} dryRun - Dry run mode
   * @returns {Promise<Object>} Result
   */
  async installWindowsService(paths, dryRun) {
    const xmlContent = this.generateWindowsTaskXml();
    
    // Create service directory
    const serviceDir = join(homedir(), '.openclaw', 'service');
    if (!existsSync(serviceDir)) {
      if (!dryRun) {
        mkdirSync(serviceDir, { recursive: true });
      }
    }
    
    if (dryRun) {
      logger.info('[DRY-RUN] Would create task XML:', paths.xmlPath);
      logger.info('[DRY-RUN] Would run: schtasks /create /tn "OpenClawGateway" /xml ...');
      return { success: true, simulated: true };
    }
    
    // Write XML file
    writeFileSync(paths.xmlPath, xmlContent, 'utf-8');
    logger.debug(`Created task XML: ${paths.xmlPath}`);
    
    // Register task
    try {
      await executeCommand(`schtasks /create /tn "OpenClawGateway" /xml "${paths.xmlPath}" /f`);
      logger.info('Windows Task Scheduler service installed');
      return { success: true, type: 'task-scheduler' };
    } catch (error) {
      // Try PowerShell alternative
      try {
        await executeCommand(`powershell -Command "Register-ScheduledTask -Xml (Get-Content '${paths.xmlPath}' | Out-String) -TaskName 'OpenClawGateway' -Force"`);
        logger.info('Windows Task Scheduler service installed (via PowerShell)');
        return { success: true, type: 'task-scheduler' };
      } catch (psError) {
        throw new Error(`Failed to install Windows service: ${psError.message}`);
      }
    }
  }

  /**
   * Install macOS launchd service
   * @param {Object} paths - Service paths
   * @param {boolean} dryRun - Dry run mode
   * @returns {Promise<Object>} Result
   */
  async installMacOSService(paths, dryRun) {
    const plistContent = this.generateMacOSPlist();
    
    if (dryRun) {
      logger.info('[DRY-RUN] Would create plist:', paths.plistPath);
      logger.info('[DRY-RUN] Would run: launchctl load ...');
      return { success: true, simulated: true };
    }
    
    // Write plist file
    writeFileSync(paths.plistPath, plistContent, 'utf-8');
    logger.debug(`Created plist: ${paths.plistPath}`);
    
    // Load service
    try {
      await executeCommand(`launchctl load -w "${paths.plistPath}"`);
      logger.info('macOS launchd service installed and loaded');
      return { success: true, type: 'launchd' };
    } catch (error) {
      throw new Error(`Failed to install macOS service: ${error.message}`);
    }
  }

  /**
   * Install Linux systemd service
   * @param {Object} paths - Service paths
   * @param {boolean} dryRun - Dry run mode
   * @returns {Promise<Object>} Result
   */
  async installLinuxService(paths, dryRun) {
    const serviceContent = this.generateLinuxSystemdService();
    
    // Create systemd user directory
    const systemdDir = join(homedir(), '.config', 'systemd', 'user');
    if (!existsSync(systemdDir)) {
      if (!dryRun) {
        mkdirSync(systemdDir, { recursive: true });
      }
    }
    
    if (dryRun) {
      logger.info('[DRY-RUN] Would create service file:', paths.servicePath);
      logger.info('[DRY-RUN] Would run: systemctl --user enable/start ...');
      return { success: true, simulated: true };
    }
    
    // Write service file
    writeFileSync(paths.servicePath, serviceContent, 'utf-8');
    logger.debug(`Created service file: ${paths.servicePath}`);
    
    // Reload and enable service
    try {
      await executeCommand('systemctl --user daemon-reload');
      await executeCommand(`systemctl --user enable ${this.serviceName}`);
      await executeCommand(`systemctl --user start ${this.serviceName}`);
      logger.info('Linux systemd service installed and started');
      return { success: true, type: 'systemd' };
    } catch (error) {
      throw new Error(`Failed to install Linux service: ${error.message}`);
    }
  }

  /**
   * Uninstall service
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async uninstall(options = {}) {
    const { dryRun = false } = options;
    const paths = this.getServicePaths();
    
    logger.info(`Uninstalling service for ${paths.type}...`);
    
    try {
      if (this.platform === 'win32') {
        if (dryRun) {
          logger.info('[DRY-RUN] Would delete task: OpenClawGateway');
          return { success: true, simulated: true };
        }
        await executeCommand('schtasks /delete /tn "OpenClawGateway" /f');
        if (existsSync(paths.xmlPath)) {
          unlinkSync(paths.xmlPath);
        }
      } else if (this.platform === 'darwin') {
        if (dryRun) {
          logger.info('[DRY-RUN] Would unload and remove plist');
          return { success: true, simulated: true };
        }
        await executeCommand(`launchctl unload -w "${paths.plistPath}"`).catch(() => {});
        if (existsSync(paths.plistPath)) {
          unlinkSync(paths.plistPath);
        }
      } else {
        if (dryRun) {
          logger.info('[DRY-RUN] Would disable and remove service');
          return { success: true, simulated: true };
        }
        await executeCommand(`systemctl --user stop ${this.serviceName}`).catch(() => {});
        await executeCommand(`systemctl --user disable ${this.serviceName}`).catch(() => {});
        if (existsSync(paths.servicePath)) {
          unlinkSync(paths.servicePath);
        }
        await executeCommand('systemctl --user daemon-reload');
      }
      
      logger.info('Service uninstalled successfully');
      return { success: true };
    } catch (error) {
      logger.error('Service uninstallation failed', error);
      throw error;
    }
  }

  /**
   * Start service
   * @returns {Promise<Object>} Result
   */
  async start() {
    logger.info('Starting service...');
    
    try {
      if (this.platform === 'win32') {
        await executeCommand('schtasks /run /tn "OpenClawGateway"');
      } else if (this.platform === 'darwin') {
        await executeCommand(`launchctl start ${this.serviceLabel}`);
      } else {
        await executeCommand(`systemctl --user start ${this.serviceName}`);
      }
      
      logger.info('Service started');
      return { success: true, running: true };
    } catch (error) {
      logger.error('Failed to start service', error);
      throw error;
    }
  }

  /**
   * Stop service
   * @returns {Promise<Object>} Result
   */
  async stop() {
    logger.info('Stopping service...');
    
    try {
      if (this.platform === 'win32') {
        await executeCommand('schtasks /end /tn "OpenClawGateway"');
      } else if (this.platform === 'darwin') {
        await executeCommand(`launchctl stop ${this.serviceLabel}`);
      } else {
        await executeCommand(`systemctl --user stop ${this.serviceName}`);
      }
      
      logger.info('Service stopped');
      return { success: true, running: false };
    } catch (error) {
      logger.error('Failed to stop service', error);
      throw error;
    }
  }

  /**
   * Restart service
   * @returns {Promise<Object>} Result
   */
  async restart() {
    await this.stop().catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.start();
  }

  /**
   * Get service status
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    try {
      if (this.platform === 'win32') {
        const { stdout } = await executeCommand('schtasks /query /tn "OpenClawGateway" /fo LIST');
        const running = stdout.includes('Running');
        const installed = true;
        return { installed, running, type: 'task-scheduler' };
      } else if (this.platform === 'darwin') {
        const { stdout } = await executeCommand(`launchctl list | grep ${this.serviceLabel}`);
        const installed = stdout.includes(this.serviceLabel);
        const running = !stdout.startsWith('-');
        return { installed, running, type: 'launchd' };
      } else {
        const { stdout } = await executeCommand(`systemctl --user is-active ${this.serviceName}`);
        const running = stdout.trim() === 'active';
        return { installed: true, running, type: 'systemd' };
      }
    } catch (error) {
      return { installed: false, running: false, type: this.getServicePaths().type };
    }
  }
}

export default new ServiceManager();
