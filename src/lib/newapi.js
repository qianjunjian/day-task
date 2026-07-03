const DEFAULT_USER_INFO_PATH = '/api/user/self';
const DEFAULT_SIGN_IN_PATH = '/api/user/sign_in';
const DEFAULT_API_USER_HEADER = 'new-api-user';
const REQUEST_TIMEOUT_MS = 30000;

const ALREADY_CHECKED_PATTERN = /已签到|今日已签|already|signed|重复|明日再来/i;

/**
 * 将站点 URL 规范化为 origin（去掉路径、末尾斜杠）
 * @param {string} url
 */
export function normalizeBaseUrl(url) {
  if (!url?.trim()) {
    throw new Error('站点 URL 不能为空');
  }

  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  return parsed.origin;
}

function buildUrl(baseUrl, apiPath) {
  const normalized = normalizeBaseUrl(baseUrl);
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${normalized}${path}`;
}

function buildHeaders(session, userId, apiUserHeader) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Cookie: `session=${session}`,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  if (userId != null && userId !== '') {
    headers[apiUserHeader] = String(userId);
  }

  return headers;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    return { response, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`请求超时（${REQUEST_TIMEOUT_MS / 1000}s）: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractUserId(data) {
  const candidates = [
    data?.data?.id,
    data?.data?.user_id,
    data?.data?.userId,
    data?.id,
    data?.user_id,
    data?.userId,
  ];

  for (const value of candidates) {
    if (value != null && value !== '') {
      return value;
    }
  }

  return null;
}

function extractMessage(data, fallback = '') {
  return (
    data?.message ||
    data?.msg ||
    data?.data?.message ||
    data?.data?.msg ||
    fallback
  );
}

function isAlreadyCheckedIn(data, message) {
  if (data?.data?.is_signed_in === true || data?.data?.signed_in === true) {
    return true;
  }

  const text = `${message || ''} ${JSON.stringify(data?.data || {})}`;
  return ALREADY_CHECKED_PATTERN.test(text);
}

/**
 * 获取用户信息并校验 session
 * @param {{ baseUrl: string, session: string, userInfoPath?: string, apiUserHeader?: string }} params
 */
export async function fetchUserInfo(params) {
  const {
    baseUrl,
    session,
    userInfoPath = DEFAULT_USER_INFO_PATH,
    apiUserHeader = DEFAULT_API_USER_HEADER,
  } = params;

  const url = buildUrl(baseUrl, userInfoPath);
  const { response, data } = await fetchJson(url, {
    method: 'GET',
    headers: buildHeaders(session, null, apiUserHeader),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Session 已过期，请重新获取 Cookie');
  }

  if (!response.ok) {
    throw new Error(extractMessage(data, `获取用户信息失败（HTTP ${response.status}）`));
  }

  if (data?.success === false) {
    throw new Error(extractMessage(data, '获取用户信息失败'));
  }

  const userId = extractUserId(data);
  if (userId == null) {
    throw new Error('无法从用户信息接口解析用户 ID');
  }

  const username =
    data?.data?.username ||
    data?.data?.display_name ||
    data?.data?.name ||
    data?.data?.email ||
    String(userId);

  return { userId, username, raw: data };
}

/**
 * 执行 New API 签到
 * @param {{ baseUrl: string, session: string, signInPath?: string, userInfoPath?: string, apiUserHeader?: string }} config
 */
export async function performCheckin(config) {
  const {
    baseUrl,
    session,
    signInPath = DEFAULT_SIGN_IN_PATH,
    userInfoPath = DEFAULT_USER_INFO_PATH,
    apiUserHeader = DEFAULT_API_USER_HEADER,
  } = config;

  const userInfo = await fetchUserInfo({ baseUrl, session, userInfoPath, apiUserHeader });
  const url = buildUrl(baseUrl, signInPath);

  const { response, data } = await fetchJson(url, {
    method: 'POST',
    headers: buildHeaders(session, userInfo.userId, apiUserHeader),
    body: JSON.stringify({}),
  });

  const message = extractMessage(data, '');

  if (response.status === 401 || response.status === 403) {
    return {
      status: 'failed',
      message: 'Session 已过期，请重新获取 Cookie',
      alreadyCheckedIn: false,
      username: userInfo.username,
      userId: userInfo.userId,
    };
  }

  if (isAlreadyCheckedIn(data, message)) {
    return {
      status: 'already_checked_in',
      message: message || '今日已签到',
      alreadyCheckedIn: true,
      username: userInfo.username,
      userId: userInfo.userId,
      reward: data?.data,
    };
  }

  if (data?.success === true || response.ok) {
    return {
      status: 'success',
      message: message || '签到成功',
      alreadyCheckedIn: false,
      username: userInfo.username,
      userId: userInfo.userId,
      reward: data?.data,
    };
  }

  return {
    status: 'failed',
    message: message || `签到失败（HTTP ${response.status}）`,
    alreadyCheckedIn: false,
    username: userInfo.username,
    userId: userInfo.userId,
  };
}
