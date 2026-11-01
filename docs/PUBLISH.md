# 发布到 GitHub

仓库名：`cet-practice`，远端已经配好：

```
origin  https://github.com/yiyueyue935/cet-practice.git
```

本地 `main` 分支已经是干净的 7 次提交、67 个文件、1.53 MB，
不含真题、录音、签名文件（`private/` `cap/` `dist/` `*.keystore` 都在 `.gitignore` 里）。

## 第一步：建一个空仓库

打开 <https://github.com/new>，填：

- Repository name：`cet-practice`
- 可见性：**Public**
- **不要**勾选 "Add a README file"、".gitignore"、"license" —— 勾了会多出一个初始提交，
  推的时候要先 `git pull --rebase`，白白多一步

## 第二步：推

```bash
git push -u origin main
```

第一次推会弹出 GitHub 登录（浏览器授权或输入 Personal Access Token），
登录一次之后 Git Credential Manager 会记住。

> 如果你更习惯命令行建仓库：
> ```bash
> winget install GitHub.cli     # 或 scoop install gh
> gh auth login                 # 选 GitHub.com → HTTPS → 浏览器授权
> gh repo create cet-practice --public --source=. --remote=origin --push
> ```

## 推之前 / 推之后的自查

```bash
npm run check        # 重建产物 + 内容边界 + 题库校验 + 238 条冒烟断言
```

推完在网页上确认：

- [ ] 仓库首页能看到 README 的「非商业项目」提示
- [ ] 文件数 67、总大小约 1.5 MB
- [ ] 搜索 `cet4-2023` / `.mp3` / `.pdf` 都搜不到东西
- [ ] `LICENSE` 显示为 PolyForm Noncommercial 1.0.0
- [ ] Settings → 确认没有意外公开的 Actions secrets（本项目没有 secret）

## 三条红线

1. **只推 `main`。** 本地还有 `legacy-bank` 和 `cijing-legacy` 两个分支，
   里面有含真题的旧历史。永远不要 `git push --all` / `git push --mirror`。
2. **Release 不要挂真题包。** CI 只能查仓库内容，查不到 Release 附件；
   把真题 zip / 录音挂上去和塞进仓库是一个性质。
3. **不要 `git add -f private/`。** 那目录里是你自己有权使用、但无权再分发的材料。

## 之后怎么更新

```bash
npm run check
git add -A && git commit -m "……"
git push
```

CI（`.github/workflows/ci.yml`）会在每次 push / PR 上跑 Node 18 与 20：
重建产物 → 检查生成文件有没有被手改 → 内容边界 → 题库校验 → 冒烟测试。
