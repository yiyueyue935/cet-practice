# 题库格式（cet-bank/1）

「过级」的题库是纯 JSON，不含任何构建步骤。仓库自带的 `app/data/exam/*.json`
是**原创模拟题**；你也可以按本文档的格式放自己的套卷（例如自己整理的真题），
放进去后跑一次 `node scripts/build_bundles.js` 即可被 App 读到。

> 分发他人享有著作权的真题原文（含听力原文、官方范文、出版社解析）可能构成侵权，
> 请自行确认你对手上的材料有分发权。本仓库不提供、也不接收此类内容。

---

## 1. 目录约定

```
app/data/exam/
  index.json          由脚本生成，套卷目录
  <setId>.json        单套阅读卷（选词填空 + 段落匹配 + 仔细阅读 + 作文 + 翻译）
  bank.js             由脚本生成，index + 所有套卷的打包产物（file:// 双击用）
  listening.js        由脚本生成，听力题库打包产物
  dict.js             内置词典（词库来源见 THIRD-PARTY-NOTICES.md）
  templates.js        作文模板库

app/data/listen/
  <setId>.json        单套听力卷（源文件，构建时汇总进 listening.js）
```

`<setId>` 建议用 `级别-年份-月份-套号`，例如 `cet4-2024-06-1`；
本仓库的原创模拟卷用 `cet4-mock-1`、`cet6-mock-1`、`cet4-mock-l1`（听力）这种命名。

---

## 2. 阅读套卷 `<setId>.json`

```jsonc
{
  "schema": "cet-bank/1",
  "meta": {
    "level": "cet4",              // "cet4" | "cet6"
    "year": 2026,                 // 年份，用于「整卷练习」分组
    "month": 1,                   // 月份
    "set": 1,                     // 第几套
    "title": "原创模拟 四级 第1套",
    "source": "原创模拟题（本项目作者撰写，非真题）",
    "mock": true                  // true = 原创模拟卷，列表页会单独归到「原创模拟」
  },
  "reading": [ /* 4 个 section，见下 */ ],
  "writing": { /* 见 2.5 */ },
  "translation": { /* 见 2.6 */ }
}
```

`reading` 数组固定 4 个元素，`key` / `type` / 顺序都不能变（UI 按 type 渲染）：

| key | type | 名称 | 题号 |
|---|---|---|---|
| `A` | `banked_cloze` | Section A 选词填空 | 26–35 |
| `B` | `paragraph_matching` | Section B 段落匹配 | 36–45 |
| `C1` | `careful_reading` | Section C 仔细阅读（Passage One） | 46–50 |
| `C2` | `careful_reading` | Section C 仔细阅读（Passage Two） | 51–55 |

### 2.1 选词填空 `banked_cloze`

```jsonc
{
  "key": "A",
  "type": "banked_cloze",
  "name": "Section A 选词填空",
  "short": "选词填空",
  "instructions": "从 15 个单词中为每个空选一个，每词只用一次。",
  "passage": "…… and then you [[26]] the dough …… and finally [[35]] it ……",
  "word_options": [ { "k": "A", "t": "abandon" }, … 共 15 个 … ],
  "questions": [
    { "n": 26, "answer": "L", "explanation": "答案 L) sew。……" }
  ]
}
```

- `passage`：220–260 词的连贯说明文/议论文，**恰好 10 个空位**，占位符写成 `[[26]]` … `[[35]]`，
  前后各留一个空格。空位之间至少隔 12 个词。
- `word_options`：15 个单词，`k` 为 `A`–`O`，`t` 为单词原形；**不得重复**；
  建议 5 动词 / 4 名词 / 3 形容词 / 2 副词 / 1 其他，难度以四级为基准。
- `questions`：10 题，`n` 为 26–35，`answer` 是字母；**10 个答案字母互不相同**（每词只用一次）。
- 空格前后必须有足够语法线索，使答案唯一可解（时态、单复数、搭配、词性）。

### 2.2 段落匹配 `paragraph_matching`

```jsonc
{
  "key": "B",
  "type": "paragraph_matching",
  "name": "Section B 段落匹配",
  "short": "段落匹配",
  "instructions": "为每句话找到对应的段落字母，段落可重复使用。",
  "paragraphs": [ { "label": "A", "text": "……" }, … 共 10 段 A–J … ],
  "questions": [
    { "n": 36, "stem": "……", "answer": "F", "explanation": "答案 F 段。……" }
  ]
}
```

- 10 段，`label` 为 `A`–`J`，每段 60–120 词，合计 900–1100 词；整篇是同一主题的
  科普/社会/教育类长文，段与段之间有逻辑衔接。
