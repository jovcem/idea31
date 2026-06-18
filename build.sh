#!/bin/bash
set -e

echo "1/3  Building React frontend..."
cd "$(dirname "$0")/frontend"
npm run build

echo "2/3  Copying static build into backend..."
BACKEND="$(dirname "$0")/backend"
rm -rf "$BACKEND/static"
cp -r dist "$BACKEND/static"

echo "3/3  Packaging with PyInstaller..."
cd "$BACKEND"
pyinstaller \
  --onefile \
  --windowed \
  --name "WebScraper" \
  --add-data "static:static" \
  --add-data ".env:." \
  desktop.py

echo ""
echo "Done — binary is at backend/dist/WebScraper"
