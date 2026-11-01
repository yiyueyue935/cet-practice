# 第三方资源与授权说明

本项目源码以 **PolyForm Noncommercial License 1.0.0** 发布（见 `LICENSE`，仅限非商业用途）。
以下是随仓库分发、但版权不属于本项目的部分，它们各自适用自己的协议。

---

## 1. 内置词典 `app/data/exam/dict.js`

基于开源项目 **english-vocabulary** 整理：

- 项目地址：<https://github.com/KyleBing/english-vocabulary>
- 作者：KyleBing
- 协议：**BSD 3-Clause License**
- 版权：Copyright (c) 2022-2026, KyleBing

本项目在原数据基础上做了合并去重、词形归并与少量释义修订，共 7631 词条
（CET4 / CET6 / 高中 / 初中词表合并）。依照 BSD 3-Clause 第 2 条，随分发附原协议全文：

```
BSD 3-Clause License

Copyright (c) 2022-2026, KyleBing

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## 2. 题库内容

`app/data/exam/cet*-mock-*.json`、`app/data/listen/cet*-mock-*.json`、
`app/data/exam/templates.js` 中的全部英文与中文文本（阅读文章、听力原文、题目、选项、
解析、作文范文、参考译文、模板句式）均为本项目**原创撰写**，随本项目协议（PolyForm Noncommercial 1.0.0）发布。

**仓库不包含任何四六级真题原文、官方范文、出版社解析或考试录音。**
真题的著作权归全国大学英语四、六级考试委员会及其出版方所有，
分发其原文、听力稿与解析可能构成侵权，因此本项目不予收录，也不接受相关 PR。

## 3. 图标与字体

`app/icons/` 下的图标由 `scripts/gen_icons.js` 与 `scripts/gen_app_icons.py` 生成，原创。
界面不加载任何外部字体，全部使用系统字体栈。

## 4. 运行时依赖

前端零依赖（原生 JS）。开发期只用到 `jsdom`（MIT）跑冒烟测试。
