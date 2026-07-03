# AGENTS.md

## Cursor Cloud specific instructions

本项目是基于 Playwright 的每日网页任务自动化脚本（当前实现 ViewTurbo 签到）。没有前端服务、后端服务或数据库，唯一的“应用”就是命令行任务执行器 `src/index.js`。

### 服务 / 运行方式

- 运行全部任务（无界面）：`npm run tasks`
- 只跑单个任务：`node src/index.js --only viewturbo-checkin`
- 命令、任务配置与扩展方式见 `README.md` 与 `tasks.yaml`，此处不重复。

### 无 lint / 无自动化测试

仓库未配置 lint 或测试框架（`package.json` 中没有 `lint`/`test` 脚本，也没有 ESLint/测试目录）。验证代码的方式就是运行任务执行器本身。

### 非显而易见的注意事项

- **需要真实凭据 + 外网**：`npm run tasks` 会用真实浏览器访问 `https://web.viewturbo.net` 并登录，必须提供环境变量 `VIEWTURBO_EMAIL`、`VIEWTURBO_PASSWORD`（本地放 `.env`，云端用 Secrets）。缺少凭据时会在登录步骤报错 `缺少环境变量 VIEWTURBO_EMAIL`——这是预期行为，说明前置流程（加载 `tasks.yaml`、启动 chromium、导航到目标站点）都正常。
- **Playwright 浏览器**：更新脚本已执行 `npx playwright install chromium`（仅下载浏览器二进制，系统库已在基础镜像中）。若运行时报缺少浏览器，重跑该命令即可。
- **登录会话缓存**：签到成功后会把登录态写入 `.auth/<site>.json`（已在 `.gitignore`）。会话失效时任务会自动用凭据重新登录。
- **运行日志**：写入 `logs/YYYY-MM-DD.log`（已忽略）。
