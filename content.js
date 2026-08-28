window.SONATA_CONTENT = {
  title: "琴",
  subtitle: "遗失的和弦",
  keyClueGoal: 3,
  prologue: {
    term: "秋季学期 · 独立研究许可",
    sender: "音乐史系导师",
    subject: "关于你提交的“琴”音乐史研究申请",
    body: "你的研究申请已经通过。作为音乐史系学生，你可以从本学期起正式调查史料中关于“琴”的断层。\n\n现存记载彼此矛盾，先不要急于接受后世的结论。中央档案馆仍保留着战前馆藏目录，我已经为你申请了阅览许可。请从那里开始，并把找到的记录按时间整理。",
    signature: "导师办公室",
    firstLocation: "archive"
  },
  locations: {
    archive: {
      name: "中央档案馆",
      requiredKeyClues: 0,
      scenes: [
        { id: "archive-room", title: "封存目录室", artwork: "", placeholderTone: "archive", hotspots: [
          { id: "archive-ledger", x: 31, y: 39, size: 7, kind: "key", title: "被涂改的目录", text: "某一年的演出目录被反复涂改。纸张下面仍能辨认出一个与曲谱有关的旧编号。" },
          { id: "archive-letter", x: 67, y: 55, size: 6, kind: "optional", title: "没有寄出的便笺", text: "一张夹在书页中的私人便笺。它没有改变历史，却记录了当时某个人的迟疑。" }
        ] },
        { id: "archive-reading", title: "旧报刊阅览室", artwork: "", placeholderTone: "archive", hotspots: [
          { id: "archive-review", x: 59, y: 47, size: 6, kind: "optional", title: "一则旧评论", text: "评论者曾用“赐予”形容这首作品。这与后世的危险传闻并不一致。" }
        ] }
      ]
    },
    theatre: {
      name: "旧歌剧院",
      requiredKeyClues: 1,
      scenes: [
        { id: "theatre-backstage", title: "废弃的后台", artwork: "", placeholderTone: "theatre", hotspots: [
          { id: "theatre-program", x: 56, y: 34, size: 7, kind: "key", title: "战前演出单", text: "演出单证明，这份曲谱在战争前并不被视为灾厄。它曾经拥有完全不同的评价。" },
          { id: "theatre-score", x: 27, y: 68, size: 7, kind: "key", title: "烧焦的排练记录", text: "记录停在战争开始前夕。最后一行提到：曲谱的抄本将被转移至北部。" }
        ] }
      ]
    }
  },
  timelineModules: [
    { id: "origin", title: "第一节 · 乐声初现", intro: "整理曲谱被创作与首次流传的先后记录。", requiredKeyClues: 1, events: [
      { id: "origin-idea", title: "创作构想出现", text: "音乐繁盛的年代，有人开始构想这部特殊作品。", order: 1 },
      { id: "origin-score", title: "完整曲谱问世", text: "作品被完整记录，并留下早期演奏资料。", order: 2 },
      { id: "origin-known", title: "演奏开始流传", text: "正确演奏带来的奖赏，使它逐渐受到敬重。", order: 3 }
    ] },
    { id: "rupture", title: "第二节 · 战火断章", intro: "整理战争如何让记录与曲谱同时出现缺口。", requiredKeyClues: 2, events: [
      { id: "rupture-war", title: "战争全面扩大", text: "音乐活动停止，保存工作被迫中断。", order: 1 },
      { id: "rupture-move", title: "抄本匆忙转移", text: "仅存的记录提到曲谱将被运往北部。", order: 2 },
      { id: "rupture-lost", title: "部分乐章遗失", text: "战争结束后，人们再也没能找到完整记录。", order: 3 }
    ] },
    { id: "aftermath", title: "第三节 · 余音封存", intro: "整理残谱造成伤害后，社会认知发生变化的过程。", requiredKeyClues: 3, events: [
      { id: "aftermath-play", title: "残谱再次演奏", text: "缺失内容使后来的每一次演奏都无法正确完成。", order: 1 },
      { id: "aftermath-harm", title: "伤害不断发生", text: "奖赏的旧记录被遗忘，只剩下关于灾厄的传闻。", order: 2 },
      { id: "aftermath-seal", title: "曲谱最终封存", text: "人们把它视为纯粹危险之物，并停止公开研究。", order: 3 }
    ] }
  ],
  history: [
    { title: "乐声繁盛的年代", artwork: "", text: "占位正文：这里将放置根据第一阶段线索复原出的完整故事。正式内容可以在以后替换，不改变页面结构。" },
    { title: "记录断裂之时", artwork: "", text: "占位正文：战争造成的文明断层，使后世无法理解曲谱为何从奖赏变成灾厄。" },
    { title: "被封存的残谱", artwork: "", text: "占位正文：错误的演奏不断重复，关于它的社会认知最终发生了彻底偏移。" }
  ],
  dream: {
    initialForm: "black",
    whiteArtwork: "",
    blackArtwork: "",
    hotspots: {
      black: [{ id: "dream-black-gaze", x: 48, y: 40, title: "停驻的目光", text: "他的目光停在远处。一个微弱的光点，第一次在黑暗中回应。" }],
      white: [{ id: "dream-white-hand", x: 57, y: 58, title: "伸出的手", text: "光线中，他的手指似乎正指向一段尚未找到的记录。" }]
    },
    lightPoint: {
      black: { x: 84, y: 84 },
      white: { x: 84, y: 84 }
    },
    dialogueEnabled: false,
    dialogue: []
  },
  credits: {
    planning: ["在此填写姓名"],
    artists: ["在此填写姓名"],
    writers: ["在此填写姓名"],
    music: ["在此填写姓名"],
    thanks: ["在此填写姓名"]
  }
};
