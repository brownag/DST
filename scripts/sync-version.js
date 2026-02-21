#!/usr/bin/env node

/**
 * Sync Version Utility
 * Keeps manifest.json version in sync with package.json
 *
 * Usage:
 *   node scripts/sync-version.js
 *
 * This utility reads the version from package.json and updates
 * manifest.json to match. Run this before releasing a new version.
 */

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const manifestPath = path.join(__dirname, '../manifest.json');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;

  if (!version) {
    console.error('Error: No version field in package.json');
    process.exit(1);
  }

  // Read manifest.json
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Update version
  const oldVersion = manifest.version;
  manifest.version = version;

  // Write manifest.json back
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Version synced: ${oldVersion || 'N/A'} -> ${version}`);
  console.log(`  package.json: ${version}`);
  console.log(`  manifest.json: ${version}`);
} catch (error) {
  console.error('Error syncing versions:', error.message);
  process.exit(1);
}
