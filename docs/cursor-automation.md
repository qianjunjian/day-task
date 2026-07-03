# Cursor Automations 定时配置指南

本仓库设计为在 **Cursor Automations** 中每天 9:00 自动执行 `npm run tasks`。

## 推荐 Automation 配置

| 项目 | 值 |
|------|-----|
| 名称 | 每日网页任务 |
| 描述 | 自动执行 ViewTurbo 签到等配置的网页任务 |
| 触发器 | Cron：`0 9 * * *`（每天上午 9:00，按 Cursor 显示的时区） |
| 仓库 | 本 `day-task` 仓库 |

## 环境变量（Secrets）

在 Automation 编辑器中为以下变量配置 Secret（不要写入代码仓库）：

| 变量名 | 说明 |
|--------|------|
| `VIEWTURBO_EMAIL` | ViewTurbo 登录邮箱 |
| `VIEWTURBO_PASSWORD` | ViewTurbo 登录密码 |

## Agent 执行指令（Prompt）

将以下内容作为 Automation 的 Agent 指令：

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

## 扩展更多网站

1. 在 `src/tasks/` 新增任务模块
2. 在 `tasks.yaml` 增加 `enabled: true` 的条目
3. 如需新账号，在 Automation Secrets 中增加对应 `XXX_EMAIL` / `XXX_PASSWORD`
4. 无需修改 Cron；一次 Automation 会顺序执行 `tasks.yaml` 中所有启用任务

## 本地 Windows 备选方案

若不想使用 Cursor Cloud，可在本机用「任务计划程序」每天 9:00 运行：

```powershell
cd e:\workspace_front\day-task
npm run tasks
```

前提：电脑 9:00 处于开机状态。

## 故障排查

| 现象 | 处理 |
|------|------|
| 登录失败 | 检查 Secret 中邮箱密码是否正确 |
| Playwright 浏览器缺失 | 确保 Automation 指令包含 `npx playwright install chromium --with-deps` |
| 今日已签到 | 正常，脚本会跳过并记录 `already_checked_in` |
| Node 版本过低 | 本地需 Node 18+；Cloud Agent 通常已满足 |
