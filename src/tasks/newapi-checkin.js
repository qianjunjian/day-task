import { loadNewApiAccounts } from '../lib/accounts.js';
import { createLogger } from '../lib/logger.js';
import { normalizeBaseUrl, performCheckin } from '../lib/newapi.js';

function buildAccountResult(account, checkinResult) {
  const { status, message, alreadyCheckedIn, username, userId, reward } = checkinResult;
  const ok = status === 'success' || status === 'already_checked_in';

  return {
    name: account.name,
    email: account.name,
    ok,
    status,
    message,
    username,
    userId,
    reward,
    alreadyCheckedIn: alreadyCheckedIn === true,
  };
}

function buildAccountError(account, error) {
  return {
    name: account.name,
    email: account.name,
    ok: false,
    status: 'error',
    message: error.message,
    alreadyCheckedIn: false,
    error: error.message,
  };
}

function summarizeAccountResults(accounts) {
  const success = accounts.filter((a) => a.status === 'success');
  const alreadyCheckedIn = accounts.filter((a) => a.status === 'already_checked_in');
  const failed = accounts.filter((a) => !a.ok);
  const notCheckedIn = failed.filter((a) => !a.alreadyCheckedIn);

  return {
    total: accounts.length,
    successCount: success.length,
    alreadyCheckedInCount: alreadyCheckedIn.length,
    failedCount: failed.length,
    success,
    alreadyCheckedIn,
    failed,
    notCheckedIn,
    allOk: failed.length === 0,
  };
}

/**
 * New API 每日签到任务（HTTP + Cookie，支持多站点多账号）
 * @param {{ config: object }} ctx
 */
export async function run({ config }) {
  const log = createLogger('newapi-checkin');
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const accountList = loadNewApiAccounts(baseUrl);

  log.info('开始签到', {
    baseUrl,
    accountCount: accountList.length,
    accounts: accountList.map((a) => a.name),
  });

  const accounts = [];

  for (const account of accountList) {
    log.info(`处理账号: ${account.name}`, { url: account.url });
    try {
      const checkinResult = await performCheckin({
        baseUrl,
        session: account.session,
        userId: account.userId,
        signInPath: config.signInPath,
        userInfoPath: config.userInfoPath,
        apiUserHeader: config.apiUserHeader,
      });
      const result = buildAccountResult(account, checkinResult);
      accounts.push(result);
      log.info(`账号处理完成: ${account.name}`, {
        status: result.status,
        ok: result.ok,
        message: result.message,
      });
    } catch (error) {
      const result = buildAccountError(account, error);
      accounts.push(result);
      log.error(`账号处理失败: ${account.name}`, { error: error.message });
    }
  }

  const summary = summarizeAccountResults(accounts);

  return {
    site: baseUrl,
    ...summary,
    accounts,
  };
}
