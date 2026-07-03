import crypto from 'crypto';

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
