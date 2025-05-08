/**
 * Helper script for installing the Sign Language Recognition API server dependencies
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Determine the server directory
const serverDir = path.join(__dirname, 'server');

// Check if server directory exists
if (!fs.existsSync(serverDir)) {
  console.error(`Error: Server directory not found at ${serverDir}`);
  process.exit(1);
}

// Select appropriate command based on OS
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('Installing Sign Language Recognition API server dependencies...');
console.log(`Server directory: ${serverDir}`);
console.log('This may take a few minutes as TensorFlow.js Node binaries are large...');

// Run npm install in the server directory
const installProcess = spawn(npmCmd, ['install'], {
  cwd: serverDir,
  stdio: 'inherit'
});

// Handle process events
installProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Server dependencies installed successfully!');
    console.log('\nYou can now start the server with:');
    console.log('  npm run server');
  } else {
    console.error(`\n❌ Installation failed with code ${code}`);
    console.error('Please try running "cd server && npm install" manually');
  }
});

installProcess.on('error', (err) => {
  console.error('Failed to start installation:', err);
}); 