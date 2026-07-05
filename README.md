# Fan Accounting Miniapp

软件课设计账小程序，用于课程设计开发与小组协作版本管理。

GitHub 仓库地址：

https://github.com/GrandeAmore01/fan-accounting-miniapp

## 协作开发说明

本项目采用“公共文件接力 + 个人页面并行”的协作方式。

- `main` 是稳定分支，组员不要直接在 `main` 上开发或 push。
- 每位组员从最新 `main` 新建自己的 `feature/*` 分支开发。
- 每个人优先只修改自己负责的 `pages/xxx/` 页面目录。
- 所有合并必须通过 Pull Request，由组长检查后再合并。
- 公共文件默认由组长维护，需要修改时需要遵循时间安排。
- 遇到 conflict 不要自行乱合并，先联系组长处理。

详细规则见：

- `CONTRIBUTING.md`
- `GIT_WORKFLOW.md`

## 目录结构

- `pages/`: 小程序页面目录
- `assets/`: 图片、图标等静态资源
- `data/`: 公共数据文件
- `docs/`: 项目文档
- `services/`: 前端公共服务和业务逻辑
- `server/`: Node.js + Express + MySQL 后端服务
- `src/`: 预留源代码目录

## 高风险公共文件

下面这些文件或目录影响范围大，不要随便改：

- `app.json`: 页面注册、窗口配置等
- `app.js`: 小程序全局逻辑
- `app.wxss`: 全局样式
- `project.config.json`: 微信开发者工具项目配置
- `sitemap.json`: 小程序索引配置
- `data/`: 公共数据
- `services/`: 公共服务和业务逻辑
- `server/`: 后端接口、数据库脚本和服务逻辑

如果必须修改公共文件，一定要注意沟通和时间安排，避免冲突

## 组员日常开发流程

### 1. 第一次克隆仓库

每位组员只需要做一次：

```bash
git clone https://github.com/GrandeAmore01/fan-accounting-miniapp.git
cd fan-accounting-miniapp
```

### 2. 每次开始开发前，先同步 main

```bash
git checkout main
git pull origin main
```

### 3. 新建自己的 feature 分支

不要直接在 `main` 上写代码。

```bash
git checkout -b feature/姓名-任务
```

示例：

```bash
git checkout -b feature/zhangsan-expenses
git checkout -b feature/lisi-budget
```

### 4. 写完后提交到自己的分支

```bash
git status
git add .
git commit -m "简短说明这次做了什么"
git push -u origin feature/姓名-任务
```

后续如果继续在同一个分支提交，可以直接：

```bash
git push
```

### 5. 在 GitHub 创建 Pull Request

1. 打开 GitHub 仓库页面。
2. 点击 `Compare & pull request`。
3. 确认 base 是 `main`，compare 是自己的 feature 分支。
4. 按 PR 模板填写修改内容、影响页面、是否测试、是否修改公共文件。
5. 创建 PR 后发到群里，让组长检查。

## 分工建议

- 同学 A：消费记录高级功能，默认修改 `pages/expenses/`。
- 同学 B：预算统计可视化，默认修改 `pages/budget/`。
- 同学 C：藏品图鉴升级，默认修改 `pages/collections/`。
- 同学 D：舞台回忆与报告，默认修改 `pages/stages/` 和 `pages/memories/`。
- 组长：公共文件接力维护，例如 `app.json`、`app.wxss`、`data/`、`services/`、`server/`。

## 注意事项

1. 禁止直接 push 到 `main`。
2. 禁止 `git push --force`。
3. 禁止删除别人负责的文件。
4. 禁止一个 PR 混入多个无关任务。
5. 禁止提交 `.env`、`node_modules/`、`server/mysql-data/`、临时文件和本地缓存。
6. 遇到冲突先联系组长，不要自己乱合并。
