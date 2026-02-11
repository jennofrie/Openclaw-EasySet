# Changelog

All notable changes to OpenClaw EasySet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
