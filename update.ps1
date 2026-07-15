# Update CRILOS to the latest version (Windows / PowerShell).
# Pulls the newest code and reinstalls dependencies. Your personal data in
# data/ and any secrets are git-ignored, so they are left untouched.
#
# Run from the project folder:  ./update.ps1

$ErrorActionPreference = "Stop"
Write-Host "Pulling latest CRILOS code..." -ForegroundColor Cyan
git pull
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
Write-Host "Done. Start the app with:  npm run dev" -ForegroundColor Green
