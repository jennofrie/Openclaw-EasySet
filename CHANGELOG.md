# Changelog

All notable changes to OpenClaw EasySet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-11

### Added - Phase 3 Complete

#### Docker Management
- Full Docker installation and management (`openclaw-easyset docker`)
- Docker Compose generation
- Container lifecycle management (start/stop/restart/logs)
- Auto-pull latest OpenClaw image
- Health checks and status monitoring

#### Service Management
- Cross-platform service installation (`openclaw-easyset service`)
- Windows Task Scheduler support
- macOS launchd (LaunchAgents) support
- Linux systemd (user services) support
- Service lifecycle management (start/stop/restart/status)
- Auto-start on login/boot

#### Skills Marketplace
- Browse and search skills from ClawHub (`openclaw-easyset skills`)
- Install skills from catalog or git repositories
- Skill requirements checking (binaries, env vars, platforms)
- Uninstall and update skills
- Category-based catalog browsing

#### Security Hardening
- Security audit with scoring (`openclaw-easyset security --audit`)
- Auto-fix for common security issues
- Security profiles (minimal, standard, hardened)
- File permission checks (Unix)
- Configuration security analysis
- Interactive security setup wizard

#### Backup & Restore
- Full backup creation (`openclaw-easyset backup`)
- Selective item backup (config, workspace, skills, memory, logs)
- Compressed backup archives (tar.gz)
- Restore with pre-restore backup
- Export sanitized backups (API keys removed)
- Import external backups
- Interactive backup management

#### Multi-Terminal Execution
- Terminal emulator detection
- Open multiple terminals for parallel installation
- Platform-specific terminal support:
  - Windows: Windows Terminal, PowerShell
  - macOS: Terminal.app, iTerm2
  - Linux: GNOME Terminal, Konsole, XFCE Terminal, XTerm

#### Status & Diagnostics
- Comprehensive status command (`openclaw-easyset status`)
- Doctor command with auto-fix (`openclaw-easyset doctor`)
- Installation health checks
- Platform information display

### Changed
- Restructured CLI with subcommands for docker, service, skills, backup
- Updated package version to 2.0.0 (major feature release)
- Improved error handling throughout all modules
- Enhanced dry-run mode for all operations

---

## [1.1.0] - 2026-02-11

### Added
- **Install command** - Full native installation support
- **Interactive configuration wizard** - Guide users through setup
- **Workspace template generation** - Automatically create identity files
- **Multi-instance support** - Preconfigured templates for:
  - Profexor 🦾 (Personal assistant, NDIS coordinator)
  - Tokyoneon 🌃 (Development engine, GPU specialist)
  - Forge 🔥 (Build automation)
  - Custom instances
- **Windows-specific features** - Full Windows 11 support
- **WhatsApp brainstorming templates** - Cross-instance collaboration setup
- **Git integration** - Automatic repository initialization
- **PowerShell helper script** - Quick Windows installation
- **Dry-run mode** - Preview installation without making changes
- **Force install option** - Install even if requirements not met

### Fixed
- Fixed syntax error in `utils.js` (isWritable function)
- Fixed missing import in `utils.js` (fs constants)

### Changed
- Updated README with Phase 2 completion status
- Updated usage examples to reflect install command availability

## [1.0.0] - 2026-02-09

### Added
- Initial release
- Platform detection (OS, architecture, system capabilities)
- Logging system (Winston-based)
- Configuration management
- Core utilities
- CLI framework (Commander.js)
- Testing infrastructure (Jest)
- Comprehensive documentation
