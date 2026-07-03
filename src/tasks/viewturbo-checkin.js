import { loadViewturboAccounts } from '../lib/accounts.js';
import { createLogger } from '../lib/logger.js';
import { createContext, saveStorageState } from '../lib/browser.js';

const SITE_ID = 'viewturbo';

async function dismissCookieDialog(page) {
  const acceptBtn = page.getByText('接受所有 Cookies');
  const closeBtn = page.getByRole('button', { name: 'close' });
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      break;
    }
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      break;
    }
    await page.waitForTimeout(500);
  }

  await page.locator('.exec-modal-overlay').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

async function login(page, config, account, log) {
  const loginUrl = `${config.baseUrl}${config.loginPage}`;

  log.info('打开登录页', { loginUrl, email: account.email });
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await dismissCookieDialog(page);

  await page.getByPlaceholder('输入您的电子邮件').fill(account.email);
  await page.getByPlaceholder('输入您的密码').fill(account.password);
  await dismissCookieDialog(page);
  await page.locator('.active-button.button', { hasText: '登入' }).click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
  log.info('登录成功', { email: account.email, url: page.url() });
}

async function ensureLoggedIn(page, config, account, log) {
  const myUrl = `${config.baseUrl}${config.myPage}`;
  await page.goto(myUrl, { waitUntil: 'domcontentloaded' });
  await dismissCookieDialog(page);

  const loginLink = page.getByRole('link', { name: '登入' });
  if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    log.info('会话已失效，重新登录', { email: account.email });
    await login(page, config, account, log);
    await page.goto(myUrl, { waitUntil: 'domcontentloaded' });
    await dismissCookieDialog(page);
  }
}

async function clickCheckin(page, log, email) {
  const checkinBtn = page.getByRole('button', { name: /签到领/ });
  await checkinBtn.waitFor({ state: 'visible', timeout: 15000 });

  const btnText = await checkinBtn.innerText();
  if (/已签到|明日再来|已完成/.test(btnText)) {
    log.info('今日已签到，跳过', { email, btnText });
    return { status: 'already_checked_in', message: btnText, alreadyCheckedIn: true };
  }

  await checkinBtn.click();
  await page.waitForTimeout(2000);

  const afterText = await checkinBtn.innerText().catch(() => btnText);
  const trafficText = await page.locator('h2').first().innerText().catch(() => '');

  if (/已签到|明日再来|已完成/.test(afterText)) {
    log.info('签到成功', { email, afterText, trafficText });
    return { status: 'success', message: afterText, trafficText, alreadyCheckedIn: false };
  }

  log.warn('已点击签到按钮，结果待确认', { email, before: btnText, after: afterText, trafficText });
  return { status: 'clicked', message: afterText, trafficText, alreadyCheckedIn: false };
}

function buildAccountResult(email, checkinResult) {
  const { status, message, trafficText, alreadyCheckedIn } = checkinResult;
  const ok = status === 'success' || status === 'already_checked_in' || status === 'clicked';

  return {
    email,
    ok,
    status,
    message,
    trafficText,
    alreadyCheckedIn: alreadyCheckedIn === true,
  };
}

function buildAccountError(email, error) {
  return {
    email,
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
  const clicked = accounts.filter((a) => a.status === 'clicked');
  const failed = accounts.filter((a) => !a.ok);

  const notCheckedIn = failed.filter((a) => !a.alreadyCheckedIn);

  return {
    total: accounts.length,
    successCount: success.length,
    alreadyCheckedInCount: alreadyCheckedIn.length,
    clickedCount: clicked.length,
    failedCount: failed.length,
    success,
    alreadyCheckedIn,
    clicked,
    failed,
    notCheckedIn,
    allOk: failed.length === 0,
  };
}

async function runForAccount(browser, config, account, log) {
  const context = await createContext(browser, { siteId: SITE_ID, accountKey: account.key });
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page, config, account, log);
    const checkinResult = await clickCheckin(page, log, account.email);
    await saveStorageState(context, SITE_ID, account.key);
    return buildAccountResult(account.email, checkinResult);
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * ViewTurbo 每日签到任务（支持多账号）
 * @param {{ browser: import('playwright').Browser, config: object }} ctx
 */
export async function run({ browser, config }) {
  const log = createLogger('viewturbo-checkin');
  const accountList = loadViewturboAccounts();

  log.info('开始签到', { accountCount: accountList.length, emails: accountList.map((a) => a.email) });

  const accounts = [];

  for (const account of accountList) {
    log.info(`处理账号: ${account.email}`);
    try {
      const result = await runForAccount(browser, config, account, log);
      accounts.push(result);
      log.info(`账号处理完成: ${account.email}`, { status: result.status, ok: result.ok });
    } catch (error) {
      const result = buildAccountError(account.email, error);
      accounts.push(result);
      log.error(`账号处理失败: ${account.email}`, { error: error.message });
    }
  }

  const summary = summarizeAccountResults(accounts);

  return {
    site: SITE_ID,
    ...summary,
    accounts,
  };
}
