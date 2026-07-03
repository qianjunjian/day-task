import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');

export async function launchBrowser({ headed = false } = {}) {
  return chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

export function getStoragePath(siteId) {
  return path.join(AUTH_DIR, `${siteId}.json`);
}

export function storageExists(siteId) {
  return fs.existsSync(getStoragePath(siteId));
}

export async function createContext(browser, { siteId, storagePath } = {}) {
  const resolvedPath = storagePath || (siteId ? getStoragePath(siteId) : null);
  const options = {
    locale: 'zh-CN',
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  if (resolvedPath && fs.existsSync(resolvedPath)) {
    options.storageState = resolvedPath;
  }

  return browser.newContext(options);
}

export async function saveStorageState(context, siteId) {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
  const storagePath = getStoragePath(siteId);
  await context.storageState({ path: storagePath });
  return storagePath;
}
