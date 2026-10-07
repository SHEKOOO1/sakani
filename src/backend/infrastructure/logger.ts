import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const logFolder = process.env.LOG_DIR ? process.env.LOG_DIR : join(process.cwd(), 'logs');
if (!existsSync(logFolder)) {
  mkdirSync(logFolder, { recursive: true });
}

const logFile = join(logFolder, 'app.log');

function formatEntry(level: string, args: any[]) {
  const timestamp = new Date().toISOString();
  const payload = args.map((arg) => {
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');
  return `[${timestamp}] [${level}] ${payload}`;
}

function write(level: string, args: any[]) {
  const entry = formatEntry(level, args);
  appendFileSync(logFile, `${entry}\n`, { encoding: 'utf8' });
  if (level === 'ERROR') {
    console.error(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  info: (...args: any[]) => write('INFO', args),
  warn: (...args: any[]) => write('WARN', args),
  error: (...args: any[]) => write('ERROR', args),
};
