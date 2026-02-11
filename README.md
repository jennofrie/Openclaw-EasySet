# OpenClaw EasySet 🦞🚀

> **Automated OpenClaw setup and configuration tool for the community**

OpenClaw EasySet is a robust, user-friendly CLI automation tool designed to streamline the installation and configuration of OpenClaw. It eliminates manual setup complexity by providing one-command installation, multi-platform support, and intelligent configuration wizards.

---

## ✨ Features

- **🔍 Platform Detection** - Automatically detects OS, architecture, and system capabilities
- **📦 Automated Installation** - One-command setup for native or Docker deployments
- **🖥️ Multi-Platform Support** - macOS, Linux, Windows 11 compatibility
- **🐳 Docker Support** - Full Docker-based installation and management
- **⚙️ Service Management** - Install as system service (Task Scheduler, launchd, systemd)
- **🎯 Skills Marketplace** - Browse, install, and manage OpenClaw skills
- **🔒 Security Hardening** - Security audits and profile-based hardening
- **💾 Backup & Restore** - Full backup and restore functionality
- **🖥️ Multi-Terminal** - Parallel terminal execution for installation
- **🧙 Interactive Wizards** - Guided configuration with intelligent defaults
- **✅ Safety Features** - Dry-run mode, backups, and rollback capabilities
- **📊 Health Checks** - Comprehensive system diagnostics

---

## 🚀 Quick Start

### Installation

```bash
npm install -g openclaw-easyset
```

### Check Your System

```bash
openclaw-easyset detect --recommendations
```

### Install OpenClaw

```bash
# Interactive installation (recommended)
openclaw-easyset install

# Quick install with defaults
openclaw-easyset install --yes

# Docker installation
openclaw-easyset install --mode docker
```

---

## 📋 System Requirements

- **Node.js**: v18.0.0 or higher
- **Memory**: 4GB RAM minimum
- **Disk Space**: 1GB free space
- **OS**: macOS, Linux, or Windows 11

---

## 🎯 Current Status

### ✅ Phase 1: Foundation (COMPLETE)

- [x] Platform detection (OS, architecture, system capabilities)
- [x] Logging system (Winston-based)
- [x] Configuration management
- [x] Core utilities
- [x] CLI framework (Commander.js)
- [x] Testing infrastructure (Jest)
- [x] Project documentation

### ✅ Phase 2: Installation (COMPLETE)

- [x] Native installation flow
- [x] Configuration wizard
- [x] Workspace template generation
- [x] Multi-instance support (Profexor, Tokyoneon, custom)
- [x] Identity file generation
- [x] Docker installation flow
- [x] Service management (Windows Task Scheduler, macOS launchd, Linux systemd)

### ✅ Phase 3: Advanced Features (COMPLETE)

- [x] Multi-terminal execution
- [x] Skills marketplace integration
- [x] Security hardening
- [x] Backup & restore
- [x] Health diagnostics (doctor command)

---

## 💻 Usage

### Platform Detection

```bash
# Check system capabilities
openclaw-easyset detect --recommendations

# Output as JSON
openclaw-easyset detect --json
```

### Installation

```bash
# Interactive installation
openclaw-easyset install

# Non-interactive with defaults
openclaw-easyset install --yes

# Docker installation
openclaw-easyset install --mode docker

# Dry-run to preview changes
openclaw-easyset install --dry-run

# Force install (skip requirements)
openclaw-easyset install --force
```

**Supported Instances:**
- `profexor` 🦾 - Personal assistant (macOS, iMessage + NDIS coordination)
- `tokyoneon` 🌃 - Development engine (Windows, GPU + coding focus)
- `forge` 🔥 - Build automation (any platform)
- Custom - Create your own identity

### Docker Management

```bash
# Install via Docker
openclaw-easyset docker install

# Check container status
openclaw-easyset docker status

# Start/stop container
openclaw-easyset docker start
openclaw-easyset docker stop

# View logs
openclaw-easyset docker logs -n 100

# Uninstall
openclaw-easyset docker uninstall
```

### Service Management

```bash
# Install as system service
openclaw-easyset service install

# Check service status
openclaw-easyset service status

# Start/stop/restart
openclaw-easyset service start
openclaw-easyset service stop
openclaw-easyset service restart

# Uninstall service
openclaw-easyset service uninstall
```

