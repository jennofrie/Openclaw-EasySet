# OpenClaw EasySet 🦞🚀

> **Automated OpenClaw setup and configuration tool for the community**

OpenClaw EasySet is a robust, user-friendly CLI automation tool designed to streamline the installation and configuration of OpenClaw. It eliminates manual setup complexity by providing one-command installation, multi-platform support, and intelligent configuration wizards.

---

## ✨ Features

- **🔍 Platform Detection** - Automatically detects OS, architecture, and system capabilities
- **📦 Automated Installation** - One-command setup for all dependencies (Coming in Phase 2)
- **🖥️ Multi-Platform Support** - macOS, Linux, Windows compatibility
- **🐳 Dual Deployment** - Native or Docker installation options
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

---

## 📋 System Requirements

- **Node.js**: v18.0.0 or higher
- **Memory**: 4GB RAM minimum
- **Disk Space**: 1GB free space
- **OS**: macOS, Linux, or Windows (with WSL2)

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
- [ ] Docker installation flow (Coming Soon)
- [ ] Service management (Coming Soon)

### 📅 Phase 3: Advanced Features (Planned)

- [ ] Multi-terminal execution
- [ ] Skills marketplace integration
- [ ] Security hardening
- [ ] Backup & restore

---

## 💻 Usage

### Detect Platform

Check your system capabilities and get installation recommendations:

```bash
openclaw-easyset detect --recommendations
```

Output as JSON:

```bash
openclaw-easyset detect --json
```

### Install OpenClaw

```bash
# Interactive installation (recommended)
openclaw-easyset install

# Quick install with defaults
openclaw-easyset install --yes

# Dry-run to preview changes
openclaw-easyset install --dry-run

# Force install (skip requirements check)
openclaw-easyset install --force

# Docker installation (coming soon)
openclaw-easyset install --mode docker
```

**Supported Instances:**
- `profexor` 🦾 - Personal assistant (macOS, iMessage + NDIS coordination)
- `tokyoneon` 🌃 - Development engine (Windows, GPU + coding focus)
- `forge` 🔥 - Build automation (any platform)
- Custom - Create your own identity

### Check Status (Coming in Phase 2)

```bash
openclaw-easyset status --detailed
```

### Health Check (Coming in Phase 3)

```bash
openclaw-easyset doctor --fix
```

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

### Run with Debug Logging

```bash
npm start -- detect --debug
```

---

## 📚 Documentation

Comprehensive planning documentation is available in the `.planning/` directory:

- **[Implementation Plan](. planning/implementation-plan.md)** - Complete technical specifications
- **[Testing Guide](.planning/testing-guide.md)** - Testing methodology and safety protocols
- **[Delivery Summary](.planning/delivery-summary.md)** - Project deliverables overview

---

## 🛠️ Project Structure

```
openclaw-easyset/
├── src/
│   ├── commands/           # CLI commands
│   │   └── detect.js       # Platform detection command
│   ├── core/              # Core modules
│   │   ├── platform-detector.js
│   │   ├── logger.js
│   │   ├── config.js
│   │   └── utils.js
│   └── index.js           # Main CLI entry point
├── tests/                 # Jest tests
│   └── platform-detector.test.js
├── .planning/             # Planning documents
│   ├── implementation-plan.md
│   ├── testing-guide.md
│   └── delivery-summary.md
├── package.json
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
**Built with** 🦾 **by** Profexor

Part of the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem.

---

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/jennofrie/Openclaw-EasySet/issues)
- **OpenClaw Discord**: [Join the community](https://discord.com/invite/clawd)
- **Documentation**: [docs.openclaw.ai](https://docs.openclaw.ai)

---

## 🗺️ Roadmap

- **Phase 1** (✅ Complete): Foundation & Platform Detection
- **Phase 2** (In Progress): Installation & Configuration
- **Phase 3** (Planned): Advanced Features & Community Tools
- **Phase 4** (Future): Plugin Marketplace & Templates

---

**Let's make OpenClaw installation effortless! 🦞💙**
