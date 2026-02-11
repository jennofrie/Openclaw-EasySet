/**
 * Terminal Orchestrator Module
 * Manages multiple terminal windows for parallel execution
 * Supports: Windows Terminal, PowerShell, macOS Terminal, iTerm2, GNOME Terminal
 * @module core/terminal-orchestrator
 */

import { platform, homedir } from 'os';
import { join } from 'path';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { executeCommand, commandExists } from './utils.js';
import logger from './logger.js';

/**
 * Terminal Orchestrator Class
 */
class TerminalOrchestrator {
  constructor() {
    this.platform = platform();
    this.terminals = [];
  }

  /**
   * Detect available terminal emulators
   * @returns {Promise<Object>} Available terminals
   */
  async detectTerminals() {
    const available = {
      platform: this.platform,
      terminals: []
    };

    if (this.platform === 'win32') {
      // Windows terminals
      if (await commandExists('wt')) {
        available.terminals.push({ name: 'Windows Terminal', command: 'wt', recommended: true });
      }
      available.terminals.push({ name: 'PowerShell', command: 'powershell', recommended: false });
      available.terminals.push({ name: 'Command Prompt', command: 'cmd', recommended: false });
    } else if (this.platform === 'darwin') {
      // macOS terminals
      available.terminals.push({ name: 'Terminal.app', command: 'Terminal', recommended: true });
      if (existsSync('/Applications/iTerm.app')) {
        available.terminals.push({ name: 'iTerm2', command: 'iTerm', recommended: true });
      }
    } else {
      // Linux terminals
      if (await commandExists('gnome-terminal')) {
        available.terminals.push({ name: 'GNOME Terminal', command: 'gnome-terminal', recommended: true });
      }
      if (await commandExists('konsole')) {
        available.terminals.push({ name: 'Konsole', command: 'konsole', recommended: true });
      }
      if (await commandExists('xterm')) {
        available.terminals.push({ name: 'XTerm', command: 'xterm', recommended: false });
      }
      if (await commandExists('xfce4-terminal')) {
        available.terminals.push({ name: 'XFCE Terminal', command: 'xfce4-terminal', recommended: true });
      }
    }

    return available;
  }

