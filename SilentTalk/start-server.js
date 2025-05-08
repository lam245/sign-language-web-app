/**
 * Script to start the Sign Language Recognition API server
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Determine the server directory
const serverDir = path.join(__dirname, 'server');

// Select appropriate command based on OS
const isWindows = os.platform() === 'win32';
const command = isWindows ? 'npm.cmd' : 'npm';

console.log('Starting Sign Language Recognition API server...');
console.log(`Server directory: ${serverDir}`);

// Start the server using npm
const server = spawn(command, ['start'], {
  cwd: serverDir,
  stdio: 'inherit'
});

// Handle server exit
server.on('close', (code) => {
  console.log(`Sign Language Recognition API server exited with code ${code}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Failed to start server:', err);
});

console.log('Server process started. Press Ctrl+C to stop.');

// Handle process termination to properly shut down the server
process.on('SIGINT', () => {
  console.log('Stopping Sign Language Recognition API server...');
  if (!isWindows) {
    server.kill('SIGINT');
  } else {
    // On Windows, we need to use a different approach
    spawn('taskkill', ['/pid', server.pid, '/f', '/t']);
  }
}); 