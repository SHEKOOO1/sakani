import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = Number(process.env.PORT || '3000');
const BASE = `http://127.0.0.1:${PORT}`;

let child: ChildProcess | null = null;
let logs: string[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BASE}/api/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 200) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

function pipe(proc: ChildProcess) {
  proc.stdout?.on('data', (d: Buffer) => {
    logs.push(String(d));
    process.stdout.write(`[test-server] ${d}`);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    logs.push(String(d));
    process.stdout.write(`[test-server:err] ${d}`);
  });
}

export async function setup() {
  // لو السيرفر شغال بالفعل (npm run dev) نستخدمه مباشرة
  if (await waitForHealth(1500)) return;

  child = spawn(
    process.execPath,
    [path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), 'server.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );
  pipe(child);
  child.on('exit', () => {
    child = null;
  });

  const healthy = await waitForHealth(60000);
  if (!healthy) {
    throw new Error(
      `Backend server did not become healthy on port ${PORT}.\n--- server output ---\n${logs.slice(-80).join('')}`
    );
  }
}

export async function teardown() {
  if (!child) return;
  const proc = child;
  child = null;
  const gone = await new Promise<boolean>((resolve) => {
    proc.once('exit', () => resolve(true));
    proc.kill('SIGTERM');
    setTimeout(() => resolve(false), 4000);
  });
  if (!gone) proc.kill('SIGKILL');
}