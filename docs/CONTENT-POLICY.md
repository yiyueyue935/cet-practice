# 内容边界：代码开源，真题不进仓库

一句话：**这个仓库是刷题工具，不是题库。** 代码随你改，真题请自己准备、自己本地用。

## 为什么要有这条线

四六级是全国统一考试，但试卷本身不等于「公共领域」：

- 阅读选文、听力材料（含听力原文）是有作者的文字作品
- 出版机构整理的整套真题册、逐题解析，有汇编与注释的独创性
- 考试录音的表演者与录制者另有权利

把这些随开源仓库公开分发，超出了「个人使用」的合理使用范围，可能被投诉、被下架。
所以本仓库**不存放、不分发**任何真题材料。

## 仓库里有什么

| 有 | 说明 |
|---|---|
| 程序代码 | 前端全部逻辑、离线评分引擎、AI 客户端、PWA/APK 打包脚本，PolyForm Noncommercial 1.0.0 |
| 原创模拟题 | 四级 / 六级各 4 套阅读（选词填空 / 段落匹配 / 仔细阅读 / 作文 / 翻译）、各 2 套听力，全部由本项目撰写，`meta.mock: true` |
| 作文句式库 | 通用写作套语整理，占位符 `[方括号]` |
| 内置词典 | 来自 [KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)，BSD 3-Clause，见 `THIRD-PARTY-NOTICES.md` |

## 仓库里没有什么

- ❌ 历年真题原文、阅读文章、听力原文
- ❌ 出版社 / 培训机构的解析、范文、译文
- ❌ 考试录音（mp3 / ogg / 任何音频）
- ❌ 真题 PDF / Word / 扫描件 / 压缩包

`npm run check-content` 会把这些都拦下来，CI 每次提交都跑。

## 想用自己手上的题库

你有权使用、但无权再分发的材料（比如买的真题册），放在本地、不进 git：

```bash
# 1. 按 docs/BANK-FORMAT.md 的格式放好
private/bank/reading/*.json
private/bank/listening.js        # 可选
private/bank/index.json          # 可选，缺省会按套卷重建

# 2. 切过去（private/ 已在 .gitignore 里）
npm run use-private

# 3. 用完切回仓库自带的原创题库
git checkout -- app/data/exam && git clean -fd app/data/exam
```

**只限个人自用。** 把整理好的真题包再发出去（发群、发网盘、发 Release、传 Gitee）
就是另一回事了 —— 那是分发，不是使用。

## 只想要纯框架（一份内容都不要）

```bash
rm app/data/exam/cet*-mock-*.json app/data/listen/*.json
npm run build        # 重建 index.json / bank.js / listening.js（会是空题库）
```

App 仍能启动，只是列表为空；把自己准备的套卷放进去再 `npm run build` 就有题了。

## 机器怎么守这条线

`scripts/check_content.js` 每次 `npm run check` 和 CI 都会跑，规则：

1. 任何 `.mp3/.ogg/.m4a/.wav/.pdf/.doc/.docx/.rar/.7z/.apk` 都不许入库
2. 文件名形如 `cet4-2023-06-1` 的套卷直接拒绝（原创请用 `cet4-mock-1`）
3. `app/data/exam/*.json` 与 `app/data/listen/*.json` 必须写 `"mock": true`
4. `meta.source` 里不许出现「真题」（除非是「非真题」这种否定表述）
5. 单套 JSON 超过 200KB、题库总体积超过 6MB 会报警
6. `app/audio/` 里任何文件被 git 跟踪即失败

## 举报与删除

如果你认为本仓库某处侵犯了你的权利，请开 issue 说明具体文件与权利依据，
核实后会立即删除相关内容。见 `LICENSE.zh-CN.md` 的免责声明。
