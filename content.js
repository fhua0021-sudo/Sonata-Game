window.SONATA_CONTENT = {
  schemaVersion: 4,
  title: "琴",
  subtitle: "仪式的和弦",
  keyClueGoal: 5,
  map: {
    artwork: "assets/weilan-mapgen4-187.webp",
    alt: "维兰帝国及东南神秘岛调查地图",
    shroudOpacity: 0.62,
    defaultRevealRadius: 18
  },
  prologue: {
    term: "秋季学期 · 独立研究项目审批",
    sender: "音乐史系研究项目指导办公室",
    subject: "关于“琴”相关音乐史研究申请的审批意见",
    body: "你提交的“琴”相关音乐史独立研究申请已完成审阅。经确认，该选题具备明确的史料研究价值，现同意列入本学期个人研究项目。\n\n本次调查应以现存文献、演出记录及战后整理档案为依据，并对资料来源、形成年代及相互矛盾之处分别记录。鉴于该课题所涉史料存在明显断层，在证据能够相互印证以前，请勿预先采用后世流传的结论。\n\n中央档案馆尚保存部分战前馆藏目录，阅览申请已代为提交。请以该馆作为首个调查地点；完成初步核对后，再依据所得线索扩展查阅范围。随函附上目前流传最广的“琴”之传说，供你作为首项待核说法。",
    signature: "音乐史系研究项目指导办公室",
    firstLocation: "archive"
  },
  legend: {
    eyebrow: "A LEGEND PASSED DOWN",
    title: "关于“琴”的传说",
    artwork: "",
    alt: "关于琴的传说形象",
    body: "传说中，“琴”并非为演奏而生。任何试图使它完整发声的人，都会以自身或旁人的毁灭作为代价。战后流传的故事将它描述为一部会主动诱使演奏者补全旋律、再把错误乐声化作惩罚的灾厄之谱。\n\n没有一份现存记录能够说明这则传说最初由谁写下，也没有人能够证明如今流传的曲谱仍与最初版本相同。它被反复抄录、删改与转述，最终成为关于“琴”最普遍、也最少受到质疑的说法。",
    note: "这只是流传下来的说法。你的调查将从核对它开始。",
    action: "记下传说，开始调查"
  },
  locations: {
    archive: {
      name: "中央档案馆",
      requiredKeyClues: 0,
      mapX: 63,
      mapY: 69,
      mapRevealRadius: 16,
      scenes: [
        { id: "archive-room", title: "封存目录室", artwork: "", placeholderTone: "archive", hotspots: [
          { id: "archive-ledger", x: 31, y: 39, size: 7, kind: "key", title: "被涂改的目录", text: "纸张下面仍能辨认出旧分类：它曾被列入典礼与赐礼演奏，并不属于灾厄或禁曲目录。", artwork: "", fullText: "占位完整正文：在这里详细描写目录的纸张、涂改痕迹、原始分类与主角的判断。调查簿中只显示上方的简短摘要；点击“阅读完整记录”后，玩家会在独立纸页中看到这段正文与配图。" },
          { id: "archive-letter", x: 67, y: 55, size: 6, kind: "optional", title: "没有寄出的便笺", text: "一张夹在书页中的私人便笺。它没有改变历史，却记录了当时某个人的迟疑。", artwork: "", fullText: "占位完整正文：可以在这里放入便笺的全文、发现过程，或与画稿相配的一段短篇故事。" }
        ] },
        { id: "archive-reading", title: "旧报刊阅览室", artwork: "", placeholderTone: "archive", hotspots: [
          { id: "archive-review", x: 59, y: 47, size: 6, kind: "optional", title: "一则旧评论", text: "评论者曾用“赐予”形容这首作品。这与后世的危险传闻并不一致。", artwork: "", fullText: "占位完整正文：在这里填写评论原文、报刊背景，以及主角从中整理出的疑点。" }
        ] }
      ]
    },
    theatre: {
      name: "旧歌剧院",
      requiredKeyClues: 1,
      mapX: 75,
      mapY: 58,
      mapRevealRadius: 15,
      scenes: [
        { id: "theatre-backstage", title: "废弃的后台", artwork: "", placeholderTone: "theatre", hotspots: [
          { id: "theatre-program", x: 56, y: 34, size: 7, kind: "key", title: "战前演出单", text: "演出单证明，这份曲谱在战争前并不被视为灾厄。它曾经拥有完全不同的评价。", artwork: "", fullText: "占位完整正文：在这里写出演出单上的节目、日期、演奏者，以及它为何能反驳后世传闻。" },
          { id: "theatre-score", x: 27, y: 68, size: 7, kind: "key", title: "烧焦的排练记录", text: "记录停在战争开始前夕。最后一行提到：曲谱的抄本将被转移至北部。", artwork: "", fullText: "占位完整正文：在这里详细呈现烧焦记录中仍可辨认的文字，以及抄本转移所留下的新疑问。" }
        ] }
      ]
    },
    cemetery: {
      name: "主战场墓地",
      requiredKeyClues: 3,
      mapX: 58,
      mapY: 45,
      mapRevealRadius: 17,
      scenes: [
        { id: "cemetery-edge", title: "河谷墓园", artwork: "", placeholderTone: "cemetery", hotspots: [
          { id: "cemetery-route", x: 43, y: 52, size: 7, kind: "key", title: "被改写的转移记录", text: "占位摘要：在此填写能够连接战争、曲谱转移与幸存者去向的关键记录。", artwork: "", fullText: "占位完整正文：在这里放入墓地线索的配图与完整故事。" },
          { id: "cemetery-name", x: 69, y: 36, size: 6, kind: "optional", title: "无名墓碑", text: "占位摘要：在此填写墓园中的补充发现。", artwork: "", fullText: "占位完整正文：这条补充记录不会阻碍主线，可用来承载人物片段。" }
        ] }
      ]
    },
    refuge: {
      name: "西南雪岭 · 废弃隐修院",
      requiredKeyClues: 4,
      mapX: 49,
      mapY: 77,
      mapRevealRadius: 15,
      scenes: [
        { id: "refuge-ruins", title: "雪线上的隐修院", artwork: "", placeholderTone: "refuge", hotspots: [
          { id: "refuge-cache", x: 55, y: 43, size: 7, kind: "key", title: "藏在墙后的残存记录", text: "占位摘要：在此填写疑似携带曲谱者最终留下的证据。", artwork: "", fullText: "占位完整正文：在这里放入逃亡路线、藏匿过程或曲谱残页相关的完整内容。" },
          { id: "refuge-room", x: 29, y: 64, size: 6, kind: "optional", title: "被使用过的房间", text: "占位摘要：这里曾有人在风雪中短暂停留。", artwork: "", fullText: "占位完整正文：可用于人物生活痕迹或画稿片段。" }
        ] }
      ]
    }
  },
  rumorModules: [
    { id: "origin", title: "第一则 · 生来为灾", rumor: "“琴”从诞生起便是一部只会伤害演奏者的禁曲。", correction: "早期档案并未把它归入灾厄记录；后世认知很可能遮蔽了它原本的用途。", requiredKeyClues: 1, evidenceIds: ["archive-ledger"] },
    { id: "reputation", title: "第二则 · 从未受敬", rumor: "战争以前，人们同样畏惧这份曲谱，并禁止公开演奏。", correction: "战前演出资料证明，它曾被公开演奏并得到完全不同的评价。", requiredKeyClues: 2, evidenceIds: ["theatre-program"] },
    { id: "rupture", title: "第三则 · 乐谱未变", rumor: "后世演奏的版本与最初曲谱完全相同，灾难足以证明它的本质。", correction: "战争中的转移、墓地记录与雪岭遗留物共同表明，后世接触到的很可能只是缺失部分乐章的残谱。", requiredKeyClues: 5, evidenceIds: ["theatre-score", "cemetery-route", "refuge-cache"] }
  ],
  comics: {
    title: "图像残页",
    pages: [
      { id: "comic-1", title: "残页一", artwork: "", caption: "占位说明：第一次更正传言后复原。", unlock: { type: "rumor", id: "origin" } },
      { id: "comic-2", title: "残页二", artwork: "", caption: "占位说明：完成旧歌剧院调查后复原。", unlock: { type: "location", id: "theatre" } },
      { id: "comic-3", title: "残页三", artwork: "", caption: "占位说明：取得第一条梦境线索后复原。", unlock: { type: "dream", id: "dream-black-gaze" } },
      { id: "comic-4", title: "残页四", artwork: "", caption: "占位说明：完成主战场墓地调查后复原。", unlock: { type: "location", id: "cemetery" } },
      { id: "comic-5", title: "残页五", artwork: "", caption: "占位说明：最后一则传言完成勘误后复原。", unlock: { type: "rumor", id: "rupture" } }
    ]
  },
  history: [
    { title: "乐声繁盛的年代", artwork: "", text: "占位正文：这里将放置根据第一阶段线索复原出的完整故事。正式内容可以在以后替换，不改变页面结构。" },
    { title: "记录断裂之时", artwork: "", text: "占位正文：战争造成的文明断层，使后世无法理解曲谱为何从奖赏变成灾厄。" },
    { title: "被封存的残谱", artwork: "", text: "占位正文：错误的演奏不断重复，关于它的社会认知最终发生了彻底偏移。" }
  ],
  dream: {
    initialForm: "black",
    unlockAtKeyClues: 2,
    secondFormRequiredKeyClues: 4,
    whiteArtwork: "",
    blackArtwork: "",
    hotspots: {
      black: [{ id: "dream-black-gaze", x: 48, y: 40, requiredKeyClues: 2, title: "停驻的目光", text: "他的目光停在远处。一个微弱的光点，第一次在黑暗中回应。" }],
      white: [{ id: "dream-white-hand", x: 57, y: 58, requiredKeyClues: 3, title: "伸出的手", text: "光线中，他的手指似乎正指向一段尚未找到的记录。" }]
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
