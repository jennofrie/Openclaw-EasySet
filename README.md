# OpenClaw EasySet

> **Automated OpenClaw setup, configuration, and health monitoring CLI**

OpenClaw EasySet replaces manual configuration editing with interactive wizards, automated health checks, and a live status dashboard. Instead of hand-editing `openclaw.json`, running `launchctl` commands, and manually verifying services, EasySet handles it all through a single CLI.

---

## What It Does

| Manual Way | EasySet Way |
|-----------|-------------|
| Edit `~/.openclaw/openclaw.json` by hand | `openclaw-easyset configure plugins` |
| Check if gateway is running with `launchctl list \| grep openclaw` | `openclaw-easyset status` |
| Debug why things aren't working | `openclaw-easyset doctor --fix` |
| Remember to backup before changes | `openclaw-easyset backup create` |
| Install and configure gog CLI manually | `openclaw-easyset install` (guided) |
| Find and enable workspace skills | `openclaw-easyset configure skills` |

---

## Installation

```bash
git clone https://github.com/jennofrie/Openclaw-EasySet.git
cd Openclaw-EasySet
npm install
```

Run directly:

```bash
node src/index.js <command>
```

Or link globally:

```bash
npm link
openclaw-easyset <command>
```

---

## Commands

### `detect` - System Detection

Detect OS, architecture, Node.js, memory, installed tools, and package managers.

```bash
openclaw-easyset detect
openclaw-easyset detect --recommendations
openclaw-easyset detect --json
```

### `install` - Guided Installation

7-step guided installer: platform detection, OpenClaw install, plugin configuration (Memory LanceDB, LLM Task), Google Workspace CLI setup, skills discovery, and validation.

```bash
openclaw-easyset install              # Interactive wizard
openclaw-easyset install --dry-run    # Preview without changes
openclaw-easyset install --yes        # Accept all defaults
```

### `configure [section]` - Configuration Wizard

Reconfigure individual subsystems after installation.

```bash
openclaw-easyset configure            # Interactive menu
openclaw-easyset configure plugins    # Plugin setup (LanceDB, LLM Task)
openclaw-easyset configure skills     # Discover and enable workspace skills
openclaw-easyset configure gog        # Google Workspace CLI setup
```

### `doctor` - Health Checks

Runs 20+ diagnostics across configuration, services, connectivity, storage, security, and tools. Returns a health score and actionable fix suggestions.

```bash
openclaw-easyset doctor               # Run all checks
openclaw-easyset doctor --fix         # Auto-fix common issues
openclaw-easyset doctor --json        # Machine-readable output
```

Checks include:
- Config valid JSON, agent model, plugins, channels, gateway
- LaunchD services running (gateway, gmail-watch)
- Gateway HTTP health on port 18789
- Memory database and vector store status
- File permissions on sensitive configs (.env, openclaw.json)
- Auth profiles and gateway token strength
- Required tools (openclaw, node, npm) and optional tools (gog, imsg, git)
- Disk space and log file sizes

### `status` - Live Dashboard

Real-time view of your OpenClaw installation: version, agent config, channels, plugins, services, cron jobs, and storage.

```bash
openclaw-easyset status
openclaw-easyset status --detailed    # Include tool versions
openclaw-easyset status --json
```

### `backup [action]` - Config Backup & Restore

Create, list, and restore full configuration backups (openclaw.json, .env, credentials, cron jobs).

```bash
openclaw-easyset backup create                  # Create timestamped backup
openclaw-easyset backup create --label "stable" # With label
openclaw-easyset backup list                    # List all backups
openclaw-easyset backup restore                 # Interactive restore
```

Safety: restore always creates a pre-restore safety backup first.

---

## System Requirements

- **Node.js**: v18.0.0+
- **Memory**: 4GB RAM minimum
- **OS**: macOS (primary), Linux, Windows (WSL2)

---

## Project Structure

```
src/
  index.js                  # CLI entry point (6 commands)
  commands/
    detect.js               # Platform detection
    install.js              # 7-step guided installer
    configure.js            # Subsystem configuration
    doctor.js               # Health checks + auto-fix
    status.js               # Live status dashboard
    backup.js               # Backup create/list/restore
  core/
    platform-detector.js    # OS, arch, tools, package managers
    plugin-manager.js       # openclaw.json plugin config
    skill-manager.js        # Workspace skill discovery
    gog-setup.js            # Google Workspace CLI
    service-manager.js      # LaunchD service control
    health-checker.js       # 20+ diagnostic checks
    backup-manager.js       # Config backup & restore
    config.js               # EasySet's own config
    logger.js               # Winston logging
    utils.js                # Shared utilities
tests/
  platform-detector.test.js # Unit tests
```

---

## Development

```bash
npm install           # Install dependencies
npm test              # Run tests
npm start -- detect   # Run CLI
npm run dev           # Watch mode
```

Debug logging:

```bash
node src/index.js doctor --debug
```

---

## Current Status

### Phase 1: Foundation - Complete
- Platform detection (OS, architecture, system capabilities)
- Logging system (Winston), configuration management, core utilities
- CLI framework (Commander.js), testing infrastructure (Jest)

### Phase 2: Installation & Configuration - Complete
- Plugin wizard (Memory LanceDB, LLM Task) with config backup
- Skill discovery from `~/.openclaw/workspace/skills/`
- Google Workspace (gog) CLI setup with OAuth flow
- 7-step guided installer with `--dry-run` and `--yes`
- Subsystem configuration (`configure plugins/skills/gog`)

### Phase 3: Monitoring & Maintenance - Complete
- Doctor command with 20+ health checks and auto-fix
- Status dashboard with live service/channel/plugin state
- Service manager for launchd (gateway, gmail-watch)
- Config backup and restore with safety backups
- Security checks (file permissions, token strength)

### Planned
- Docker container management
- Multi-terminal execution

---

## Technologies

- **Runtime**: Node.js v18+
- **CLI**: Commander.js
- **UI**: Inquirer, Chalk, Ora, Boxen
- **Logging**: Winston
- **Testing**: Jest

---

## License

MIT - see [LICENSE](LICENSE)

---

**Built by** Profexor | Part of the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem
