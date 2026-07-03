# day-task

通用每日签到自动化。支持 **New API 类站点**（HTTP + Cookie）与 **ViewTurbo**（浏览器自动化），可在 `tasks.yaml` 中配置多个站点。

## 快速开始

### 1. 环境要求

- **Node.js 18+**
- npm

### 2. 安装

```bash
npm install
# 仅启用 ViewTurbo 等浏览器任务时需要
npm run install:browsers
```

### 3. 配置账号

复制 `.env.example` 为 `.env` 并填写。

**New API 多站点（推荐）：**

```env
NEWAPI_ACCOUNTS=[{"name":"7r.fit","url":"https://api.7r.fit","session":"你的session值"}]
```

**New API 单站点：**

```env
NEWAPI_URL=https://api.7r.fit
NEWAPI_SESSION=你的session值
```

**ViewTurbo（启用对应任务时）：**

```env
VIEWTURBO_ACCOUNTS=[{"email":"user1@example.com","password":"pass1"}]
```

> `.env` 已在 `.gitignore` 中，请勿提交到 Git。

### 4. 配置任务

编辑 [`tasks.yaml`](tasks.yaml)：

```yaml
tasks:
  - id: api-7r-fit-checkin
    name: 7r.fit 每日签到
    enabled: true
    handler: newapi-checkin
    config:
      baseUrl: https://api.7r.fit

  - id: viewturbo-checkin
    name: ViewTurbo 每日签到
    enabled: false
    handler: viewturbo-checkin
    config:
      baseUrl: https://web.viewturbo.net
      myPage: /zh/my/
      loginPage: /zh/login/
```

### 5. 获取 New API Session Cookie

以 [https://api.7r.fit/console/personal](https://api.7r.fit/console/personal) 为例：

1. 浏览器登录站点
2. 按 `F12` → **Application** → **Cookies** → 选择站点域名
3. 复制 `session` 的 **Value**
4. 填入 `.env` 的 `NEWAPI_ACCOUNTS` 或 `NEWAPI_SESSION`

也可在控制台执行：

```javascript
document.cookie.split('; ').find((row) => row.startsWith('session=')).split('=')[1]
```

`userId` 无需手动配置，脚本会自动调用 `/api/user/self` 获取。

### 6. 手动运行

```bash
# 无界面（默认）
npm run tasks

# 有界面，便于调试浏览器任务
npm run tasks:headed

# 只跑某个任务
node src/index.js --only api-7r-fit-checkin
```

执行完成后会按账号汇报：签到成功、今日已签到、或真正未签到（含失败原因）。

## 任务类型

| handler | 说明 | 需要 Playwright |
|---------|------|-----------------|
| `newapi-checkin` | New API 类站点，HTTP + Cookie | 否 |
| `viewturbo-checkin` | ViewTurbo 浏览器签到 | 是 |

新增任务步骤：

1. 在 `src/tasks/` 下新增处理器（导出 `run` 函数）
2. 在 `src/index.js` 的 `HANDLERS` 中注册（标注 `requiresBrowser`）
3. 在 `tasks.yaml` 中添加条目

## 每天早上 9 点自动执行（Cursor Automations）

**完整图文步骤见：** [`docs/cursor-automation.md`](docs/cursor-automation.md)

简要步骤：

1. 在 Cursor 中打开 **Automations** → 新建
2. 触发器：**Cron** → `0 9 * * *`（每天 9:00）
3. 关联本仓库，在 Secrets 中配置 `NEWAPI_ACCOUNTS` 和/或 `VIEWTURBO_*`
4. Agent 指令示例：

```
在本仓库根目录执行每日任务：
1. npm ci
2. npx playwright install chromium --with-deps
3. npm run tasks
执行完成后按 tasks.yaml 中 enabled 的任务汇报签到结果。
```

## 日志

运行日志写入 `logs/YYYY-MM-DD.log`。

## 安全提示

- 不要在聊天、Issue 或 PR 中明文发送 Cookie 或密码
- 优先使用 Cursor Automation / CI 的 Secret 环境变量
- Session Cookie 通常 7–30 天过期，签到失败时请重新获取

## agent 提示词

你是每日任务执行器。在本仓库根目录依次执行：

1. npm ci
2. npx playwright install chromium --with-deps
3. npm run tasks

要求：

- 使用已配置的环境变量（New API 用 `NEWAPI_ACCOUNTS` 或 `NEWAPI_URL` + `NEWAPI_SESSION`；ViewTurbo 用 `VIEWTURBO_ACCOUNTS` 或 `VIEWTURBO_EMAIL` + `VIEWTURBO_PASSWORD`）
- 按 `tasks.yaml` 中 enabled 的任务汇报签到结果：签到成功、今日已签到、或真正未签到（含失败原因）
- 若有账号未签到成功，明确列出名称，并说明是「今日已签到」还是「签到失败」
- 若 `npm run tasks` 退出码非 0，说明失败任务与日志路径 `logs/`
- 不要修改 `tasks.yaml` 或业务代码，除非任务明确失败且需要修复
