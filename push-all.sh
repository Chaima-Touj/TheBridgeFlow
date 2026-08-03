#!/bin/bash
set -e

echo "📤 Push vers ton repo (origin)..."
git push origin main

echo "📤 Sync front -> encadrant..."
git subtree split --prefix=thebridgeflow-front -b tmp-front-sync
git push encadrant-front tmp-front-sync:main --force
git branch -D tmp-front-sync

echo "📤 Sync back -> encadrant..."
git subtree split --prefix=thebridgeflow-back -b tmp-back-sync
git push encadrant-back tmp-back-sync:main --force
git branch -D tmp-back-sync

echo "✅ Push termine vers les 3 repos !"
