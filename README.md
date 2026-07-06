# day-task

New API 类站点每日签到自动化（HTTP + Cookie），可在 `tasks.yaml` 中配置多个站点。

## 快速开始

### 1. 环境要求

- **Node.js 18+**
- npm

### 2. 安装

```bash
npm install
```

### 3. 配置账号

复制 `.env.example` 为 `.env` 并填写。

**New API 多站点（推荐）：**

```env
NEWAPI_ACCOUNTS=[{"name":"7r.fit","url":"https://api.7r.fit","session":"你的session值","userId":123}]
```

**New API 单站点：**

```env
NEWAPI_URL=https://api.7r.fit
NEWAPI_SESSION=你的session值
NEWAPI_USER_ID=123
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
      signInPath: /api/user/checkin
      userInfoPath: /api/user/self
      apiUserHeader: new-api-user
```

### 5. 获取 session 与 userId

以 [https://api.7r.fit/console/personal](https://api.7r.fit/console/personal) 为例：

**session（Cookie）：**

1. 浏览器登录站点
2. 按 `F12` → **Application** → **Cookies** → 选择 `api.7r.fit`
3. 复制 `session` 的 **Value**（注意：`HttpOnly` Cookie 无法通过 `document.cookie` 读取，必须从 DevTools 复制）

**userId（请求头，必填）：**

New API 的接口除了 Cookie，还要求请求头 `new-api-user` 为当前用户的数字 ID。浏览器会自动带上，脚本也需要手动配置。

获取方式：

1. `F12` → **Network（网络）**
2. 刷新页面
3. 找到请求 `user/self`
4. 查看 **Request Headers** 中的 `new-api-user`，例如 `123`

将 `session` 和 `userId` 一并填入 `.env`。

### 6. 手动运行

```bash
npm run tasks

# 只跑某个任务
node src/index.js --only api-7r-fit-checkin
```

执行完成后会按账号汇报：签到成功、今日已签到、或真正未签到（含失败原因）。

## 任务类型

| handler | 说明 |
|---------|------|
| `newapi-checkin` | New API 类站点，HTTP + Cookie |

新增任务步骤：

1. 在 `src/tasks/` 下新增处理器（导出 `run` 函数）
2. 在 `src/index.js` 的 `HANDLERS` 中注册
3. 在 `tasks.yaml` 中添加条目

## 每天早上 9 点自动执行（Cursor Automations）

简要步骤：

1. 在 Cursor 中打开 **Automations** → 新建
2. 触发器：**Cron** → `0 9 * * *`（每天 9:00）
3. 关联本仓库，Branch 选 `aiApi`（或你部署此代码的分支）
4. Secrets 中配置 `NEWAPI_ACCOUNTS`（须含 `session` 与 `userId`）
5. **Tools / MCP：只保留终端执行能力，不要启用 Browser 等 MCP**（失败排查会被卡住）
6. Agent 指令直接使用下方完整提示词

### 为何失败时会卡在 MCP？

Cloud Automations 里跑的是 **Agent**，不是单纯的脚本 runner。默认行为是：命令失败后尝试排查、打开浏览器、调用 MCP 工具再“修复”。签到失败通常只是 Session / userId 配置问题，本身不许 Agent 去浏览器调试；一旦走 Browser MCP 或其它交互式 MCP，云端就会长时间等待，表现为 **卡在 MCP 调用**。

解决办法就两条：

1. Automation 的 Tools 里 **关掉 Browser / 无关注联 MCP**，只保留 Shell
2. Agent 提示词写死：**只跑 `npm run tasks`，失败只汇报，不要修代码、不要调用 MCP**

## 日志

运行日志写入 `logs/YYYY-MM-DD.log`。

## 安全提示

- 不要在聊天、Issue 或 PR 中明文发送 Cookie
- 优先使用 Cursor Automation / CI 的 Secret 环境变量
- Session Cookie 通常 7–30 天过期，签到失败时请重新获取

## agent 提示词

将下面整段复制到 Automation 的 Instructions / Prompt：

```text
你是每日签到执行器。只负责在本仓库根目录执行脚本并汇报结果，禁止任何修复或排查行为。

执行步骤（严格按序，不要插入其他步骤）：
1. npm ci
2. npm run tasks

执行规则：
- 仅使用终端/Shell 执行以上两条命令
- 禁止调用任何 MCP（含 Browser、GitHub、Slack 等）
- 禁止打开浏览器、抓取页面、截图、点击页面
- 禁止修改任何文件（含 tasks.yaml、业务代码、.env、文档）
- 禁止安装额外依赖、禁止 Playwright、禁止调试命令
- 禁止为了“排查失败原因”再发起第二轮工具调用

环境变量：
- 使用已配置的 NEWAPI_ACCOUNTS（含 url、session、userId）
  或 NEWAPI_URL + NEWAPI_SESSION + NEWAPI_USER_ID

汇报要求（执行完立即用中文结束回复，不要再调工具）：
- 按 tasks.yaml 中 enabled 的任务汇报：签到成功 / 今日已签到 / 签到失败（含原因）
- 若 npm run tasks 退出码非 0：列出失败账号与原因，并指出日志目录 logs/
- 失败属于配置问题时（Session 过期、userId 错误、鉴权失败等），明确写「需要人工更新 Secrets」，然后结束
```
