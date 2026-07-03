import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import dotenv from 'dotenv';
import { createLogger } from './lib/logger.js';
import { launchBrowser, createContext } from './lib/browser.js';
import * as viewturboCheckin from './tasks/viewturbo-checkin.js';

dotenv.config();

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 18) {
  console.error(`当前 Node.js 为 ${process.version}，Playwright 需要 Node.js 18+。请升级后重试（可参考 README）。`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS = {
  'viewturbo-checkin': viewturboCheckin,
};

function loadTasks() {
  const configPath = path.join(__dirname, '..', 'tasks.yaml');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = YAML.parse(raw);
  return (parsed.tasks || []).filter((task) => task.enabled !== false);
}

function parseArgs(argv) {
  return {
    headed: argv.includes('--headed'),
    only: argv.find((arg, i) => argv[i - 1] === '--only'),
  };
}

export async function runAll(options = {}) {
  const log = createLogger('runner');
  const tasks = loadTasks();
  const filtered = options.only ? tasks.filter((t) => t.id === options.only) : tasks;

  if (filtered.length === 0) {
    throw new Error('没有可执行的任务');
  }

  log.info('开始执行任务', { count: filtered.length, tasks: filtered.map((t) => t.id) });

  const browser = await launchBrowser({ headed: options.headed });
  const results = [];

  try {
    for (const task of filtered) {
      const handler = HANDLERS[task.handler];
      if (!handler?.run) {
        throw new Error(`未找到任务处理器: ${task.handler}`);
      }

      log.info(`执行任务: ${task.name}`, { id: task.id });
      const context = await createContext(browser, { siteId: task.id.split('-')[0] });
      const page = await context.newPage();

      try {
        const result = await handler.run({ page, context, config: task.config || {} });
        results.push({ id: task.id, ok: true, result });
        log.info(`任务完成: ${task.name}`, result);
      } catch (error) {
        results.push({ id: task.id, ok: false, error: error.message });
        log.error(`任务失败: ${task.name}`, { error: error.message });
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} 个任务失败: ${failed.map((f) => f.id).join(', ')}`);
  }

  return results;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  runAll(args)
    .then((results) => {
      console.log('\n全部任务执行完成:');
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n任务执行失败:', error.message);
      process.exit(1);
    });
}
