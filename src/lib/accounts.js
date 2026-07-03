import crypto from 'crypto';
import { normalizeBaseUrl } from './newapi.js';

/**
 * 根据邮箱生成稳定的账号标识，用于会话存储文件名
 * @param {string} email
 */
export function getAccountKey(email) {
  return crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

/**
 * 加载 ViewTurbo 账号列表
 * 支持两种方式（可同时存在，VIEWTURBO_ACCOUNTS 优先合并单账号配置）：
 * 1. VIEWTURBO_ACCOUNTS — JSON 数组，如 [{"email":"a@b.com","password":"xxx"}]
 * 2. VIEWTURBO_EMAIL + VIEWTURBO_PASSWORD — 单账号（向后兼容）
 * @returns {{ email: string, password: string, key: string }[]}
 */
export function loadViewturboAccounts() {
  const accounts = [];
  const seen = new Set();

  function add(email, password) {
    const normalized = email?.trim();
    if (!normalized || !password) return;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    accounts.push({ email: normalized, password, key: getAccountKey(normalized) });
  }

  const raw = process.env.VIEWTURBO_ACCOUNTS?.trim();
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('VIEWTURBO_ACCOUNTS 必须是合法的 JSON 数组，如 [{"email":"a@b.com","password":"xxx"}]');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('VIEWTURBO_ACCOUNTS 必须是非空 JSON 数组');
    }
    for (const item of parsed) {
      if (!item?.email || !item?.password) {
        throw new Error('VIEWTURBO_ACCOUNTS 中每项需包含 email 与 password');
      }
      add(item.email, item.password);
    }
  }

  const singleEmail = process.env.VIEWTURBO_EMAIL?.trim();
  const singlePassword = process.env.VIEWTURBO_PASSWORD;
  if (singleEmail && singlePassword) {
    add(singleEmail, singlePassword);
  }

  if (accounts.length === 0) {
    throw new Error(
      '未配置 ViewTurbo 账号。请在 .env 中设置 VIEWTURBO_ACCOUNTS（多账号）或 VIEWTURBO_EMAIL + VIEWTURBO_PASSWORD（单账号）',
    );
  }

  return accounts;
}

/**
 * 加载 New API 账号列表（按 baseUrl 过滤）
 * 支持两种方式（可同时存在，JSON 数组优先）：
 * 1. NEWAPI_ACCOUNTS — JSON 数组，如 [{"name":"7r.fit","url":"https://api.7r.fit","session":"xxx"}]
 * 2. NEWAPI_URL + NEWAPI_SESSION — 单站点简写
 * @param {string} baseUrl 任务配置中的站点 URL
 * @returns {{ name: string, url: string, session: string, key: string }[]}
 */
export function loadNewApiAccounts(baseUrl) {
  const accounts = [];
  const seen = new Set();
  const targetUrl = normalizeBaseUrl(baseUrl);

  function add(name, url, session) {
    const normalizedUrl = normalizeBaseUrl(url);
    const normalizedSession = session?.trim();
    if (!normalizedSession) return;

    const dedupeKey = `${normalizedUrl}:${normalizedSession}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    if (normalizedUrl !== targetUrl) return;

    const displayName = name?.trim() || normalizedUrl;
    accounts.push({
      name: displayName,
      url: normalizedUrl,
      session: normalizedSession,
      key: getAccountKey(`${normalizedUrl}:${normalizedSession}`),
    });
  }

  const raw = process.env.NEWAPI_ACCOUNTS?.trim();
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        'NEWAPI_ACCOUNTS 必须是合法的 JSON 数组，如 [{"name":"7r.fit","url":"https://api.7r.fit","session":"xxx"}]',
      );
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('NEWAPI_ACCOUNTS 必须是非空 JSON 数组');
    }
    for (const item of parsed) {
      if (!item?.url || !item?.session) {
        throw new Error('NEWAPI_ACCOUNTS 中每项需包含 url 与 session');
      }
      add(item.name, item.url, item.session);
    }
  }

  const singleUrl = process.env.NEWAPI_URL?.trim();
  const singleSession = process.env.NEWAPI_SESSION?.trim();
  if (singleUrl && singleSession) {
    add(process.env.NEWAPI_NAME, singleUrl, singleSession);
  }

  if (accounts.length === 0) {
    throw new Error(
      `未配置站点 ${targetUrl} 的 New API 账号。请在 .env 中设置 NEWAPI_ACCOUNTS（多站点）或 NEWAPI_URL + NEWAPI_SESSION（单站点），且 url 需与任务 baseUrl 一致`,
    );
  }

  return accounts;
}
