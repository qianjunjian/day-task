# day-task

每日网页任务自动化。当前支持 ViewTurbo 签到，后续可在 `tasks.yaml` 中扩展更多站点与任务。

## 快速开始

### 1. 环境要求

- **Node.js 18+**（Playwright 需要；若当前版本过低请先升级）
- npm

### 2. 安装

```bash
npm install
npm run install:browsers
```

### 3. 配置账号

复制 `.env.example` 为 `.env` 并填写。

**单账号：**

```env
VIEWTURBO_EMAIL=your@email.com
VIEWTURBO_PASSWORD=your_password
```

**多账号（推荐）：**

```env
VIEWTURBO_ACCOUNTS=[{"email":"user1@example.com","password":"pass1"},{"email":"user2@example.com","password":"pass2"}]
```

也可同时保留 `VIEWTURBO_EMAIL` / `VIEWTURBO_PASSWORD`，会与 `VIEWTURBO_ACCOUNTS` 合并（相同邮箱自动去重）。

执行完成后会按账号汇报：签到成功、今日已签到、或真正未签到（含失败原因）。

> `.env` 已在 `.gitignore` 中，请勿提交到 Git。

### 4. 手动运行

```bash
# 无界面（默认）
npm run tasks

# 有界面，便于调试
npm run tasks:headed

# 只跑某个任务
node src/index.js --only viewturbo-checkin
```

## 任务配置

编辑 [`tasks.yaml`](tasks.yaml)：

```yaml
tasks:
  - id: viewturbo-checkin
    name: ViewTurbo 每日签到
    enabled: true
    handler: viewturbo-checkin
    config:
      baseUrl: https://web.viewturbo.net
      myPage: /zh/my/
      loginPage: /zh/login/
```

新增任务步骤：

1. 在 `src/tasks/` 下新增处理器（导出 `run` 函数）
2. 在 `src/index.js` 的 `HANDLERS` 中注册
3. 在 `tasks.yaml` 中添加条目

## 每天早上 9 点自动执行（Cursor Automations）

**完整图文步骤与测试方法见：** [`docs/cursor-automation.md`](docs/cursor-automation.md)

简要步骤：

1. 在 Cursor 中打开 **Automations** → 新建
2. 触发器：**Cron** → `0 9 * * *`（每天 9:00）
3. 关联本仓库，并在 Automation 环境变量中配置 `VIEWTURBO_ACCOUNTS`（多账号 JSON）或 `VIEWTURBO_EMAIL`、`VIEWTURBO_PASSWORD`
4. Agent 指令示例：

```
在本仓库根目录执行每日任务：
1. npm ci
2. npx playwright install chromium --with-deps
3. npm run tasks
执行完成后汇报每个任务的签到结果；按账号说明成功、今日已签到、或未签到成功（区分是否已签到）。
```

## 日志

运行日志写入 `logs/YYYY-MM-DD.log`。

## 安全提示

- 不要在聊天、Issue 或 PR 中明文发送密码
- 优先使用 Cursor Automation / CI 的 Secret 环境变量，而非把 `.env` 提交到仓库