**Platform Support:**
- **Windows**: Task Scheduler
- **macOS**: launchd (LaunchAgents)
- **Linux**: systemd (user services)

### Skills Marketplace

```bash
# List installed skills
openclaw-easyset skills list

# Browse skill catalog
openclaw-easyset skills catalog

# Search for skills
openclaw-easyset skills search "calendar"

# Install a skill
openclaw-easyset skills install voice-call

# Update a skill
openclaw-easyset skills update voice-call

# Uninstall a skill
openclaw-easyset skills uninstall voice-call
```

### Security Hardening

```bash
# Run security audit
openclaw-easyset security --audit

# Auto-fix security issues
openclaw-easyset security --audit --fix

# Apply security profile
openclaw-easyset security --profile standard
# Profiles: minimal, standard, hardened

# Interactive security setup
openclaw-easyset security
```

### Backup & Restore

```bash
# Create backup
openclaw-easyset backup create

# List backups
openclaw-easyset backup list

# Restore from backup
openclaw-easyset backup restore

# Delete a backup
openclaw-easyset backup delete

# Export portable backup (sanitized)
openclaw-easyset backup export

# Import external backup
openclaw-easyset backup import --file backup.tar.gz
```

### Status & Diagnostics

```bash
# Check overall status
openclaw-easyset status

# Detailed status
openclaw-easyset status --detailed

# Run diagnostics
openclaw-easyset doctor

# Auto-fix issues
openclaw-easyset doctor --fix
```

### Multi-Terminal Execution

```bash
# Open installation terminals
openclaw-easyset terminals
```

Opens 3 terminal windows:
1. Main installation progress
2. Dependency installation logs
3. Gateway logs

---

## 🧪 Development

### Setup

```bash
git clone https://github.com/jennofrie/Openclaw-EasySet.git
cd Openclaw-EasySet
npm install
```

### Run Tests

```bash
npm test
```

### Run Locally

```bash
# Run CLI directly
node src/index.js detect --recommendations

# Run with debug logging
node src/index.js install --debug --dry-run
```

---

## 📚 Documentation

Comprehensive planning documentation is available in the `.planning/` directory:

- **[Implementation Plan](.planning/implementation-plan.md)** - Complete technical specifications
- **[Testing Guide](.planning/testing-guide.md)** - Testing methodology and safety protocols
- **[Delivery Summary](.planning/delivery-summary.md)** - Project deliverables overview

---

## 🛠️ Project Structure

```
openclaw-easyset/
├── src/
│   ├── commands/           # CLI commands
│   │   ├── detect.js       # Platform detection
│   │   ├── install.js      # Installation
│   │   ├── security.js     # Security hardening
│   │   └── backup.js       # Backup & restore
│   ├── core/               # Core modules
│   │   ├── platform-detector.js
│   │   ├── docker-manager.js
│   │   ├── terminal-orchestrator.js
│   │   ├── logger.js
│   │   ├── config.js
│   │   └── utils.js
│   ├── services/           # Service management
│   │   └── service-manager.js
│   ├── skills/             # Skills marketplace
│   │   └── marketplace.js
│   ├── templates/          # Workspace templates
│   │   └── workspace.js
│   └── index.js            # Main CLI entry
├── tests/                  # Jest tests
├── .planning/              # Planning docs
├── package.json
├── CHANGELOG.md
└── README.md
```

---

## 🔧 Technologies

- **Runtime**: Node.js v18+
- **CLI Framework**: Commander.js
- **UI**: Inquirer, Chalk, Ora, Boxen
- **Logging**: Winston
- **Testing**: Jest
- **Config**: YAML, JSON

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

**Developed by:** OpenClaw Community  
**Built with** 🦾 **by** Profexor & Tokyoneon

Part of the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem.

---

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/jennofrie/Openclaw-EasySet/issues)
- **OpenClaw Discord**: [Join the community](https://discord.com/invite/clawd)
- **Documentation**: [docs.openclaw.ai](https://docs.openclaw.ai)

---

## 🗺️ Roadmap

- **Phase 1** (✅ Complete): Foundation & Platform Detection
- **Phase 2** (✅ Complete): Installation & Configuration
- **Phase 3** (✅ Complete): Advanced Features & Security
- **Phase 4** (Planned): Plugin Templates & Community Tools

---

**Let's make OpenClaw installation effortless! 🦞💙**
