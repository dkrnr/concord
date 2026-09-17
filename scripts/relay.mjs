import { spawn } from 'node:child_process';

const port = process.env.PORT || '8787';
const origin = `http://127.0.0.1:${port}`;
const children = new Set();

function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function stop(signal = 'SIGTERM') {
  for (const child of children) child.kill(signal);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Concord did not start at ${origin}`);
}

const server = start(process.execPath, ['engine/server.js'], { env: { ...process.env, PORT: port } });
server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);
server.once('exit', (code) => {
  if (code) process.stderr.write(`Concord server exited with code ${code}.\n`);
  stop();
  process.exitCode = code || 0;
});

try {
  await waitForServer();
  const tunnel = start('cloudflared', ['tunnel', '--url', origin, '--protocol', process.env.CLOUDFLARED_PROTOCOL || 'http2', '--no-autoupdate']);
  const announce = (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      process.stdout.write(`\nConcord is public at ${match[0]}\n`);
      process.stdout.write(`App and API share this URL. Example:\n`);
      process.stdout.write(`curl -sS '${match[0]}/fetchDevices' -H 'content-type: application/json' --data '{"apartmentId":"apt_401"}'\n\n`);
    }
  };
  tunnel.stdout.on('data', announce);
  tunnel.stderr.on('data', announce);
  tunnel.once('exit', (code) => {
    if (code) process.stderr.write(`Cloudflare relay exited with code ${code}.\n`);
    stop();
    process.exitCode = code || 0;
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  stop();
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stop(signal);
  process.exit(0);
});
