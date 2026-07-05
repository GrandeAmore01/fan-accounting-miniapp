# 小组协作规范

这个仓库是微信小程序课程设计项目。为了减少互相覆盖、误删文件和合并冲突，请所有组员按下面规则开发。

## 基本原则

1. 禁止直接 push 到 `main`。
2. `main` 是稳定分支，只放已经确认可以合并的代码。
3. 每次开始开发前，必须先从 `main` 拉取最新代码，再新建自己的 `feature` 分支。
4. 每个人只改自己负责的页面、模块或文件。
5. 公共配置文件原则上只由组长维护。
6. 如果必须修改公共文件，先在群里说明原因，等组长确认后再改。
7. 每次提交必须写清楚 commit message。
8. 每次完成任务后必须提交 Pull Request，不要直接合并。
9. 出现 conflict 时不要乱点合并，先联系组长处理。
10. 禁止 force push，禁止删除别人文件，禁止一个 PR 混入多个无关任务。

## 高风险公共文件

下面这些文件或目录影响范围大，容易造成冲突。非必要不要修改：

- `app.json`: 页面注册、全局窗口配置、tabBar 等。
- `app.js`: 小程序全局启动逻辑。
- `app.wxss`: 全局样式。
- `project.config.json`: 微信开发者工具项目配置。
- `sitemap.json`: 小程序索引配置。
- `.gitignore`: Git 忽略规则。
- `README.md`、`CONTRIBUTING.md`、`GIT_WORKFLOW.md`: 项目说明和协作规则。
- `data/`: 公共数据文件，例如分类、阶段、消费类型等。
- `services/`: 公共服务和工具逻辑，例如本地存储、接口请求、业务 service。
- `server/package.json`、`server/pnpm-lock.yaml`: 后端依赖配置。
- `server/sql/`: 数据库结构脚本。
- `server/src/app.js`、`server/src/db.js`: 后端入口和数据库连接。
- `server/src/routes/`、`server/src/utils/`: 后端公共路由和工具逻辑。
- 未来如果新增 `components/`、`utils/`、`cloudfunctions/` 等公共目录，也按高风险公共目录处理。

## 分支命名建议

分支名尽量能看出是谁在做什么：

```bash
feature/yourname-expenses
feature/yourname-budget
feature/yourname-profile
fix/yourname-expense-style
docs/yourname-readme
```

## 提交信息要求

commit message 要简短但说清楚做了什么，例如：

```bash
git commit -m "完善消费记录页面样式"
git commit -m "新增预算统计展示"
git commit -m "修复阶段列表金额显示"
```

不要写这种看不出内容的说明：

```bash
git commit -m "update"
git commit -m "修改"
git commit -m "1"
```

## Pull Request 要写清楚

每个 PR 至少说明：

- 本次改了什么。
- 影响哪些页面或模块。
- 是否在微信开发者工具中运行过。
- 是否修改了公共文件。
- 是否新增或删除文件。
- 需要组长重点检查哪里。

## 冲突处理

如果 GitHub 提示 `This branch has conflicts`，或者本地 `git pull` 出现 conflict：

1. 不要随便点网页上的合并按钮。
2. 不要删除看不懂的代码。
3. 先截图或复制冲突提示发到群里。
4. 联系组长一起处理。

## 明确禁止

- 禁止直接 push 到 `main`。
- 禁止 `git push --force`。
- 禁止删除别人负责的文件。
- 禁止把 `node_modules/`、`.env`、数据库本地数据、临时文件传上来。
- 禁止一个 PR 同时改多个无关功能。
- 禁止没有说明就修改公共配置文件。

