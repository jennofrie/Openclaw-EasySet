# OpenClaw EasySet - Testing Guide Without Affecting Current Setup

**Version:** 1.0.0
**Created:** February 5, 2026
**Purpose:** Guide for testing OpenClaw EasySet without disrupting existing OpenClaw installations

---

## Table of Contents
1. [Overview](#overview)
2. [Testing Principles](#testing-principles)
3. [Isolation Strategies](#isolation-strategies)
4. [Testing Methods](#testing-methods)
5. [Test Scenarios](#test-scenarios)
6. [Validation Checklist](#validation-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### The Challenge
You have a working OpenClaw installation at:
- **Config:** `~/.openclaw/`
- **Gateway:** Running on port 18789
- **Channels:** Telegram, iMessage, Gmail configured
- **Services:** LaunchAgent installed and running

### The Goal
Test OpenClaw EasySet CLI tool without:
- ❌ Disrupting current gateway
- ❌ Modifying existing configuration
- ❌ Affecting running services
- ❌ Breaking channel integrations
- ❌ Losing data or settings

### The Solution
Use **isolation strategies** to create parallel, sandboxed test environments.

---

## Testing Principles

### Principle 1: Never Touch Production
```bash
# NEVER do this during testing
openclaw-easyset install

# ALWAYS use isolation flags
openclaw-easyset install --profile test --dry-run
```

### Principle 2: Use Dry-Run Mode
```bash
# Dry-run shows what WOULD happen without making changes
openclaw-easyset install --dry-run --verbose

# Output:
# [DRY-RUN] Would check: Node.js version
# [DRY-RUN] Would install: openclaw@latest
# [DRY-RUN] Would write: ~/.openclaw-test/openclaw.json
# [DRY-RUN] Would start: gateway on port 18789
# ✓ No actual changes made
```

### Principle 3: Isolate Everything
- **Config:** Use different directories (`--profile`)
- **Ports:** Use different ports (`--gateway-port`)
- **Services:** Use different service names
- **Containers:** Use separate Docker containers

### Principle 4: Verify Before Proceeding
```bash
# Always check current state first
openclaw status
launchctl list | grep openclaw
lsof -i :18789

# Proceed only if no conflicts
```

---

## Isolation Strategies

### Strategy 1: Profile-Based Isolation (Recommended)

**How It Works:**
The `--profile` flag creates a completely separate OpenClaw environment.

**Configuration:**
```bash
# Production installation (your current setup)
# Location: ~/.openclaw/
# Port: 18789
# Service: ai.openclaw.gateway

# Test installation (isolated)
# Location: ~/.openclaw-test/
# Port: 18790
# Service: ai.openclaw-test.gateway
```

**Usage:**
```bash
# All commands use the --profile flag
openclaw-easyset install --profile test --dry-run

# Resulting structure:
# ~/.openclaw/           # Your production setup (UNTOUCHED)
# ~/.openclaw-test/      # Test environment (ISOLATED)
#   ├── openclaw.json
#   ├── credentials/
#   ├── workspace/
#   └── logs/
```

**Benefits:**
- ✅ Complete isolation
- ✅ No port conflicts (uses different port)
- ✅ No service conflicts (uses different service name)
- ✅ Easy cleanup (`rm -rf ~/.openclaw-test`)

**Testing Commands:**
```bash
# Install in test profile
openclaw-easyset install --profile test --dry-run

# Configure test profile
openclaw-easyset configure --profile test gateway

# Check test profile status
openclaw-easyset status --profile test

# Start test gateway (uses port 18790)
openclaw gateway --profile test --port 18790

# Cleanup test profile
rm -rf ~/.openclaw-test
```

---

### Strategy 2: Docker Container Isolation

**How It Works:**
Run all tests inside ephemeral Docker containers that are destroyed after testing.

**Setup:**
```bash
# Create test Dockerfile
cat > Dockerfile.test <<'EOF'
FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache bash curl git

# Create test user
RUN adduser -D testuser
USER testuser
WORKDIR /home/testuser

# Copy openclaw-easyset
COPY --chown=testuser . /home/testuser/openclaw-easyset

CMD ["/bin/bash"]
EOF

# Build test image
docker build -f Dockerfile.test -t openclaw-easyset-test .
```

**Usage:**
```bash
# Run tests in container (ephemeral)
docker run -it --rm \
  -v $(pwd):/app \
  -w /app \
  openclaw-easyset-test \
  bash -c "npm test"

# Interactive testing
docker run -it --rm openclaw-easyset-test bash

# Inside container:
$ npm install -g ./openclaw-easyset
$ openclaw-easyset install --dry-run --verbose
$ openclaw-easyset doctor
$ exit

# Container is destroyed, no traces left
```

**Benefits:**
- ✅ Perfect isolation (separate file system, network, processes)
- ✅ No impact on host system
- ✅ Reproducible environment
- ✅ Easy cleanup (container auto-deleted with `--rm`)

**Advanced: Docker Compose for Full Stack Testing:**
```yaml
# docker-compose.test.yml
version: '3.8'

services:
  openclaw-easyset-test:
    build:
      context: .
      dockerfile: Dockerfile.test
    volumes:
      - ./src:/app/src:ro
      - test-data:/home/testuser/.openclaw
    environment:
      - NODE_ENV=test
      - OPENCLAW_GATEWAY_PORT=18790
    command: npm test

volumes:
  test-data:
```

**Run:**
```bash
# Run full test suite in Docker
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

---

### Strategy 3: Virtual Machine Isolation

**How It Works:**
Use VMs for full OS-level testing without touching your host machine.

**Tools:**
- **Multipass** (Ubuntu VMs, easy and fast)
- **VirtualBox** (Cross-platform, full control)
- **VMware Fusion** (macOS, professional)
- **Parallels** (macOS, best performance)

**Setup with Multipass (Easiest):**
```bash
# Install Multipass
brew install multipass

# Create test VM
multipass launch --name openclaw-test --cpus 2 --memory 4G --disk 20G

# Open shell in VM
multipass shell openclaw-test

# Inside VM:
ubuntu@openclaw-test:~$ curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
ubuntu@openclaw-test:~$ sudo apt-get install -y nodejs
ubuntu@openclaw-test:~$ npm install -g openclaw-easyset
ubuntu@openclaw-test:~$ openclaw-easyset install --mode native

# Exit VM
ubuntu@openclaw-test:~$ exit

# Delete VM when done
multipass delete openclaw-test
multipass purge
```

**Benefits:**
- ✅ True OS isolation
- ✅ Test on different platforms (Ubuntu, Debian, etc.)
- ✅ No risk to host system
- ✅ Can test system-level features (LaunchAgent, systemd)

**Setup with VirtualBox:**
```bash
# Download Ubuntu ISO
# Create VM with VirtualBox GUI
# Install Ubuntu
# Install Node.js and test

# Or use vagrant for automation:
vagrant init ubuntu/jammy64
vagrant up
vagrant ssh
# Run tests
vagrant destroy
```

---

### Strategy 4: Temporary Directory Testing

**How It Works:**
Use `/tmp` or custom temporary directories for throwaway installations.

**Setup:**
```bash
# Create temporary test directory
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

# Export environment to use test directory
export OPENCLAW_HOME=$TEST_DIR/openclaw
export OPENCLAW_WORKSPACE=$TEST_DIR/workspace

# Run installation
openclaw-easyset install \
  --home $TEST_DIR/openclaw \
  --workspace $TEST_DIR/workspace \
  --gateway-port 18790 \
  --dry-run

# Verify no changes to production
ls -la ~/.openclaw/  # Should be unchanged

# Cleanup
rm -rf $TEST_DIR
```

**Benefits:**
- ✅ Simple and fast
- ✅ No profile management needed
- ✅ Automatic cleanup on reboot (if using /tmp)

---

## Testing Methods

### Method 1: Dry-Run Testing (Safest)

**Purpose:** Validate logic without making any changes

**Commands:**
```bash
# Test full installation
openclaw-easyset install --dry-run --verbose

# Test specific components
openclaw-easyset configure gateway --dry-run
openclaw-easyset channels add telegram --dry-run
openclaw-easyset skills install calendar --dry-run

# Test with config file
openclaw-easyset install --config test-config.json --dry-run
```

**What Gets Tested:**
- ✅ Command parsing
- ✅ Configuration validation
- ✅ Dependency checks
- ✅ File path resolution
- ✅ Service detection

**What Doesn't Get Tested:**
- ❌ Actual file writes
- ❌ Package installations
- ❌ Service starts
- ❌ Network operations

**Output Example:**
```
[DRY-RUN] Platform detected: macOS (arm64)
[DRY-RUN] Node.js: v22.13.1 (installed)
[DRY-RUN] Would install: openclaw@latest
[DRY-RUN] Would create directory: /Users/profexer/.openclaw-test
[DRY-RUN] Would write config: /Users/profexer/.openclaw-test/openclaw.json
[DRY-RUN] Would install LaunchAgent: ai.openclaw-test.gateway.plist
[DRY-RUN] Would execute: launchctl load ~/Library/LaunchAgents/ai.openclaw-test.gateway.plist
[DRY-RUN] Would start gateway on port: 18790

✓ Dry-run complete - No changes made
```

---

### Method 2: Profile Testing (Safe, Limited Writes)

**Purpose:** Test with real file operations in isolated environment

**Setup:**
```bash
# Create test profile
PROFILE=test

# All operations use this profile
openclaw-easyset install --profile $PROFILE --gateway-port 18790

# Result: Installation at ~/.openclaw-test/
# Production at ~/.openclaw/ remains untouched
```

**Test Commands:**
```bash
# Install in test profile
openclaw-easyset install --profile test --mode native --gateway-port 18790 --yes

# Verify isolation
ls -la ~/.openclaw/      # Production (unchanged)
ls -la ~/.openclaw-test/ # Test installation (new files)

# Check services
launchctl list | grep openclaw
# Shows both: ai.openclaw.gateway (prod) and ai.openclaw-test.gateway (test)

# Check ports
lsof -i :18789  # Production gateway
lsof -i :18790  # Test gateway

# Test functionality
openclaw --profile test status
openclaw --profile test channels list
openclaw --profile test skills list

# Cleanup when done
openclaw-easyset uninstall --profile test
rm -rf ~/.openclaw-test
```

**What Gets Tested:**
- ✅ Real file operations
- ✅ Service installation (isolated)
- ✅ Port binding (different port)
- ✅ Configuration parsing
- ✅ Dependency installation

**Safety Check:**
```bash
# Before profile testing, verify production is safe
function verify_production() {
  echo "Checking production OpenClaw..."

  # Config should exist
  if [ ! -f ~/.openclaw/openclaw.json ]; then
    echo "❌ Production config missing!"
    return 1
  fi

  # Gateway should be running
  if ! lsof -i :18789 > /dev/null; then
    echo "⚠️  Production gateway not running"
  else
    echo "✓ Production gateway running"
  fi

  # Check service
  if launchctl list | grep -q "ai.openclaw.gateway"; then
    echo "✓ Production service installed"
  else
    echo "⚠️  Production service not found"
  fi

  echo "✓ Production check complete"
}

# Run check before testing
verify_production

# Run profile test
openclaw-easyset install --profile test --gateway-port 18790

# Verify production again
verify_production
```

---

### Method 3: Container Testing (Fully Isolated)

**Purpose:** Complete isolation for integration testing

**Docker Container Test:**
```bash
# Create test container
docker run -it --rm \
  --name openclaw-test \
  -v $(pwd):/workspace \
  -w /workspace \
  node:22-alpine \
  sh

# Inside container
$ apk add --no-cache bash curl git
$ npm install -g ./
$ openclaw-easyset install --mode native --yes
$ openclaw-easyset status
$ exit

# Container destroyed, no traces
```

**Docker Compose Test:**
```yaml
# test/docker-compose.yml
version: '3.8'

services:
  test-native:
    image: node:22-alpine
    volumes:
      - ..:/workspace
    working_dir: /workspace
    command: >
      sh -c "
        apk add --no-cache bash curl git &&
        npm install -g ./ &&
        openclaw-easyset install --mode native --dry-run --verbose
      "

  test-docker:
    image: node:22-alpine
    volumes:
      - ..:/workspace
      - /var/run/docker.sock:/var/run/docker.sock
    working_dir: /workspace
    command: >
      sh -c "
        apk add --no-cache bash curl git docker-cli &&
        npm install -g ./ &&
        openclaw-easyset install --mode docker --dry-run --verbose
      "
```

**Run Tests:**
```bash
# Run all test containers
docker-compose -f test/docker-compose.yml up --abort-on-container-exit

# Cleanup
docker-compose -f test/docker-compose.yml down -v
```

---

### Method 4: VM Testing (Full OS Isolation)

**Purpose:** Test on clean OS installations

**Multipass Automated Testing:**
```bash
#!/bin/bash
# test-in-vm.sh

VM_NAME="openclaw-test-$(date +%s)"

# Create VM
echo "Creating test VM: $VM_NAME"
multipass launch --name $VM_NAME --cpus 2 --memory 4G --disk 20G

# Wait for VM to be ready
multipass exec $VM_NAME -- cloud-init status --wait

# Copy project to VM
multipass transfer . $VM_NAME:/home/ubuntu/openclaw-easyset

# Run tests in VM
multipass exec $VM_NAME -- bash -c "
  cd /home/ubuntu/openclaw-easyset &&
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - &&
  sudo apt-get install -y nodejs &&
  npm install &&
  npm test &&
  sudo npm install -g ./ &&
  openclaw-easyset install --mode native --dry-run --verbose
"

# Capture exit code
EXIT_CODE=$?

# Cleanup
echo "Cleaning up VM: $VM_NAME"
multipass delete $VM_NAME
multipass purge

exit $EXIT_CODE
```

**Usage:**
```bash
# Run VM tests
chmod +x test-in-vm.sh
./test-in-vm.sh

# Output:
# Creating test VM: openclaw-test-1738777200
# Waiting for cloud-init...done
# Installing Node.js...
# Running tests...
# ✓ All tests passed
# Cleaning up VM...
# Done!
```

---

## Test Scenarios

### Scenario 1: Fresh System Test

**Objective:** Test installation on a system with no OpenClaw

**Method:** Docker container

**Commands:**
```bash
# Start fresh Alpine Linux container
docker run -it --rm node:22-alpine sh

# Inside container:
$ apk add --no-cache bash curl git
$ curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash
$ openclaw-easyset install --mode native --yes --verbose

# Validate:
$ openclaw status
$ openclaw channels list
$ openclaw skills list
```

**Expected Results:**
- ✅ Node.js detected
- ✅ OpenClaw installed successfully
- ✅ Gateway starts on port 18789
- ✅ No errors or warnings

---

### Scenario 2: Existing Installation Test

**Objective:** Test behavior when OpenClaw is already installed

**Method:** Profile isolation

**Setup:**
```bash
# Simulate existing installation
mkdir -p ~/.openclaw-existing
cat > ~/.openclaw-existing/openclaw.json <<EOF
{
  "gateway": { "port": 18789 },
  "channels": { "telegram": { "enabled": true } }
}
EOF
```

**Commands:**
```bash
# Run easyset with existing installation detected
OPENCLAW_HOME=~/.openclaw-existing openclaw-easyset install

# Expected behavior:
# ⚠️  Existing OpenClaw installation detected at ~/.openclaw-existing
#
# Options:
# 1. Upgrade existing installation
# 2. Install to new location
# 3. Backup and reinstall
# 4. Cancel
#
# Choose: _
```

**Cleanup:**
```bash
rm -rf ~/.openclaw-existing
```

---

### Scenario 3: Upgrade Test

**Objective:** Test upgrading from older OpenClaw version

**Method:** Profile + mock old version

**Setup:**
```bash
# Create test profile with "old" version
openclaw-easyset install --profile upgrade-test --gateway-port 18791

# Simulate old version
cat > ~/.openclaw-upgrade-test/version.json <<EOF
{"version": "2025.12.1"}
EOF
```

**Commands:**
```bash
# Run upgrade
openclaw-easyset update --profile upgrade-test

# Verify:
# - Config preserved
# - New version installed
# - Services updated
```

**Cleanup:**
```bash
rm -rf ~/.openclaw-upgrade-test
```

---

### Scenario 4: Channel Configuration Test

**Objective:** Test channel setup without real API keys

**Method:** Dry-run with mock config

**Commands:**
```bash
# Create mock config
cat > test-channels.json <<EOF
{
  "mode": "native",
  "channels": {
    "enabled": ["telegram", "discord"],
    "telegram": {
      "botToken": "MOCK_TOKEN_123"
    },
    "discord": {
      "botToken": "MOCK_TOKEN_456"
    }
  }
}
EOF

# Test channel configuration
openclaw-easyset configure --config test-channels.json --dry-run

# Expected:
# [DRY-RUN] Would enable Telegram channel
# [DRY-RUN] Would validate token: MOCK_TOKEN_123
# [DRY-RUN] Would enable Discord channel
# [DRY-RUN] Would validate token: MOCK_TOKEN_456
# [DRY-RUN] Would restart gateway
```

**Cleanup:**
```bash
rm test-channels.json
```

---

### Scenario 5: Error Recovery Test

**Objective:** Test rollback on installation failure

**Method:** Mock failure + verify rollback

**Setup:**
```bash
# Inject failure condition
export OPENCLAW_EASYSET_TEST_FAIL_AT="gateway-install"

# Run installation with failure
openclaw-easyset install --profile error-test --gateway-port 18792
```

**Expected Behavior:**
```
Installing OpenClaw...
✓ Platform detected: macOS (arm64)
✓ Dependencies checked
✓ OpenClaw installed
❌ Failed to install gateway service

Rolling back...
✓ Removed OpenClaw packages
✓ Cleaned up ~/.openclaw-error-test
✓ Rollback complete

Installation failed. Your system has been restored.
```

**Verify:**
```bash
# Production should be untouched
openclaw status  # Should work

# Test profile should be cleaned up
ls ~/.openclaw-error-test  # Should not exist
```

---

### Scenario 6: Multi-Platform Test

**Objective:** Test on macOS, Linux, Windows

**Method:** Use VMs or CI/CD

**GitHub Actions:**
```yaml
# .github/workflows/test.yml
name: Multi-Platform Test

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
        node: [18, 20, 22]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Test installation (dry-run)
        run: |
          npm link
          openclaw-easyset install --dry-run --verbose

      - name: Test in Docker (Linux only)
        if: runner.os == 'Linux'
        run: |
          docker run --rm \
            -v $(pwd):/workspace \
            -w /workspace \
            node:22-alpine \
            sh -c "npm install && npm test"
```

---

## Validation Checklist

### Before Testing
- [ ] Current OpenClaw installation is working
- [ ] Production config backed up
- [ ] Test strategy selected
- [ ] Test environment prepared

### During Testing
- [ ] Use isolation flags (`--profile`, `--dry-run`)
- [ ] Monitor production status
- [ ] Check for port conflicts
- [ ] Verify file paths

### After Each Test
- [ ] Production OpenClaw still works
- [ ] Test environment cleaned up
- [ ] Logs reviewed for errors
- [ ] Results documented

### Final Validation
```bash
# Production health check script
#!/bin/bash

echo "=== Production OpenClaw Health Check ==="

# 1. Config exists
if [ -f ~/.openclaw/openclaw.json ]; then
  echo "✓ Config file exists"
else
  echo "❌ Config file missing!"
  exit 1
fi

# 2. Gateway running
if lsof -i :18789 > /dev/null 2>&1; then
  echo "✓ Gateway running on port 18789"
else
  echo "❌ Gateway not running!"
  exit 1
fi

# 3. Service installed
if launchctl list | grep -q "ai.openclaw.gateway"; then
  echo "✓ LaunchAgent installed"
else
  echo "⚠️  LaunchAgent not found"
fi

# 4. API responsive
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Gateway API responding"
else
  echo "❌ Gateway API not responding (HTTP $HTTP_CODE)"
  exit 1
fi

echo ""
echo "✓ Production OpenClaw is healthy!"
```

**Usage:**
```bash
# Before testing
./health-check.sh

# After each test
./health-check.sh

# If health check fails after testing, restore from backup
```

---

## Troubleshooting

### Issue 1: "Profile still affects production"

**Symptoms:**
- Test commands modify production config
- Services conflict

**Solution:**
```bash
# Verify profile is actually being used
openclaw-easyset status --profile test --verbose

# Should show:
# Config path: /Users/profexer/.openclaw-test/openclaw.json
# NOT: /Users/profexer/.openclaw/openclaw.json

# If profile isn't working, file a bug report
```

### Issue 2: "Port 18789 already in use"

**Symptoms:**
- Test gateway can't start
- Port conflict error

**Solution:**
```bash
# Always use different port for testing
openclaw-easyset install --profile test --gateway-port 18790

# Or check what's using the port
lsof -i :18789

# If needed, use a random available port
openclaw-easyset install --profile test --gateway-port 0  # Auto-assign
```

### Issue 3: "Test files left behind"

**Symptoms:**
- Test profile not cleaned up
- Disk space used

**Solution:**
```bash
# Manual cleanup
rm -rf ~/.openclaw-test
rm -rf ~/.openclaw-*

# Uninstall test services
launchctl unload ~/Library/LaunchAgents/ai.openclaw-test.gateway.plist
rm ~/Library/LaunchAgents/ai.openclaw-test.gateway.plist

# Clean Docker containers
docker rm -f $(docker ps -aq --filter "name=openclaw-test")
docker volume rm $(docker volume ls -q --filter "name=openclaw-test")
```

### Issue 4: "Production broken after testing"

**Symptoms:**
- Production gateway won't start
- Channels not working
- Config corrupted

**Solution:**
```bash
# 1. Stop everything
openclaw gateway stop
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist

# 2. Restore from backup (you DID backup, right?)
cp ~/.openclaw/openclaw.json.backup ~/.openclaw/openclaw.json

# 3. Verify config
openclaw config validate

# 4. Restart
openclaw gateway start

# 5. If still broken, reinstall OpenClaw
npm install -g openclaw@latest --force
openclaw onboard --reset
```

---

## Best Practices

### 1. Always Use Isolation
```bash
# ❌ Bad
openclaw-easyset install

# ✅ Good
openclaw-easyset install --profile test --dry-run
```

### 2. Start with Dry-Run
```bash
# First: dry-run
openclaw-easyset install --dry-run

# Then: profile
openclaw-easyset install --profile test

# Finally: Docker
docker run -it --rm ... openclaw-easyset install
```

### 3. Backup Before Testing
```bash
# Backup production
cp -r ~/.openclaw ~/.openclaw.backup.$(date +%s)

# Test
openclaw-easyset install --profile test

# Restore if needed
rm -rf ~/.openclaw
mv ~/.openclaw.backup.XXXXX ~/.openclaw
```

### 4. Use Scripts for Repeatability
```bash
# test-suite.sh
#!/bin/bash
set -e

echo "1. Backing up production..."
cp -r ~/.openclaw ~/.openclaw.backup

echo "2. Running dry-run test..."
openclaw-easyset install --dry-run

echo "3. Running profile test..."
openclaw-easyset install --profile test --gateway-port 18790

echo "4. Verifying production..."
./health-check.sh

echo "5. Cleaning up..."
rm -rf ~/.openclaw-test

echo "✓ All tests passed!"
```

### 5. Document Each Test
```bash
# Create test log
cat > test-log-$(date +%Y%m%d-%H%M%S).md <<EOF
# Test Run: $(date)

## Environment
- OS: $(uname -s)
- Node: $(node -v)
- OpenClaw: $(openclaw --version)

## Test: Profile Installation

### Command
\`\`\`
openclaw-easyset install --profile test --gateway-port 18790
\`\`\`

### Result
✓ Success

### Notes
- Installation completed in 3m 42s
- No errors
- Production unaffected (verified with health-check.sh)

### Cleanup
\`\`\`
rm -rf ~/.openclaw-test
\`\`\`

EOF
```

---

## Summary

### Safe Testing Methods Ranked

**1. Dry-Run (Safest, Limited Testing)**
```bash
openclaw-easyset install --dry-run
```
- ✅ Zero risk
- ⚠️ Limited coverage

**2. Profile Isolation (Safe, Good Coverage)**
```bash
openclaw-easyset install --profile test --gateway-port 18790
```
- ✅ Low risk
- ✅ Good coverage
- ✅ Easy cleanup

**3. Docker Container (Safe, Full Coverage)**
```bash
docker run -it --rm node:22-alpine ...
```
- ✅ Zero risk to host
- ✅ Full coverage
- ✅ Reproducible

**4. Virtual Machine (Safest, Full Coverage, Slow)**
```bash
multipass launch --name test ...
```
- ✅ Complete isolation
- ✅ Full OS testing
- ⚠️ Slower

### Final Checklist

Before releasing OpenClaw EasySet:
- [ ] All tests pass in dry-run mode
- [ ] Profile tests pass without affecting production
- [ ] Docker tests pass
- [ ] VM tests pass on macOS, Linux, Windows
- [ ] Error recovery works correctly
- [ ] Documentation complete
- [ ] Community beta testing successful

---

**Remember:** When in doubt, use Docker containers or VMs. They provide perfect isolation with zero risk to your production setup.

**Testing Mantra:** *"If it touches `~/.openclaw/`, it better be in a container or have `--profile test`!"*

---

**Document Version:** 1.0.0
**Last Updated:** February 5, 2026
**Status:** Ready for Implementation
