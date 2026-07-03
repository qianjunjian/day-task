# Automation 创建失败排查（Failed to create automation）

## 最常见原因

根据 [Cursor Automations 文档](https://cursor.com/docs/cloud-agent/automations)：

> **Cron 定时触发器默认不关联仓库。** 若自动化需要读取/执行仓库里的代码，必须在设置里**手动选择仓库和分支**。

签到任务需要 clone `qianjunjian/day-task` 并执行 `npm run tasks`，**必须绑定仓库**，否则保存时会失败。

---

## 正确创建步骤（请严格按顺序）

### 第 0 步：连接 GitHub（若未连接）

1. 打开 [Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations)
2. 连接 **GitHub**，安装 Cursor GitHub App
3. 授权访问仓库 **`qianjunjian/day-task`**

### 第 1 步：新建 Automation

1. 打开 [cursor.com/automations](https://cursor.com/automations)
2. 点击 **+ New Automation**

### 第 2 步：基本信息

- **名称**：`每日网页任务`
- **描述**：`每天 9:00 自动执行 ViewTurbo 签到`

### 第 3 步：触发器

- 类型：**Scheduled / Cron**
- 选择 **Every day at 9:00 AM**，或自定义 Cron：`0 9 * * *`

### 第 4 步：仓库（关键）

在 **Repository** 区域：

- 选择 **Single repository**（单仓库）
- Repository：`qianjunjian/day-task`
- Branch：`main`

> 不要选 "No repository"。

### 第 5 步：Secrets

| 变量名 | 值 |
|--------|-----|
| `VIEWTURBO_EMAIL` | 你的邮箱 |
| `VIEWTURBO_PASSWORD` | 你的密码 |

### 第 6 步：Agent 指令（Prompt）

```text
你是每日任务执行器。在本仓库根目录依次执行：

1. npm ci
2. npx playwright install chromium --with-deps
3. npm run tasks

要求：
- 使用已配置的 VIEWTURBO_EMAIL / VIEWTURBO_PASSWORD 环境变量
- 执行完成后用中文简要汇报每个任务结果（成功 / 已签到 / 失败原因）
- 若 npm run tasks 退出码非 0，说明失败任务与日志路径 logs/
- 不要修改 tasks.yaml 或业务代码，除非任务明确失败且需要修复
```

### 第 7 步：保存并测试

- **Permissions**：选 **Private**
- 点击 **Save** → 打开 **Enabled**
- 点击 **Run now** 测试

---

## 仍失败时请检查

| 检查项 | 处理 |
|--------|------|
| GitHub 未授权 | Dashboard → Integrations 重新连接 |
| 仓库列表里没有 day-task | 确认 GitHub App 已授权该仓库 |
| 未选仓库 | Cron 必须手动选 `qianjunjian/day-task` / `main` |
| Cloud Agent 额度 | Dashboard → Cloud Agents 查看余额 |
