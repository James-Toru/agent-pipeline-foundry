#!/usr/bin/env bash
set -euo pipefail

# ── Agent Foundry VPS Executor — Deploy Script ──────────────────────────────
# Starts (or restarts) the service via PM2 process manager.

APP_NAME="agent-foundry-executor"

echo "=== Deploying $APP_NAME ==="

# Check .env exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Run ./setup.sh first."
  exit 1
fi

# Install/update dependencies
echo "Installing dependencies..."
npm install --production=false

# Stop existing instance if running
if pm2 list | grep -q "$APP_NAME"; then
  echo "Stopping existing instance..."
  pm2 stop "$APP_NAME" 2>/dev/null || true
  pm2 delete "$APP_NAME" 2>/dev/null || true
fi

# Start with PM2
echo "Starting $APP_NAME with PM2..."
pm2 start npx \
  --name "$APP_NAME" \
  -- tsx src/index.ts

# Save PM2 process list so it auto-restarts on reboot
pm2 save

echo ""
echo "=== Deployed ==="
echo ""
echo "Commands:"
echo "  pm2 logs $APP_NAME      — view logs"
echo "  pm2 restart $APP_NAME   — restart"
echo "  pm2 stop $APP_NAME      — stop"
echo "  pm2 monit                — monitor all processes"
echo ""

# Show status
pm2 status
