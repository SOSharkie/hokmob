// Runs the backend (https://localhost:7157) and the Angular dev server (http://localhost:4200) together.
// Usage, from HokMob.App/ClientApp: npm run dev. Then open http://localhost:4200.
// The Angular dev server uses plain HTTP so it also works in browsers that don't trust the ASP.NET dev certificate.
// /api requests are forwarded to the backend via proxy.conf.js. Ctrl+C stops both.
const {spawn, spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const clientDir = __dirname;
const appDir = path.resolve(clientDir, '..');
const backendHttpsPort = 7157;
const backendHttpPort = 5101;
const frontendPort = 4200;

const children = [];
let stopping = false;

if (!fs.existsSync(path.join(clientDir, 'node_modules'))) {
  console.log('Installing npm packages...');
  const install = spawnSync('npm', ['install'], {cwd: clientDir, stdio: 'inherit', shell: true});
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

function start(name, command, args, options) {
  const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe'], ...options});
  const prefix = `[${name}] `;
  readline.createInterface({input: child.stdout}).on('line', line => console.log(prefix + line));
  readline.createInterface({input: child.stderr}).on('line', line => console.error(prefix + line));
  child.on('error', error => {
    console.error(`${prefix}failed to start: ${error.message}`);
    stop(1);
  });
  child.on('exit', code => {
    if (!stopping) {
      console.log(`${prefix}exited with code ${code}, stopping`);
      stop(code || 1);
    }
  });
  children.push(child);
}

function stop(exitCode = 0) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) {
      continue;
    }
    if (process.platform === 'win32') {
      // dotnet run and ng serve start their own child processes, so kill the whole tree
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {stdio: 'ignore'});
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

start('api', 'dotnet', ['run', '--no-launch-profile'], {
  cwd: appDir,
  env: {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: `https://localhost:${backendHttpsPort};http://localhost:${backendHttpPort}`,
    // Don't start the SPA proxy, which would launch a second (HTTPS) Angular dev server
    ASPNETCORE_HOSTINGSTARTUPASSEMBLIES: '',
    // The project targets net7.0; allow running on a newer installed runtime
    DOTNET_ROLL_FORWARD: process.env.DOTNET_ROLL_FORWARD ?? 'Major',
  },
});

start('web', process.execPath, [path.join(clientDir, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
  'serve', '--port', String(frontendPort)], {
  cwd: clientDir,
  env: {...process.env, ASPNETCORE_HTTPS_PORT: String(backendHttpsPort)},
});

console.log(`Starting backend (https://localhost:${backendHttpsPort}) and frontend. ` +
    `Open http://localhost:${frontendPort} once both are ready.`);
