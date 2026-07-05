# Git 日常协作流程

这份文档给组员日常开发时照着做，目标是减少冲突和误操作。

## 第一次克隆仓库

只需要做一次：

```bash
git clone https://github.com/GrandeAmore01/fan-accounting-miniapp.git
cd fan-accounting-miniapp
```

## 每天开始开发前

先切回 `main`，拉取最新代码：

```bash
git checkout main
git pull origin main
```

## 新建自己的功能分支

不要直接在 `main` 上写代码。每次做任务前，从最新的 `main` 新建分支：

```bash
git checkout -b feature/yourname-task
```

例子：

```bash
git checkout -b feature/zhangsan-expenses
git checkout -b feature/lisi-budget
```

## 提交代码

写完后先查看改了哪些文件：

```bash
git status
```

确认没有误改别人的文件、没有 `.env`、`node_modules`、数据库数据等本地文件后，再提交：

```bash
git add .
git commit -m "简短说明这次做了什么"
```

## push 到自己的分支

第一次 push 当前分支：

```bash
git push -u origin feature/yourname-task
```

之后如果继续在这个分支提交，可以直接：

```bash
git push
```

## 在 GitHub 上创建 Pull Request

1. 打开 GitHub 仓库页面。
2. 点击 `Compare & pull request`。
3. 确认 base 是 `main`，compare 是自己的 feature 分支。
4. 按模板写清楚改了什么、影响哪些页面、是否测试过、是否改了公共文件。
5. 创建 PR 后发到群里让组长检查。

## 遇到 conflict 怎么办

如果 GitHub 或命令行提示冲突：

1. 先暂停，不要乱点合并。
2. 不要删除看不懂的代码。
3. 把冲突提示截图或复制到群里。
4. 联系组长一起处理。

## 不小心改错了怎么办

如果还没有提交，先查看改动：

```bash
git status
git diff
```

如果只是某个文件改错了，先告诉组长，不要随便用会清空大量改动的命令。

如果已经提交但还没 push，也先联系组长，看是新提交修复，还是回退。

如果已经 push 到自己的 feature 分支，不要 force push，直接再提交一个修复 commit：

```bash
git add .
git commit -m "修复上次提交的问题"
git push
```

## 每次开发前后的检查清单

开发前：

- 已经 `git checkout main`
- 已经 `git pull origin main`
- 已经新建 feature 分支

提交前：

- 只改了自己负责的页面或模块
- 没有误改公共文件
- 没有提交 `.env`、`node_modules`、数据库数据
- 已经在微信开发者工具中运行或预览过

提交后：

- 已经 push 到自己的 feature 分支
- 已经创建 Pull Request
- 已经在群里通知组长检查

