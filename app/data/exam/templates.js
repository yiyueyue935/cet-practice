/* 四六级作文模板库（10 类）
   依据 wordtest/英语四六级作文万能模板-新版.docx 的框架重写，
   修正 OCR 错字、补齐缺失类别；[方括号] 为按题目替换的占位符。 */
window.CET_TEMPLATES = [
  {
    name: '1. 观点论述类（议论文）',
    usage: '对某一现象或观点发表看法，如「大学生该不该熬夜」「AI 对学习的影响」',
    items: [
      {
        label: '开头 · 引入 + 表态',
        text: 'Nowadays, the phenomenon of [主题词] has aroused wide public concern. People hold different opinions on it. As far as I am concerned, I firmly believe that [你的观点].',
        cn: '如今，[主题词]这一现象已引起广泛关注，人们对此看法不一。就我而言，我坚信[你的观点]。'
      },
      {
        label: '中间 · 两个理由',
        text: 'There are several reasons to support my view. First and foremost, [理由 1]. In addition, [理由 2]. For example, [具体例子], which can effectively prove this point.',
        cn: '有几个理由可以支持我的观点。首先，[理由 1]；其次，[理由 2]。例如，[具体例子]可以有效证明这一点。'
      },
      {
        label: '结尾 · 总结 + 升华',
        text: 'In conclusion, [重申观点]. Only in this way can we [积极影响 / 未来展望].',
        cn: '总之，[重申观点]。只有这样，我们才能[积极影响 / 未来展望]。'
      }
    ],
    sentences: [
      { en: 'It is universally acknowledged that...', cn: '众所周知……' },
      { en: 'There is no doubt that...', cn: '毫无疑问……' },
      { en: 'Not only can this benefit..., but it also can...', cn: '这不仅能……，还能……' }
    ]
  },
  {
    name: '2. 现象分析类',
    usage: '分析某一社会现象的原因与影响，如「低头族」「考公热」',
    items: [
      {
        label: '开头 · 描述现象',
        text: 'In recent years, [现象] has become increasingly common in our daily life. This phenomenon has aroused widespread concern among the public.',
        cn: '近年来，[现象]在日常生活中越来越普遍，这一现象已引起公众的广泛关注。'
      },
      {
        label: '中间 · 原因 + 影响',
        text: 'Several factors contribute to this phenomenon. To begin with, [原因 1]. What is more, [原因 2]. As a result, [带来的影响].',
        cn: '造成这一现象的因素有几个。首先，[原因 1]；此外，[原因 2]。因此，[带来的影响]。'
      },
      {
        label: '结尾 · 态度 + 建议',
        text: 'In my opinion, we should take a rational attitude towards [现象]. Only by doing so can we [建议 / 目标].',
        cn: '在我看来，我们应该理性看待[现象]。只有这样，我们才能[建议 / 目标]。'
      }
    ],
    sentences: [
      { en: 'This phenomenon is not an accident, but a result of social development.', cn: '这一现象并非偶然，而是社会发展的结果。' },
      { en: 'It has both positive and negative effects on our life.', cn: '它对我们的生活既有积极影响，也有消极影响。' },
      { en: 'It is high time that we took effective measures to...', cn: '是时候采取有效措施去……了。' }
    ]
  },
  {
    name: '3. 图画作文类（看图写作）',
    usage: '根据漫画或图片写作，如「低头族」「环保主题」',
    items: [
      {
        label: '开头 · 描述图画 + 点明寓意',
        text: 'As is vividly depicted in the picture, [描述图画内容]. Simple as the picture is, it conveys a profound meaning: [图画寓意].',
        cn: '如图所示，[描述图画内容]。这幅画虽然简单，却蕴含着深刻的含义：[图画寓意]。'
      },
      {
        label: '中间 · 联系现实 + 论证',
        text: 'This phenomenon is very common in our daily life. Why does it happen? The main reason is that [原因]. Moreover, [深层原因 / 影响]. For instance, [例子].',
        cn: '这种现象在日常生活中非常普遍。为什么会发生？主要原因是[原因]。此外，[深层原因 / 影响]。例如，[例子]。'
      },
      {
        label: '结尾 · 建议 + 升华',
        text: 'Therefore, it is high time that we [采取措施]. Only through joint efforts can we [实现目标].',
        cn: '因此，我们早就应该[采取措施]。只有通过共同努力，我们才能[实现目标]。'
      }
    ],
    sentences: [
      { en: 'The picture reminds us of a serious problem worth paying attention to.', cn: '这幅图提醒我们关注一个值得重视的严重问题。' },
      { en: 'What the picture conveys goes far beyond a simple image.', cn: '这幅图传达的远不止一个简单的画面。' },
      { en: 'It is a mirror of our real life.', cn: '它是我们现实生活的一面镜子。' }
    ]
  },
  {
    name: '4. 书信类（应用文）',
    usage: '建议信、投诉信、邀请信、感谢信等，以建议信为例',
    items: [
      {
        label: '开头 · 表明目的',
        text: 'Dear [称呼], I am writing to express my suggestions on [主题] in the hope that it can help improve [相关事物].',
        cn: '亲爱的[称呼]：我写信是为了就[主题]提出建议，希望能有助于改进[相关事物]。'
      },
      {
        label: '中间 · 建议 + 理由',
        text: 'Firstly, I suggest that [建议 1]. The reason is that [理由 1]. Secondly, it is advisable to [建议 2]. In this way, [积极效果].',
        cn: '首先，我建议[建议 1]，理由是[理由 1]。其次，建议[建议 2]，这样一来，[积极效果]。'
      },
      {
        label: '结尾 · 感谢 + 期待',
        text: 'Thank you for your time and consideration. I am looking forward to your reply.',
        cn: '感谢您抽出时间阅读并考虑。期待您的回复。'
      }
    ],
    sentences: [
      { en: 'I would appreciate it if you could take my suggestions into consideration.', cn: '如果您能考虑我的建议，我将不胜感激。' },
      { en: 'Please feel free to contact me if you need further information.', cn: '如需更多信息，请随时与我联系。' },
      { en: 'I am writing to complain about...', cn: '我写信是为了投诉……' }
    ]
  },
  {
    name: '5. 谚语 / 名言类',
    usage: '给出谚语或名言，要求谈理解，如「Practice makes perfect」',
    items: [
      {
        label: '开头 · 引出谚语',
        text: 'There is an old saying that "[谚语]". Simple as the saying is, it carries a profound truth: [含义].',
        cn: '有句老话说：「[谚语]」。这句话虽然简单，却蕴含着深刻的道理：[含义]。'
      },
      {
        label: '中间 · 举例论证',
        text: 'This saying can be well illustrated by [例子 / 经历]. [展开说明]. It reminds us that [道理].',
        cn: '这句话可以用[例子 / 经历]来很好地说明。[展开说明]。它提醒我们[道理]。'
      },
      {
        label: '结尾 · 总结 + 践行',
        text: 'Therefore, we should keep this saying in mind and put it into practice. Only by doing so can we [结果].',
        cn: '因此，我们应该把这句谚语铭记于心并付诸实践。只有这样，我们才能[结果]。'
      }
    ],
    sentences: [
      { en: 'Just as the saying goes, "..."', cn: '正如谚语所说……' },
      { en: 'This saying reminds us that...', cn: '这句谚语提醒我们……' },
      { en: 'Actions speak louder than words.', cn: '行动胜于言辞。' }
    ]
  },
  {
    name: '6. 问题解决类',
    usage: '提出某一问题并给出解决方案，如「大学生就业难」「校园浪费」',
    items: [
      {
        label: '开头 · 提出问题',
        text: 'Nowadays, the problem of [主题] has become increasingly serious. More and more [相关人群] are suffering from it, which has aroused wide concern.',
        cn: '如今，[主题]问题日益严重，越来越多的[相关人群]受其困扰，这已引起广泛关注。'
      },
      {
        label: '中间 · 原因 + 措施',
        text: 'Why does this problem exist? The main reasons are as follows. Firstly, [原因 1]. Secondly, [原因 2]. To solve it, we should take the following measures. On the one hand, [措施 1]. On the other hand, [措施 2].',
        cn: '为什么会出现这个问题？主要原因如下：第一，[原因 1]；第二，[原因 2]。为解决它，我们应采取措施：一方面，[措施 1]；另一方面，[措施 2]。'
      },
      {
        label: '结尾 · 展望 + 呼吁',
        text: 'With joint efforts, I believe this problem will be solved effectively in the near future. Let us take action from now on.',
        cn: '通过共同努力，我相信这个问题在不久的将来会得到有效解决。让我们从现在开始行动。'
      }
    ],
    sentences: [
      { en: 'It is high time that we took measures to cope with...', cn: '是时候采取措施应对……了。' },
      { en: 'Only by combined efforts can we...', cn: '只有共同努力，我们才能……' },
      { en: 'Every small step counts.', cn: '每一小步都很重要。' }
    ]
  },
  {
    name: '7. 对比选择类',
    usage: '对比两种事物或观点，如「线上学习 vs 线下学习」「手机的利与弊」',
    items: [
      {
        label: '开头 · 引出对比',
        text: 'When it comes to [A] and [B], people hold different views. Some people believe that [观点 A], while others argue that [观点 B].',
        cn: '谈到[A]和[B]时，人们看法不同。有些人认为[观点 A]，而另一些人主张[观点 B]。'
      },
      {
        label: '中间 · 对比分析',
        text: 'There are obvious differences between them. Firstly, A [特点 1], whereas B [特点 2]. Secondly, A is [优势 1], but B has its own advantage in [优势 2]. For example, [例子].',
        cn: '两者之间存在明显差异。首先，A[特点 1]，而 B[特点 2]；其次，A 具有[优势 1]，但 B 在[优势 2]方面也有自己的长处。例如，[例子]。'
      },
      {
        label: '结尾 · 我的选择',
        text: 'As far as I am concerned, [我的选择]. What matters is not which one we choose, but how we make use of it.',
        cn: '就我而言，[我的选择]。重要的不是选哪一个，而是我们如何使用它。'
      }
    ],
    sentences: [
      { en: 'Each coin has two sides.', cn: '凡事都有两面性。' },
      { en: 'Compared with B, A has its own advantages.', cn: '与 B 相比，A 有自己的优势。' },
      { en: 'The choice depends on personal preference.', cn: '选择取决于个人偏好。' }
    ]
  },
  {
    name: '8. 科技利弊类',
    usage: '讨论科技产品的影响，如「人工智能」「智能手机」「短视频」',
    items: [
      {
        label: '开头 · 引出科技',
        text: 'With the rapid development of technology, [科技] has been deeply integrated into our daily life. It brings convenience as well as problems.',
        cn: '随着科技的快速发展，[科技]已深度融入我们的日常生活，它带来便利的同时也带来问题。'
      },
      {
        label: '中间 · 利与弊',
        text: 'On the one hand, [好处]. On the other hand, [坏处]. For instance, [例子].',
        cn: '一方面，[好处]；另一方面，[坏处]。例如，[例子]。'
      },
      {
        label: '结尾 · 理性看待',
        text: 'In a word, technology is a double-edged sword. We should make good use of it and avoid its negative effects.',
        cn: '总之，科技是一把双刃剑。我们应该善用它，避免其负面影响。'
      }
    ],
    sentences: [
      { en: 'Technology is a double-edged sword.', cn: '科技是一把双刃剑。' },
      { en: 'We should take a rational attitude towards...', cn: '我们应该对……持理性态度。' },
      { en: 'It has changed the way we live and study.', cn: '它改变了我们生活和学习的方式。' }
    ]
  },
  {
    name: '9. 文化传承类',
    usage: '传统文化、非遗保护、文化交流，如「中国传统节日」「非遗文化」',
    items: [
      {
        label: '开头 · 引出文化话题',
        text: 'With the development of society, traditional culture is facing new challenges. As a result, more and more people begin to pay attention to the protection of [主题].',
        cn: '随着社会发展，传统文化正面临新的挑战。因此，越来越多的人开始关注[主题]的保护。'
      },
      {
        label: '中间 · 重要性 + 措施',
        text: 'It is of great importance to protect traditional culture. On the one hand, it is the root of our nation. On the other hand, it can enrich our daily life and strengthen our cultural confidence. To protect it, we should [措施].',
        cn: '保护传统文化至关重要。一方面，它是我们民族的根脉；另一方面，它能丰富我们的日常生活、增强文化自信。为保护它，我们应该[措施]。'
      },
      {
        label: '结尾 · 升华',
        text: 'Only by inheriting and developing traditional culture can we keep our cultural identity in a globalized world.',
        cn: '只有传承和发展传统文化，我们才能在全球化时代保持文化身份。'
      }
    ],
    sentences: [
      { en: 'Traditional culture is the root of a nation.', cn: '传统文化是一个民族的根。' },
      { en: 'It is our responsibility to pass it down.', cn: '传承它是我们的责任。' },
      { en: 'Cultural confidence makes us stronger.', cn: '文化自信让我们更强大。' }
    ]
  },
  {
    name: '10. 个人成长类',
    usage: '个人品质、成长感悟、梦想，如「坚持的重要性」「诚信」「青春奋斗」',
    items: [
      {
        label: '开头 · 引出品质',
        text: 'Everyone grows up in the process of life. Among all the qualities that contribute to personal growth, [品质] is particularly important.',
        cn: '每个人都在人生过程中成长。在促进个人成长的所有品质中，[品质]尤为重要。'
      },
      {
        label: '中间 · 重要性 + 例子',
        text: 'Why is [品质] so important? Firstly, it can help us overcome difficulties. When we are in trouble, [品质] gives us courage to move forward. Secondly, it can make us better people. For example, [例子].',
        cn: '为什么[品质]如此重要？首先，它能帮助我们克服困难，身处困境时给我们前进的勇气；其次，它能让我们成为更好的人。例如，[例子]。'
      },
      {
        label: '结尾 · 总结 + 践行',
        text: 'In conclusion, [品质] plays a vital role in our growth. Let us cultivate this quality from now on, and our future will be brighter.',
        cn: '总之，[品质]在我们的成长中起着至关重要的作用。让我们从现在开始培养这一品质，未来会更光明。'
      }
    ],
    sentences: [
      { en: 'Personal growth is closely related to...', cn: '个人成长与……密切相关。' },
      { en: 'It is never too late to develop this quality.', cn: '培养这种品质永远不嫌晚。' },
      { en: 'Where there is a will, there is a way.', cn: '有志者，事竟成。' }
    ]
  }
];
