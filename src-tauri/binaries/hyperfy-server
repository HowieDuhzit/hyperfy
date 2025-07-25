#!/usr/bin/env node

// Simple server script for Tauri sidecar
const path = require('path');
const fs = require('fs');

// Find the built server files
const serverPath = path.join(__dirname, '../../build/index.js');

if (!fs.existsSync(serverPath)) {
  console.error('Server build not found. Please run "npm run build" first.');
  process.exit(1);
}

// Start the server
require(serverPath); 