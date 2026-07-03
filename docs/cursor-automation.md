# Cursor Automations 配置与测试指南

仓库：[qianjunjian/day-task](https://github.com/qianjunjian/day-task)

---

## 一、创建 Automation（约 5 分钟）

### 1. 打开 Automations

1. 在 Cursor 左侧边栏点击 **Automations**（或通过命令面板搜索 `Automations`）
2. 点击 **New Automation** / **新建**

### 2. 基本信息

| 字段 | 填写内容 |
|------|----------|
| 名称 | `每日签到任务` |
| 描述 | `每天 9:00 自动执行 tasks.yaml 中启用的签到任务` |

### 3. 关联 Git 仓库（Cron 必做，否则易报 Failed to create automation）

> **重要：** Cron 定时触发器**默认不绑定仓库**。必须手动选择，否则无法执行 `npm run tasks`。

| 字段 | 填写内容 |
|------|----------|
| Repository 模式 | **Single repository**（单仓库，不要选 No repository） |
| Repository | `qianjunjian/day-task` |
| Branch | `main` |

**先连接 GitHub：** [Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations) → 安装 Cursor GitHub App → 授权 `day-task` 仓库。

> 若列表里找不到仓库，先在 Integrations 中授权 GitHub 并勾选该仓库。

### 4. 设置触发器（定时）

- 类型：**Schedule / Cron**
- Cron 表达式：`0 9 * * *`
- 含义：每天上午 **9:00**（以 Cursor 界面显示的时区为准，一般为你的本地时区）

### 5. 配置 Secrets（环境变量）

在 Automation 编辑器的 **Secrets** 或 **Environment variables** 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEWAPI_ACCOUNTS` | `[{"name":"7r.fit","url":"https://api.7r.fit","session":"..."}]` | New API 站点 Cookie 签到（按 tasks.yaml 启用） |
| `NEWAPI_URL` | `https://api.7r.fit` | 单站点简写（与 `NEWAPI_SESSION` 配合） |
| `NEWAPI_SESSION` | 你的 session 值 | 单站点简写 |
| `VIEWTURBO_EMAIL` | 你的 ViewTurbo 邮箱 | 启用 viewturbo-checkin 时使用 |
| `VIEWTURBO_PASSWORD` | 你的 ViewTurbo 密码 | 勾选 Secret 类型 |

> 仅启用 HTTP 签到任务时，可不配置 ViewTurbo 相关变量；但 Prompt 中仍建议保留 Playwright 安装步骤，以便后续启用浏览器任务。

### 6. Agent 执行指令（Prompt）

将下面整段复制到 Automation 的 **Instructions / Prompt** 框：

```text
你是每日任务执行器。在本仓库根目录依次执行：

1. npm ci
2. npx playwright install chromium --with-deps
3. npm run tasks

要求：
- 使用已配置的 NEWAPI_ACCOUNTS（Cookie 签到）和 VIEWTURBO_*（浏览器签到）
- 按 tasks.yaml 中 enabled 的任务汇报：签到成功 / 今日已签到 / 失败原因
- 若 npm run tasks 退出码非 0，说明失败任务与日志路径 logs/
- 不要修改 tasks.yaml 或业务代码，除非任务明确失败且需要修复
```

### 7. 运行环境

- 选择 **Cloud Agent**（云端运行，无需本机开机）
- 确认已开启 Cloud Agents（[Cursor Dashboard → Cloud Agents](https://cursor.com/dashboard?tab=cloud-agents)）

### 8. 保存并启用

点击 **Save**，然后打开 **Enabled** 开关。

---

## 二、如何测试

有三种测试方式，推荐按顺序做。

### 方式 A：手动立即运行（推荐，最快）

1. 打开刚创建的 **每日签到任务** Automation
2. 找到 **Run now** / **Test** / **手动运行** 按钮（不同版本文案可能略有差异）
3. 点击后等待 Cloud Agent 执行完成
4. 在 **Runs** / **运行记录** 中查看日志

**预期成功结果示例：**

```json
{
  "id": "api-7r-fit-checkin",
  "ok": true,
  "result": {
    "status": "success",
    "message": "..."
  }
}
```

或今日已签到时：

```json
{
  "status": "already_checked_in",
  "message": "..."
}
```

### 方式 B：临时改 Cron 测定时触发

1. 把 Cron 临时改为 **2 分钟后** 会触发的时间  
   例如当前 10:05，可设为 `7 10 * * *`（10:07 触发）
2. 保存并等待自动触发
3. 在 **Runs** 里确认有新一轮执行
4. 测试通过后改回 `0 9 * * *`

### 方式 C：本地先跑通脚本（验证代码，不经过 Cursor）

在本机 Node 18+ 后：

```powershell
cd e:\workspace_front\day-task
npm install
npm run tasks
```

> 仅 HTTP 签到任务无需 `npm run install:browsers`；若启用了 ViewTurbo，则需安装 Chromium。

本地跑通只说明 **脚本没问题**；Cursor 云端是否成功还要看 Secrets 和 Cloud Agent 环境。

---

## 三、检查清单

保存 Automation 前确认：

- [ ] 仓库为 `qianjunjian/day-task`，分支 `main`
- [ ] Cron 为 `0 9 * * *`
- [ ] 已配置 `NEWAPI_ACCOUNTS` 或 `NEWAPI_URL` + `NEWAPI_SESSION`
- [ ] 若启用 ViewTurbo，已配置 `VIEWTURBO_EMAIL`、`VIEWTURBO_PASSWORD`
- [ ] Prompt 包含 `npm ci` + `playwright install` + `npm run tasks`
- [ ] Automation 已 **Enabled**
- [ ] 已用 **Run now** 手动测试至少一次

---

## 四、常见问题

| 现象 | 原因与处理 |
|------|------------|
| 找不到仓库 | GitHub 未授权或仓库未 push |
| Session 已过期 | 重新登录站点，更新 `NEWAPI_ACCOUNTS` 中的 session |
| 未配置站点账号 | `NEWAPI_ACCOUNTS` 中 url 需与 `tasks.yaml` 的 `baseUrl` 一致 |
| Playwright 报错 | Prompt 里缺少 `npx playwright install chromium --with-deps`（仅浏览器任务需要） |
| 今日已签到 | 正常，`already_checked_in` 不是失败 |
| Run now 无反应 | 检查 Cloud Agents 额度与 Enabled 开关 |
| 时区不对 | 在 Automation 界面确认 Cron 显示的时区 |

---

## 五、参考文件

- 预填配置 JSON：[`automation-prefill.json`](./automation-prefill.json)（供对照，不能代替 UI 保存）
- 任务列表：[`tasks.yaml`](../tasks.yaml)
- New API 签到：[`src/tasks/newapi-checkin.js`](../src/tasks/newapi-checkin.js)
- ViewTurbo 签到：[`src/tasks/viewturbo-checkin.js`](../src/tasks/viewturbo-checkin.js)
