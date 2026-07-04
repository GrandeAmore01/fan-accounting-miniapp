# Fan Accounting Miniapp

软件课设计账小程序，用于课程设计开发与小组协作版本管理。

GitHub 仓库地址：

https://github.com/GrandeAmore01/fan-accounting-miniapp

## 目录结构

- `src/`: 源代码
- `assets/`: 图片、图标等静态资源
- `data/`: 示例数据或本地数据文件
- `docs/`: 项目文档
- `server/`: Node.js + Express + MySQL 后端服务，第一阶段提供消费记录 REST API

## 组员协作方式

### 1. 首次克隆仓库到本地

每位组员只需要做一次：

```bash
git clone https://github.com/GrandeAmore01/fan-accounting-miniapp.git
cd fan-accounting-miniapp
```

### 2. 每次开始写代码前，先拉取最新代码

```bash
git pull origin main
```

这样可以先同步其他组员已经提交的内容，减少后续冲突。

### 3. 写完后提交并推送

```bash
git add .
git commit -m "简短描述这次做了什么"
git push origin main
```

commit message 尽量写清楚，例如：

```bash
git commit -m "完成账单列表页面"
git commit -m "新增记账表单校验"
git commit -m "修复金额输入为空时的提示"
```

### 4. 查看队友最近改了什么

```bash
git fetch origin
git log --oneline origin/main
```

如果想把队友最新代码同步到本地：

```bash
git pull origin main
```

## 协作建议

1. 不要直接修改自己不了解的文件，改之前先在群里说一声。
2. 写代码前先 `git pull origin main`，写完后尽快 `git push origin main`。
3. 如果多人同时改同一个文件，容易产生冲突，最好提前分工。
4. 提交前先运行或预览一下项目，确认没有明显报错。
5. 不要把账号密码、密钥、临时缓存文件提交到仓库。
