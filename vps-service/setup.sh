#!/usr/bin/env bash
set -euo pipefail

# ── Agent Foundry VPS Executor — Setup Script ────────────────────────────────
# Run this once on a fresh VPS to install dependencies and configure the service.

echo "=== Agent Foundry VPS Executor — Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Install Node.js 20+ first."
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ required. Found: $(node -v)"
  exit 1
fi

echo "Node.js $(node -v) detected"

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit it with your credentials."
else
  echo ".env already exists — skipping."
fi

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2 process manager..."
  sudo npm install -g pm2
fi

# Build Docker sandbox image if Docker is available
if command -v docker &> /dev/null; then
  if [ -f Dockerfile.sandbox ]; then
    echo "Building Docker sandbox image..."
    docker build -f Dockerfile.sandbox -t agent-foundry-sandbox:latest .
    echo "Docker sandbox image built successfully."
  fi
else
  echo "Warning: Docker not installed — code execution will not work."
  echo "  Install Docker: https://docs.docker.com/engine/install/"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your credentials"
echo "  2. Run: npm start         (foreground)"
echo "  3. Or:  ./deploy.sh       (PM2 background)"
echo ""
