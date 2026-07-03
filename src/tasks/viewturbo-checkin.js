import { createLogger } from '../lib/logger.js';
import { saveStorageState } from '../lib/browser.js';

const SITE_ID = 'viewturbo';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 .env 中配置`);
  }
  return value;
}

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

async function login(page, config, log) {
  const email = requireEnv('VIEWTURBO_EMAIL');
  const password = requireEnv('VIEWTURBO_PASSWORD');
  const loginUrl = `${config.baseUrl}${config.loginPage}`;

  log.info('打开登录页', { loginUrl });
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await dismissCookieDialog(page);

  await page.getByPlaceholder('输入您的电子邮件').fill(email);
  await page.getByPlaceholder('输入您的密码').fill(password);
  await dismissCookieDialog(page);
  await page.locator('.active-button.button', { hasText: '登入' }).click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
  log.info('登录成功', { url: page.url() });
}

async function ensureLoggedIn(page, config, log) {
  const myUrl = `${config.baseUrl}${config.myPage}`;
  await page.goto(myUrl, { waitUntil: 'domcontentloaded' });
  await dismissCookieDialog(page);

  const loginLink = page.getByRole('link', { name: '登入' });
  if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    log.info('会话已失效，重新登录');
    await login(page, config, log);
    await page.goto(myUrl, { waitUntil: 'domcontentloaded' });
    await dismissCookieDialog(page);
  }
}

async function clickCheckin(page, log) {
  const checkinBtn = page.getByRole('button', { name: /签到领/ });
  await checkinBtn.waitFor({ state: 'visible', timeout: 15000 });

  const btnText = await checkinBtn.innerText();
  if (/已签到|明日再来|已完成/.test(btnText)) {
    log.info('今日已签到，跳过', { btnText });
    return { status: 'already_checked_in', message: btnText };
  }

  await checkinBtn.click();
  await page.waitForTimeout(2000);

  const afterText = await checkinBtn.innerText().catch(() => btnText);
  const trafficText = await page.locator('h2').first().innerText().catch(() => '');

  if (/已签到|明日再来|已完成/.test(afterText)) {
    log.info('签到成功', { afterText, trafficText });
    return { status: 'success', message: afterText, trafficText };
  }

  log.info('已点击签到按钮', { before: btnText, after: afterText, trafficText });
  return { status: 'clicked', message: afterText, trafficText };
}

/**
 * ViewTurbo 每日签到任务
 * @param {{ page: import('playwright').Page, context: import('playwright').BrowserContext, config: object }} ctx
 */
export async function run({ page, context, config }) {
  const log = createLogger('viewturbo-checkin');

  await ensureLoggedIn(page, config, log);
  const result = await clickCheckin(page, log);
  await saveStorageState(context, SITE_ID);

  return result;
}