  /**
   * Open a new terminal window with a command
   * @param {Object} options - Terminal options
   * @returns {Promise<Object>} Terminal instance info
   */
  async openTerminal(options = {}) {
    const {
      title = 'OpenClaw',
      command = '',
      workingDir = homedir(),
      terminal = null,
      keepOpen = true
    } = options;

    logger.debug(`Opening terminal: ${title}`);

    try {
      if (this.platform === 'win32') {
        return await this.openWindowsTerminal({ title, command, workingDir, terminal, keepOpen });
      } else if (this.platform === 'darwin') {
        return await this.openMacOSTerminal({ title, command, workingDir, terminal, keepOpen });
      } else {
        return await this.openLinuxTerminal({ title, command, workingDir, terminal, keepOpen });
      }
    } catch (error) {
      logger.error(`Failed to open terminal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Open Windows terminal
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async openWindowsTerminal(options) {
    const { title, command, workingDir, terminal, keepOpen } = options;

    // Check if Windows Terminal is available (preferred)
    const hasWT = await commandExists('wt');

    if (hasWT && terminal !== 'powershell') {
      // Use Windows Terminal (modern, supports tabs)
      const wtCommand = command
        ? `wt -w 0 new-tab --title "${title}" -d "${workingDir}" powershell -NoExit -Command "${command}"`
        : `wt -w 0 new-tab --title "${title}" -d "${workingDir}"`;
      
      await executeCommand(wtCommand);
      return { success: true, terminal: 'wt', title };
    } else {
      // Fallback to PowerShell
      const keepFlag = keepOpen ? '-NoExit' : '';
      const cmdPart = command ? `-Command "${command}"` : '';
      const psCommand = `start powershell ${keepFlag} ${cmdPart}`;
      
      await executeCommand(psCommand);
      return { success: true, terminal: 'powershell', title };
    }
  }

  /**
   * Open macOS terminal
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async openMacOSTerminal(options) {
    const { title, command, workingDir, terminal, keepOpen } = options;

    // Check for iTerm2
    const hasITerm = existsSync('/Applications/iTerm.app');

    if (hasITerm && terminal !== 'Terminal') {
      // Use iTerm2
      const script = `
tell application "iTerm"
  activate
  set newWindow to (create window with default profile)
  tell current session of newWindow
    set name to "${title}"
    write text "cd '${workingDir}'"
    ${command ? `write text "${command.replace(/"/g, '\\"')}"` : ''}
  end tell
end tell
`;
      await executeCommand(`osascript -e '${script}'`);
      return { success: true, terminal: 'iTerm', title };
    } else {
      // Use Terminal.app
      const script = `
tell application "Terminal"
  activate
  set newTab to do script "cd '${workingDir}'"
  set custom title of front window to "${title}"
  ${command ? `do script "${command.replace(/"/g, '\\"')}" in newTab` : ''}
end tell
`;
      await executeCommand(`osascript -e '${script}'`);
      return { success: true, terminal: 'Terminal', title };
    }
  }

  /**
   * Open Linux terminal
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async openLinuxTerminal(options) {
    const { title, command, workingDir, terminal } = options;

    // Detect available terminal
    let terminalCmd;
    let terminalName;

    if (terminal) {
      terminalCmd = terminal;
      terminalName = terminal;
    } else if (await commandExists('gnome-terminal')) {
      terminalCmd = 'gnome-terminal';
      terminalName = 'GNOME Terminal';
    } else if (await commandExists('konsole')) {
      terminalCmd = 'konsole';
      terminalName = 'Konsole';
    } else if (await commandExists('xfce4-terminal')) {
      terminalCmd = 'xfce4-terminal';
      terminalName = 'XFCE Terminal';
    } else if (await commandExists('xterm')) {
      terminalCmd = 'xterm';
      terminalName = 'XTerm';
    } else {
      throw new Error('No supported terminal emulator found');
    }

    // Build command based on terminal type
    let fullCommand;
    const bashCmd = command ? `bash -c 'cd "${workingDir}" && ${command}; exec bash'` : `bash`;

    switch (terminalCmd) {
      case 'gnome-terminal':
        fullCommand = `gnome-terminal --title="${title}" --working-directory="${workingDir}" -- ${bashCmd}`;
        break;
      case 'konsole':
        fullCommand = `konsole --workdir "${workingDir}" -e ${bashCmd}`;
        break;
      case 'xfce4-terminal':
        fullCommand = `xfce4-terminal --title="${title}" --working-directory="${workingDir}" -e "${bashCmd}"`;
        break;
      case 'xterm':
        fullCommand = `xterm -title "${title}" -e "cd '${workingDir}' && ${command || 'bash'}"`;
        break;
      default:
        fullCommand = `${terminalCmd} -e "${bashCmd}"`;
    }

    await executeCommand(fullCommand + ' &');
    return { success: true, terminal: terminalName, title };
  }

  /**
   * Open multiple terminals for parallel execution
   * @param {Array} configs - Array of terminal configurations
   * @returns {Promise<Array>} Results for each terminal
   */
  async openMultipleTerminals(configs) {
    const results = [];

    for (const config of configs) {
      try {
        const result = await this.openTerminal(config);
        results.push(result);
        this.terminals.push(result);
        
        // Small delay between opening terminals
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({ success: false, error: error.message, title: config.title });
      }
    }

    return results;
  }

  /**
   * Setup installation terminals (standard 3-terminal layout)
   * @param {Object} options - Setup options
   * @returns {Promise<Object>} Setup result
   */
  async setupInstallationTerminals(options = {}) {
    const { workingDir = homedir(), dryRun = false } = options;

    if (dryRun) {
      logger.info('[DRY-RUN] Would open 3 terminal windows:');
      logger.info('[DRY-RUN] 1. Main Installation Progress');
      logger.info('[DRY-RUN] 2. Dependency Logs');
      logger.info('[DRY-RUN] 3. Gateway Logs');
      return { success: true, simulated: true, terminals: 3 };
    }

    const terminalConfigs = [
      {
        title: '🦞 OpenClaw - Main Installation',
        command: 'echo "=== OpenClaw Installation ===" && echo "Waiting for installation to start..."',
        workingDir
      },
      {
        title: '📦 OpenClaw - Dependencies',
        command: 'echo "=== Dependency Installation Logs ===" && echo "Monitoring dependencies..."',
        workingDir
      },
      {
        title: '🔧 OpenClaw - Gateway Logs',
        command: 'echo "=== Gateway Logs ===" && echo "Waiting for gateway to start..." && tail -f ~/.openclaw/logs/gateway.log 2>/dev/null || echo "No logs yet..."',
        workingDir
      }
    ];

    const results = await this.openMultipleTerminals(terminalConfigs);

    return {
      success: results.every(r => r.success),
      terminals: results,
      count: results.length
    };
  }

  /**
   * Send command to a specific terminal (macOS/Linux only)
   * @param {string} terminalId - Terminal identifier
   * @param {string} command - Command to send
   * @returns {Promise<boolean>} Success
   */
  async sendToTerminal(terminalId, command) {
    // This is platform-specific and limited
    // For Windows, we'd need to use automation tools
    // For macOS, we can use AppleScript
    // For Linux, we'd need tmux or similar

    if (this.platform === 'darwin') {
      const script = `
tell application "Terminal"
  do script "${command.replace(/"/g, '\\"')}" in window 1
end tell
`;
      await executeCommand(`osascript -e '${script}'`);
      return true;
    }

    logger.warn('sendToTerminal only fully supported on macOS');
    return false;
  }

  /**
   * Close all opened terminals
   * @returns {Promise<void>}
   */
  async closeAll() {
    // Platform-specific close logic
    // This is best-effort as we can't reliably track terminal windows
    logger.info('Terminal close requested - terminals may need to be closed manually');
    this.terminals = [];
  }
}

export default new TerminalOrchestrator();
