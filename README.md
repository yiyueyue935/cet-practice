# 过级 · 四六级备考

> **非商业项目**：仅供个人学习使用，**禁止商用、禁止售卖**；题目与 AI 批改仅供参考，
> 与考试机构无关。详见 [许可与使用限制](#许可与使用限制) 与 [免责声明](#免责声明)。

一个**纯前端**的大学英语四六级备考应用：阅读刷题、听力训练、作文批改、翻译练习。
无框架、无构建步骤、零运行时依赖，`app/` 目录就是一个能跑的静态站点；
同一份代码可以打包成 Android APK（Capacitor）。

所有学习记录只存在浏览器 localStorage，AI 功能由你自己配置的 OpenAI 兼容接口提供。

> **关于题库**：仓库自带的是**原创模拟题**（四级 4 套 + 六级 4 套阅读，四级 2 套 + 六级 2 套听力），
> 不含任何真题原文、官方范文、出版社解析或考试录音 —— 那些都有版权。
> 想用自己手上的材料，按 [`docs/BANK-FORMAT.md`](docs/BANK-FORMAT.md) 放进去即可。

---

## 功能

| 模块 | 能力 |
|---|---|
| **整卷阅读** | 选词填空 / 段落匹配 / 仔细阅读三节；按官方分值判分（3.55 / 7.1 / 14.2，合计 248.5）；逐题回顾 + 解析内嵌**红色原文定位**；吸顶题干卡可「收起选项」腾出原文空间、「展开题号」直接跳题 |
| **点词查义** | 内置 7600+ 词词典，点任意单词弹出「本文意思 / 常用意思」，支持词形还原；题干与选项里的词同样可点；一键加入生词本 |
| **听力** | 25 题一套（新闻 / 长对话 / 短文）；无录音时用系统 TTS 朗读题干与选项，附「检测语音引擎」与安装指引；交卷判分 + 逐题解析 + 原文对照 |
| **作文批改** | 选套卷题目或自定义题目 → 粘贴文字或拍照/相册导入 → AI 按 15 分制评分 + 内容/语言/结构点评 + 逐句批改 + 参考范文；**离线评分**（词数/句式/衔接/常见语法错误，不联网）；内置 10 类作文模板库 |
| **翻译练习** | 中文段落 → 输入译文 → AI 对照参考译文找漏译/误译/搭配问题，并给出修改稿；同样支持拍照导入与离线评分 |
| **生词本 / 错题本** | 错题自动收录、可重做、做对自动移出；生词支持自定义分类 |
| **数据** | 进度 / 错题 / 生词 / 批改记录全部本机，不上传；备份可导出为 JSON 或直接复制文本（**不含 AI 地址与密钥**），导入前会校验版本与字段，坏文件不会动现有数据 |
| **AI 配置** | OpenAI 兼容（Ollama / LM Studio / vLLM / 云端 API），地址与密钥只存本机 |
| **响应式** | 手机单栏；≥720px 阅读页「原文在左 / 题目卡在右」两栏；≥1080px 内容区放宽到 1040px |
| **离线可用** | Service Worker 缓存外壳与做过的套卷；PWA 可装到桌面 |

## 快速开始

```bash
npm install          # 只装 jsdom（跑测试用）
npm run serve        # → http://127.0.0.1:8765/
```

不想装 Node 也可以直接双击 `app/index.html`：
网页版只读 `index.json` + 按需 fetch 单套；`file://` 下浏览器禁用 fetch，会自动注入
`bank.js` / `listening.js` 打包产物。

手机上装 PWA 需要 HTTPS 地址（Service Worker 要求）。

## 目录结构

```
app/                     可直接部署的静态站点（PWA）
  index.html
  css/app.css
  js/                    app / ai / bank / ui / exam / essay / trans / words / listen / me
                         rubric.js（离线评分引擎）+ rubric_w.js（生成的词表）
  data/exam/             套卷 JSON + index.json + bank.js / listening.js（后三者由脚本生成）
  data/listen/           听力套卷源文件
  icons/  manifest.webmanifest  sw.js
scripts/
  build_bundles.js       由套卷 JSON 生成 index.json / bank.js / listening.js / audio.js
  validate_bank.js       题库校验（结构 / 编号 / 答案唯一性 / 篇幅 / 范文与译文）
  smoke_test_cet.js      jsdom 端到端冒烟测试
  build_single_html.js   打成一个可双击的单文件 HTML
  serve.js               本地静态服务器
  sync_apk_assets.js     app/ → Capacitor 工程
  build_apk.bat          Gradle 构建入口
docs/
  BANK-FORMAT.md         题库 JSON 格式（想放自己的题看这个）
  BUILD-APK.md           打包 Android APK
  ARCHITECTURE.md        模块分工与几个关键实现
```

## 题库

```bash
npm run build      # 由套卷 JSON 重新生成 index.json / bank.js / listening.js
npm run validate   # 校验题库
```

数据入口有三层：

- `app/data/exam/index.json` —— 套卷目录，列表页只读它
- `app/data/exam/<setId>.json` —— 单套题目，按需 fetch
- `app/data/exam/bank.js` / `listening.js` —— 打包产物，**只给 `file://` 双击用**

首屏不加载这两个打包产物（否则要解析好几 MB），`file://` 打开时由 `js/bank.js` 按需注入。

完整字段说明见 [`docs/BANK-FORMAT.md`](docs/BANK-FORMAT.md)。

### 用自己手上的材料

如果你有**有权使用但无权再分发**的套卷（例如买的真题册），放在 `private/bank/` 下
（结构同 `app/data/exam/`），然后：

```bash
npm run use-private     # private/bank/ → app/data/exam/
git checkout -- app/data/exam && git clean -fd app/data/exam   # 切回仓库自带题库
```

`private/` 已在 `.gitignore` 里，不会被误提交。**提交前请务必切回来。**

## 测试

```bash
npm test
```

jsdom 冒烟覆盖：题库加载与场次分组、三题型作答与判分、吸顶卡与题号跳转、点词查义、
错题与生词流转、AI JSON 容错、作文/翻译渲染、离线评分、听力播放器与满分断言、导入导出。

`npm run check` = 重建产物 + 校验题库 + 跑冒烟，CI 里就是这条。

## 打包 APK

见 [`docs/BUILD-APK.md`](docs/BUILD-APK.md)。要点：

```bash
node scripts/sync_apk_assets.js      # app/ → cap/www 与 android assets
scripts\build_apk.bat assembleRelease
```

单包（四级 + 六级合并），不含录音，听力走系统 TTS。

## 单文件预览

```bash
npm run single     # → dist/guoji-preview.html，双击直接打开
```

把 CSS / JS / 题库全部内联，不依赖服务器，适合发给别人看界面。

## 离线评分是怎么做的

不联网也能给作文/翻译打分（`app/js/rubric.js`）：

- 33 个可计算特征（词数、句长分布、从句密度、衔接词、词汇丰富度、词表分级……）+ 10 条硬规则
- 硬规则兜底：整篇重复句、中文混入、主谓不一致、冠词/单复数/时态、句子片段
- 分项（内容 / 语言 / 结构）由特征加权得到，再映射到 15 分制
- 标点粘连先做规范化，避免「整篇缺空格」被当成十几个错误

它是**规则引擎**，不是模型：稳定、可解释、零成本，但不如 AI 批改细腻。
界面上「离线评分」和「AI 批改」是两个并列按钮，学生自己选。

## 语音朗读

用系统 TTS 引擎，不需要装插件。安卓上几个坑已经处理：

- `speak()` 必须在点击手势里同步调用（放进 `setTimeout` 会丢掉手势，安卓直接静音）
- utterance 用全局引用持有，否则会被 GC 掉、念到一半停
- 未在播放时不 `cancel()`，避免打断正在朗读的句子
- 900ms 看门狗重试（最多两次），首次静音朗读解锁 iOS

「我的 → 语音朗读」可以检测音色并试听；只有中文音色时会给安装英语语音包的步骤。

## 贡献

欢迎 PR。请先看 [`CONTRIBUTING.md`](CONTRIBUTING.md) —— 尤其是**内容贡献必须是原创**这一条。

## 许可与使用限制

**本项目仅限个人学习等非商业用途，禁止商用、禁止售卖。**
协议为 [PolyForm Noncommercial License 1.0.0](LICENSE)，中文说明见 [`LICENSE.zh-CN.md`](LICENSE.zh-CN.md)。

明确不允许（举例）：

- 售卖本项目或其修改版（含打包成 App、课程、题库、电子书售卖）
- 上架应用商店、小程序平台、付费下载站并获利
- 放进付费课程 / 付费社群 / 会员服务作为卖点或赠品
- 引流、带货、广告变现；在公司内部作为商业产品的一部分使用
- 去掉版权声明与协议文件

- 内置词典：来自 [KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)，**BSD 3-Clause**
  （词典部分按其原协议提供，与本项目其余部分的非商业限制无关）
- 题库内容：本项目原创

第三方授权全文见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。

## 免责声明

- 个人学习项目，与全国大学英语四、六级考试委员会及任何考试机构**无关联**，
  不代表、也不转述任何官方立场。
- 题库是**原创模拟题，不是真题**；题目、解析、范文、译文均为学习参考，
  **不保证正确、完整或与真实考试一致**。AI 批改与离线评分只是辅助工具，结果可能有误。
- 软件按「现状」提供，**不附带任何担保**。因使用或无法使用本项目造成的任何直接或间接损失
  （包括考试成绩、设备故障、数据丢失），作者与贡献者**不承担任何责任**。
- 你所在地区对教育类软件、AI 服务、考试培训有额外规定的，请自行遵守当地法律。
- 若你认为本项目某处侵犯了你的权利，请开 issue 联系，核实后会删除相关内容。
