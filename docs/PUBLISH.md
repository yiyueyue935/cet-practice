# 发布到 GitHub

仓库名：`cet-practice`，目标地址 <https://github.com/yiyueyue935/cet-practice>。

## 当前状态（已经准备好的）

- 本地 `main`：9 次提交，67 个文件，1.53 MB，工作区干净
- **没有配 remote** —— 故意的。留着指向不存在的仓库，GitHub Desktop 会以为已经发布过，
  只给一个「Push origin」然后报 404。让 GitHub Desktop 自己去建 remote 最省事
- `legacy-bank`（含真题的旧历史）已从分支列表里移除，完整备份在
  `private/legacy-history.bundle`（1.1 GB，已 gitignore）。要恢复：

  ```bash
  git fetch private/legacy-history.bundle 'refs/heads/legacy-bank:refs/heads/legacy-bank'
  ```

- `cijing-legacy` 分支与 `cijing-v53-final` 标签仍在（旧「词境」产品，不含真题）。
  GitHub Desktop 的 Publish 只推当前分支，不会带上去

## 方法一：GitHub Desktop（推荐）

1. 打开 GitHub Desktop → **File → Add local repository…**（Ctrl+O）
2. **Choose…** 选 `D:\小明\banana\english-vocabulary-master` → **Add Repository**
   （选这个文件夹本身，不是里面的 `app` 或 `.git`）
3. 右上角出现 **Publish repository** 按钮，点它
4. 弹窗里：
   - **Name** 改成 `cet-practice`（默认会取文件夹名 `english-vocabulary-master`，必须改）
   - **取消勾选** `Keep this code private`
   - Description 可以填：`四六级备考 PWA / APK · 原创模拟题，不含真题`
   - 点 **Publish repository**
5. 等进度条走完，打开 <https://github.com/yiyueyue935/cet-practice> 确认

发布成功后 GitHub Desktop 会自动把 `origin` 配好，之后 `git push` / `npm run release` 都能直接用。

## 方法二：网页建仓库 + 命令行

1. <https://github.com/new> → Name `cet-practice` → Public → **不要**勾 README / .gitignore / license
2. 回到项目目录：

   ```bash
   git remote add origin https://github.com/yiyueyue935/cet-practice.git
   npm run release        # = 全部检查 + git push -u origin main
   ```

第一次推会弹 GitHub 登录，授权一次即可。

## 推完自查

```bash
npm run check      # 重建产物 + 内容边界 + 题库校验 + 238 条断言
```

网页上确认：

- [ ] 首页能看到 README 顶部的「非商业项目」提示
- [ ] 67 个文件、约 1.5 MB
- [ ] 搜 `cet4-2023` / `.mp3` / `.pdf` 都搜不到东西
- [ ] `LICENSE` 显示为 PolyForm Noncommercial 1.0.0
- [ ] 分支只有 `main`（没有 `legacy-bank`）

## 三条红线

1. **只推 `main`。** 不要 `git push --all` / `git push --mirror` —— 旧历史里有真题和录音。
   现在已经没有 `legacy-bank` 分支了，但这条仍然要记住
2. **Release 不要挂真题包。** CI 只能查仓库内容，查不到 Release 附件；
   把真题 zip / 录音挂上去和塞进仓库是一个性质
3. **不要 `git add -f private/`。** 那里面是你自己有权使用、但无权再分发的材料

## 之后怎么更新

```bash
npm run check
git add -A && git commit -m "……"
git push
```

CI（`.github/workflows/ci.yml`）在每次 push / PR 上跑 Node 18 与 20：
重建产物 → 检查生成文件有没有被手改 → 内容边界 → 题库校验 → 冒烟测试。
