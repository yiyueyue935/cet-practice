/* 离线作文评分（门面）
 *
 * 实际实现在 js/rubric.js：33 维语言特征 + 10 条语法规则 + 三维加权（内容/语言/结构）。
 * 这里保留 OfflineGrade 这个名字，是为了让 essay.js 与冒烟测试的调用点一行都不用改。
 *
 * 旧版（手调常数 + 5 条排版检查）见 git 历史：commit c75907f 之前的 app/js/offline.js。
 * 之所以不留在包里：那 172 行是死代码，回滚靠 git 比靠一个 _legacy 分支干净。
 */
var OfflineGrade = {
  /* 与 Rubric.essay 同签名、同输出结构（score/band/dimension/sentences/upgrade/offline/stats） */
  grade: function (text, prompt, level) {
    if (typeof Rubric === 'undefined' || !Rubric.essay) {
      /* rubric_w.js / rubric.js 没加载上（多见于缓存版本错配）——给出可读的降级结果，不要白屏 */
      return {
        score: 0,
        band: '本地评分模块未加载',
        dimension: {
          content: '本地评分模块未加载，请刷新页面重试。',
          language: '',
          organization: ''
        },
        sentences: [],
        upgrade: ['刷新页面后重试；若仍失败，用「AI 批改」或检查网络缓存。'],
        sample: '',
        sample_cn: '',
        offline: true,
        stats: { words: 0, sentences: 0, paragraphs: 0, ttr: 0, errors: 0 }
      };
    }
    return Rubric.essay(text, prompt, level);
  },

  /* 保留旧接口：essay.js 里用它算本地统计塞进 AI prompt */
  words: function (s) { return String(s || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []; }
};
