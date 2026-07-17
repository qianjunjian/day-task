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

const CHECKED_TEXT_PATTERN = /已签到|明日再来|已完成|今日已领/;

function getCheckinEntry(page) {
  return page.locator('button.my-checkin-entry, .my-checkin-entry').first();
}

async function waitForCheckinArea(page) {
  await getCheckinEntry(page).waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * 点击签到前检测是否已签到（优先看 my-checkin-entry.is-checked 及区域文案）
 */
async function detectAlreadyCheckedIn(page) {
  await waitForCheckinArea(page);

  const entry = getCheckinEntry(page);
  const isCheckedClass = await entry.evaluate((el) => el.classList.contains('is-checked')).catch(() => false);
  const entryText = (await entry.innerText().catch(() => '')).trim();

  const hasCheckedText = CHECKED_TEXT_PATTERN.test(entryText);
  const alreadyCheckedIn = isCheckedClass || hasCheckedText;

  return { alreadyCheckedIn, isCheckedClass, entryText, btnText: entryText };
}

async function clickCheckin(page, log, email) {
  const before = await detectAlreadyCheckedIn(page);

  if (before.alreadyCheckedIn) {
    const message = before.entryText || before.btnText || '已签到';
    log.info('今日已签到，跳过点击', {
      email,
      isCheckedClass: before.isCheckedClass,
      entryText: before.entryText,
      btnText: before.btnText,
    });
    return { status: 'already_checked_in', message, alreadyCheckedIn: true };
  }

  const checkinBtn = getCheckinEntry(page);
  await checkinBtn.waitFor({ state: 'visible', timeout: 15000 });

  const btnText = before.btnText || (await checkinBtn.innerText().catch(() => ''));
  await checkinBtn.click();
  await page.waitForTimeout(2000);

  const after = await detectAlreadyCheckedIn(page);
  const trafficText = await page.locator('h2').first().innerText().catch(() => '');

  if (after.alreadyCheckedIn) {
    const message = after.entryText || after.btnText || btnText;
    log.info('签到成功', {
      email,
      isCheckedClass: after.isCheckedClass,
      message,
      trafficText,
    });
    return { status: 'success', message, trafficText, alreadyCheckedIn: false };
  }

  const afterText = after.btnText || (await checkinBtn.innerText().catch(() => btnText));
  const message = `签到未完成（点击后未出现已签到状态）${afterText ? ` — ${afterText}` : ''}`;
  log.error('签到失败', { email, before: btnText, after: afterText, trafficText });
  return { status: 'failed', message, trafficText, alreadyCheckedIn: false };
}

function buildAccountResult(email, checkinResult) {
  const { status, message, trafficText, alreadyCheckedIn } = checkinResult;
  const ok = status === 'success' || status === 'already_checked_in';

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
