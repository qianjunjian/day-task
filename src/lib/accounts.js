import { normalizeBaseUrl } from './newapi.js';

/**
 * 加载 New API 账号列表（按 baseUrl 过滤）
 * 支持两种方式（可同时存在，JSON 数组优先）：
 * 1. NEWAPI_ACCOUNTS — JSON 数组，如 [{"name":"7r.fit","url":"https://api.7r.fit","session":"xxx","userId":123}]
 * 2. NEWAPI_URL + NEWAPI_SESSION + NEWAPI_USER_ID — 单站点简写
 * @param {string} baseUrl 任务配置中的站点 URL
 * @returns {{ name: string, url: string, session: string, userId: string }[]}
 */
export function loadNewApiAccounts(baseUrl) {
  const accounts = [];
  const seen = new Set();
  const targetUrl = normalizeBaseUrl(baseUrl);

  function add(name, url, session, userId) {
    const normalizedUrl = normalizeBaseUrl(url);
    const normalizedSession = session?.trim();
    const normalizedUserId = userId != null && userId !== '' ? String(userId).trim() : '';
    if (!normalizedSession || !normalizedUserId) return;

    const dedupeKey = `${normalizedUrl}:${normalizedSession}:${normalizedUserId}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    if (normalizedUrl !== targetUrl) return;

    const displayName = name?.trim() || normalizedUrl;
    accounts.push({
      name: displayName,
      url: normalizedUrl,
      session: normalizedSession,
      userId: normalizedUserId,
    });
  }

  const raw = process.env.NEWAPI_ACCOUNTS?.trim();
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        'NEWAPI_ACCOUNTS 必须是合法的 JSON 数组，如 [{"name":"7r.fit","url":"https://api.7r.fit","session":"xxx","userId":123}]',
      );
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('NEWAPI_ACCOUNTS 必须是非空 JSON 数组');
    }
    for (const item of parsed) {
      if (!item?.url || !item?.session || item?.userId == null || item?.userId === '') {
        throw new Error('NEWAPI_ACCOUNTS 中每项需包含 url、session 与 userId（数字用户 ID）');
      }
      add(item.name, item.url, item.session, item.userId);
    }
  }

  const singleUrl = process.env.NEWAPI_URL?.trim();
  const singleSession = process.env.NEWAPI_SESSION?.trim();
  const singleUserId = process.env.NEWAPI_USER_ID?.trim();
  if (singleUrl && singleSession && singleUserId) {
    add(process.env.NEWAPI_NAME, singleUrl, singleSession, singleUserId);
  }

  if (accounts.length === 0) {
    throw new Error(
      `未配置站点 ${targetUrl} 的 New API 账号。请在 .env 中设置 NEWAPI_ACCOUNTS（含 url、session、userId）或 NEWAPI_URL + NEWAPI_SESSION + NEWAPI_USER_ID，且 url 需与任务 baseUrl 一致`,
    );
  }

  return accounts;
}
