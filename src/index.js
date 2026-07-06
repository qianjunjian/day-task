import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import dotenv from 'dotenv';
import { createLogger } from './lib/logger.js';
import * as newapiCheckin from './tasks/newapi-checkin.js';

dotenv.config();

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 18) {
  console.error(`当前 Node.js 为 ${process.version}，需要 Node.js 18+。请升级后重试（可参考 README）。`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS = {
  'newapi-checkin': newapiCheckin,
};

const STATUS_LABELS = {
  success: '签到成功',
  already_checked_in: '今日已签到',
  failed: '签到失败',
  error: '执行失败',
};

function loadTasks() {
  const configPath = path.join(__dirname, '..', 'tasks.yaml');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = YAML.parse(raw);
  return (parsed.tasks || []).filter((task) => task.enabled !== false);
}

function parseArgs(argv) {
  return {
    only: argv.find((arg, i) => argv[i - 1] === '--only'),
  };
}

function getAccountLabel(account) {
  return account.name || account.email || '未知账号';
}

function printAccountReport(taskName, result) {
  if (!result?.accounts) return;

  console.log(`\n【${taskName}】共 ${result.total} 个账号`);

  for (const account of result.accounts) {
    const label = getAccountLabel(account);
    const statusLabel = STATUS_LABELS[account.status] || account.status;
    const checkedInNote =
      account.alreadyCheckedIn && account.status !== 'already_checked_in' ? '（今日已签到）' : '';
    console.log(`  - ${label}: ${statusLabel}${checkedInNote}${account.message ? ` — ${account.message}` : ''}`);
  }

  if (result.failed?.length > 0) {
    console.log('\n  未签到成功的账号:');
    for (const account of result.failed) {
      const label = getAccountLabel(account);
      if (account.alreadyCheckedIn) {
        console.log(`    · ${label}: 今日已签到，无需重复操作`);
      } else {
        console.log(`    · ${label}: 签到失败 — ${account.error || account.message || '未知原因'}`);
      }
    }
  }

  if (result.notCheckedIn?.length > 0) {
    console.log('\n  真正未签到的账号（需关注）:');
    for (const account of result.notCheckedIn) {
      const label = getAccountLabel(account);
      console.log(`    · ${label}: ${account.error || account.message || '签到未完成'}`);
    }
  } else if (result.allOk) {
    console.log('\n  所有账号均已处理完成（含今日已签到）。');
  }
}

function printSummary(results) {
  console.log('\n========== 任务执行汇总 ==========');
  for (const item of results) {
    const title = item.name || item.id;
    if (!item.ok) {
      if (item.result) {
        printAccountReport(title, item.result);
      } else {
        console.log(`\n【${title}】失败: ${item.error}`);
      }
      continue;
    }
    printAccountReport(title, item.result);
  }
  console.log('\n==================================');
}

export async function runAll(options = {}) {
  const log = createLogger('runner');
  const tasks = loadTasks();
  const filtered = options.only ? tasks.filter((t) => t.id === options.only) : tasks;

  if (filtered.length === 0) {
    const msg = options.only
      ? `未找到 id 为「${options.only}」的已启用任务`
      : '没有可执行的任务（请检查 tasks.yaml 中是否有 enabled 的任务）';
    throw new Error(msg);
  }

  log.info('开始执行任务', { count: filtered.length, tasks: filtered.map((t) => t.id) });

  const results = [];

  for (const task of filtered) {
    log.info(`执行任务: ${task.name}`, { id: task.id });

    try {
      const handler = HANDLERS[task.handler];
      if (!handler?.run) {
        throw new Error(`未找到任务处理器: ${task.handler}`);
      }

      const result = await handler.run({ config: task.config || {} });
      const taskOk = result.allOk !== false;
      results.push({ id: task.id, name: task.name, ok: taskOk, result });
      if (taskOk) {
        log.info(`任务完成: ${task.name}`, {
          total: result.total,
          success: result.successCount,
          alreadyCheckedIn: result.alreadyCheckedInCount,
          failed: result.failedCount,
        });
      } else {
        const labels = (result.notCheckedIn || []).map((a) => a.name || a.email).join(', ');
        log.error(`任务未全部成功: ${task.name}`, {
          notCheckedIn: labels,
          failed: result.failedCount,
        });
      }
    } catch (error) {
      results.push({
        id: task.id,
        name: task.name,
        ok: false,
        error: error.message,
      });
      log.error(`任务失败: ${task.name}`, { error: error.message });
    }
  }

  printSummary(results);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    const details = failed.map((f) => {
      const notCheckedIn = f.result?.notCheckedIn?.map((a) => a.name || a.email).join(', ');
      if (notCheckedIn) return `${f.id}（未签到: ${notCheckedIn}）`;
      if (f.error) return `${f.id}（${f.error}）`;
      return f.id;
    });
    throw new Error(`${failed.length} 个任务未全部成功: ${details.join('; ')}`);
  }

  return results;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  runAll(args)
    .then(() => {
      console.log('\n全部任务执行完成。');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n任务执行失败:', error.message);
      process.exit(1);
    });
}
