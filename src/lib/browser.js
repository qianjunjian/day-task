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

export function getStoragePath(siteId, accountKey) {
  const name = accountKey ? `${siteId}-${accountKey}` : siteId;
  return path.join(AUTH_DIR, `${name}.json`);
}

export function storageExists(siteId, accountKey) {
  return fs.existsSync(getStoragePath(siteId, accountKey));
}

export async function createContext(browser, { siteId, accountKey, storagePath } = {}) {
  const resolvedPath = storagePath || (siteId ? getStoragePath(siteId, accountKey) : null);
  const options = {
    locale: 'zh-CN',
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  if (resolvedPath && fs.existsSync(resolvedPath)) {
    options.storageState = resolvedPath;
  } else if (resolvedPath && accountKey && siteId) {
    const legacyPath = path.join(AUTH_DIR, `${siteId}.json`);
    if (fs.existsSync(legacyPath)) {
      fs.copyFileSync(legacyPath, resolvedPath);
      options.storageState = resolvedPath;
    }
  }

  return browser.newContext(options);
}

export async function saveStorageState(context, siteId, accountKey) {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
  const storagePath = getStoragePath(siteId, accountKey);
  await context.storageState({ path: storagePath });
  return storagePath;
}
