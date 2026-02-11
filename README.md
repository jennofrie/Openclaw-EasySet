# OpenClaw EasySet

> **Automated OpenClaw setup, configuration, and health monitoring CLI**

OpenClaw EasySet replaces manual configuration editing with interactive wizards, automated health checks, and a live status dashboard. Instead of hand-editing `openclaw.json`, running `launchctl` commands, and manually verifying services, EasySet handles it all through a single CLI.

---

## What It Does

| Manual Way | EasySet Way |
|-----------|-------------|
| Install OpenClaw, run `openclaw onboard`, configure daemon | `openclaw-easyset install` (guided 9-step wizard) |
| Edit `~/.openclaw/openclaw.json` by hand | `openclaw-easyset configure plugins` |
| Set up Telegram bot, iMessage, Gmail channels manually | `openclaw-easyset configure channels` |
| Check if gateway is running with `launchctl list \| grep openclaw` | `openclaw-easyset status` |
| Debug why things aren't working | `openclaw-easyset doctor --fix` |
| Remember to backup before changes | `openclaw-easyset backup create` |
| Run security checks manually | `openclaw-easyset security --audit` |
| Install Docker, write docker-compose, manage containers | `openclaw-easyset docker install` |
| Configure launchd/systemd/task scheduler service | `openclaw-easyset service install` |
| Find and install skills from ClawHub | `openclaw-easyset skills catalog` |

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

### `install` - Guided 9-Step Installation

Full installation wizard: platform detection, OpenClaw install, `openclaw onboard` (LLM provider + API keys + daemon), plugin configuration (Memory LanceDB, LLM Task), Google Workspace CLI setup, channel setup (Telegram, iMessage, Gmail, Webchat), skills discovery, and validation.

```bash
openclaw-easyset install              # Interactive wizard
openclaw-easyset install --dry-run    # Preview without changes
openclaw-easyset install --yes        # Accept all defaults
```

### `detect` - System Detection

Detect OS, architecture, Node.js, memory, installed tools, and package managers.

```bash
openclaw-easyset detect
openclaw-easyset detect --recommendations
openclaw-easyset detect --json
```

### `configure [section]` - Configuration Wizard

Reconfigure individual subsystems after installation.

```bash
openclaw-easyset configure            # Interactive menu
openclaw-easyset configure plugins    # Plugin setup (LanceDB, LLM Task)
openclaw-easyset configure channels   # Channel setup (Telegram, iMessage, Gmail, Webchat)
openclaw-easyset configure skills     # Discover and enable workspace skills
openclaw-easyset configure gog        # Google Workspace CLI setup
openclaw-easyset configure security   # Security audit and hardening
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

### `security` - Security Audit & Hardening

Run security audits with scoring (A-F grades), apply hardening profiles, and auto-fix file permissions.

```bash
openclaw-easyset security --audit              # Run security audit
openclaw-easyset security --profile standard   # Apply security profile
openclaw-easyset security --fix                # Auto-fix issues
```

Profiles: `minimal`, `standard`, `hardened`

### `docker [action]` - Docker Container Management

Install and manage OpenClaw via Docker. Generates docker-compose.yml, handles container lifecycle.

```bash
openclaw-easyset docker                # Interactive menu
openclaw-easyset docker install        # Install via Docker
openclaw-easyset docker status         # Container status
openclaw-easyset docker start|stop|restart
openclaw-easyset docker logs           # View container logs
openclaw-easyset docker update         # Pull latest image
```

### `service [action]` - System Service Management

Install OpenClaw as a system service (macOS launchd, Linux systemd, Windows Task Scheduler).

```bash
openclaw-easyset service               # Interactive menu
openclaw-easyset service install       # Install as system service
openclaw-easyset service status        # Check service status
openclaw-easyset service start|stop|restart
openclaw-easyset service uninstall
```

### `skills [action]` - Skills Marketplace

Browse, install, and manage OpenClaw skills from ClawHub and git repositories.

```bash
openclaw-easyset skills                # Interactive menu
openclaw-easyset skills list           # List installed skills
openclaw-easyset skills catalog        # Browse available skills
openclaw-easyset skills search --query "gmail"
openclaw-easyset skills install --name github
openclaw-easyset skills uninstall --name weather
openclaw-easyset skills update --name github
```

---

## System Requirements

- **Node.js**: v18.0.0+
- **Memory**: 4GB RAM minimum
- **OS**: macOS (primary), Linux, Windows (WSL2)

---

## Project Structure

```
src/
  index.js                  # CLI entry point (10 commands)
  commands/
    detect.js               # Platform detection
    install.js              # 9-step guided installer
    configure.js            # Subsystem configuration (5 sections)
    doctor.js               # Health checks + auto-fix
    status.js               # Live status dashboard
    backup.js               # Backup create/list/restore
    security.js             # Security audit & hardening
    docker.js               # Docker container management
    service.js              # System service management
    skills.js               # Skills marketplace CLI
  core/
    platform-detector.js    # OS, arch, tools, package managers
    plugin-manager.js       # openclaw.json plugin config
    skill-manager.js        # Workspace skill discovery
    gog-setup.js            # Google Workspace CLI
    channel-setup.js        # Channel configuration (Telegram, iMessage, Gmail, Webchat)
    docker-manager.js       # Docker lifecycle management
    service-manager.js      # LaunchD service control
    health-checker.js       # 20+ diagnostic checks
    backup-manager.js       # Config backup & restore
    terminal-orchestrator.js # Multi-terminal execution
    config.js               # EasySet's own config
    logger.js               # Winston logging
    utils.js                # Shared utilities
  services/
    service-manager.js      # Cross-platform service management (launchd/systemd/task scheduler)
  skills/
    marketplace.js          # ClawHub skill catalog, install, update
  templates/
    workspace.js            # Instance workspace file generation
tests/
  platform-detector.test.js
  health-checker.test.js
  service-manager.test.js
  backup-manager.test.js
```

---

## Development

```bash
npm install           # Install dependencies
npm test              # Run tests (20 tests, 4 suites)
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
- 9-step guided installer with `openclaw onboard` integration
- Plugin wizard (Memory LanceDB, LLM Task) with config backup
- Channel setup (Telegram, iMessage, Gmail Pub/Sub, Webchat)
- Skill discovery from `~/.openclaw/workspace/skills/`
- Google Workspace (gog) CLI setup with OAuth flow
- Subsystem configuration (`configure plugins/channels/skills/gog/security`)

### Phase 3: Monitoring & Maintenance - Complete
- Doctor command with 20+ health checks and auto-fix
- Status dashboard with live service/channel/plugin state
- Service manager for launchd (gateway, gmail-watch)
- Config backup and restore with safety backups
- Security audit with A-F scoring and hardening profiles

### Phase 4: Infrastructure - Complete
- Docker container management (install, start, stop, logs, update)
- Cross-platform system service management (launchd, systemd, Task Scheduler)
- Skills marketplace (ClawHub catalog, git install, update, uninstall)
- Security command with 3 profiles (minimal, standard, hardened)

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
