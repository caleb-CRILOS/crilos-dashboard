#!/usr/bin/env bash
# Update CRILOS to the latest version (macOS / Linux).
# Pulls the newest code and reinstalls dependencies. Your personal data in
# data/ and any secrets are git-ignored, so they are left untouched.
#
# Run from the project folder:  ./update.sh
set -euo pipefail

echo "Pulling latest CRILOS code..."
git pull
echo "Installing dependencies..."
npm install
echo "Done. Start the app with:  npm run dev"