- 10 条陈述 `stem`（36–45），每条对应一个段落，**至少 8 个不同段落被用到**。
- 陈述必须是同义改写，不能整句照搬段落原文。

### 2.3 仔细阅读 `careful_reading`

```jsonc
{
  "key": "C1",
  "type": "careful_reading",
  "name": "Section C 仔细阅读（Passage One）",
  "short": "仔细阅读一",
  "instructions": "",
  "passage": "……",
  "questions": [
    {
      "n": 46,
      "stem": "What does the author suggest in paragraph 2?",
      "options": { "A": "……", "B": "……", "C": "……", "D": "……" },
      "answer": "B",
      "explanation": "答案 B。第 2 段第 3 句说……；A 项……与原文相反。"
    }
  ]
}
```

- `passage`：350–450 词，4–5 段；`C1` 题号 46–50，`C2` 题号 51–55。
- 每题 4 个选项 A–D，长度相近；正确答案在原文中有明确依据，干扰项要么与原文相反、
  要么偷换概念、要么过度推断。
- 题型分布建议：细节 2 / 推断 1 / 词义或指代 1 / 主旨或态度 1。

### 2.4 `explanation` 写法

中文，1–3 句，**以「答案 X。」开头**（选词填空写「答案 X) word。」），包含：

1. 定位（第几段第几句 / 哪个分句）；
2. 依据（原文关键词 → 选项关键词的同义对应）；
3. 干扰项为什么不成立（点 1–2 个即可，不必逐项）。

不要复制任何出版方解析的措辞，用自己的话写。

### 2.5 作文 `writing`

```jsonc
"writing": {
  "directions": "Directions: For this part, you are allowed 30 minutes to write an essay on the importance of learning to work in a team. You should write at least 120 words but no more than 180 words.",
  "prompt_cn": "以「团队合作的重要性」为题写一篇短文。",
  "word_limit": 120,
  "sample_essay": "…… 140–170 词，3 段 ……",
  "sample_essay_cn": "…… 对应中文译文 ……"
}
```

### 2.6 翻译 `translation`

```jsonc
"translation": {
  "source_cn": "…… 140–180 字纯中文段落，主题为中国文化/社会/科技/教育 ……",
  "reference_en": "…… 一段英文参考译文 ……",
  "vocab": [],
  "reference_en_ok": true
}
```

- `source_cn` **只放中文**，不要带 `Translation (30 minutes) Directions: …` 这类英文说明
  （旧数据里有，脚本会自动裁掉，但新数据请直接写干净）。
- `reference_en` 必须是自己译的，不要抄现成译文；`reference_en_ok: true` 表示译文可用
  （设为 `false` 时 App 会忽略它，改由 AI 现场生成）。

---

## 3. 听力套卷 `app/data/listen/<setId>.json`

```jsonc
{
  "id": "cet4-mock-l1",
  "level": "cet4",
  "year": 2026,
  "month": 1,
  "set": 1,
  "mock": true,
  "sections": [
    { "name": "Section A", "questions": [ /* 7 题，1–7 */ ] },
    { "name": "Section B", "questions": [ /* 8 题，8–15 */ ] },
    { "name": "Section C", "questions": [ /* 10 题，16–25 */ ] }
  ],
  "transcripts": {
    "第1-2题": ["第一段原文……", "第二段原文……"],
    "第3-4题": ["……"]
  },
  "answers": { "1": "D", "2": "A", "…": "…", "25": "A" },
  "exps": { "1": "答案 D。新闻开头提到……", "…": "…" }
}
```

- 题号 1–25，每题 4 个选项 `{ "A": "…", "B": "…", "C": "…", "D": "…" }`。
- `group` 字段写该题所属材料，用于把同一条录音的题目绑在一起、并显示原文：
  Section A `第1-2题` / `第3-4题` / `第5-7题`；Section B `第8-11题` / `第12-15题`；
  Section C `第16-18题` / `第19-21题` / `第22-25题`。
- `transcripts[group]` 是字符串数组（每段一个元素），就是该材料的完整听力原文。
- `answers` 覆盖 1–25 全部题号；`exps` 覆盖 1–25 全部题号（中文，以「答案 X。」开头）。
- 材料篇幅参考：新闻 120–180 词/条，长对话 250–320 词/段，短文 220–300 词/篇。

---

## 4. 构建与校验

```bash
node scripts/build_bundles.js   # 由套卷 JSON 生成 index.json / bank.js / listening.js
node scripts/validate_bank.js   # 结构、编号、答案唯一性、范文词数、译文语言
node scripts/smoke_test_cet.js  # jsdom 冒烟测试（需先 npm i）
```

`index.json` 里每条记录的 `counts` 由脚本从套卷内容统计，不要手改。
