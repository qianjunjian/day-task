import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString();
}

export function createLogger(scope = 'task') {
  ensureLogDir();
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);

  function write(level, message, extra) {
    const line = `[${timestamp()}] [${level}] [${scope}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ''}`;
    console.log(line);
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  }

  return {
    info: (msg, extra) => write('INFO', msg, extra),
    warn: (msg, extra) => write('WARN', msg, extra),
    error: (msg, extra) => write('ERROR', msg, extra),
  };
}
