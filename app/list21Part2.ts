import type { GleeMindMap, MindMapWord } from "./gleeMindMaps.ts";

function word(
  value: string,
  memory: string,
  synonyms: string,
  relatedWords: string,
  example: string,
): MindMapWord {
  return { word: value, memory, synonyms, relatedWords, example };
}

/**
 * List 21 Part 2 had not yet been entered from a closing slide.  This follows
 * the same word-specific, root/scene/contrast teaching style used for List 22,
 * while keeping every entry anchored to the 50-word course list.
 */
export const LIST_21_PART_2: GleeMindMap = {
  id: "21-2",
  list: 21,
  part: 2,
  branches: [
    {
      title: "安静、宁静",
      count: "2",
      kind: "meaning",
      words: [
        word("serene", "把 serene 和 serenity（宁静）一起记：水面没有波纹、人的神情也没有波澜，就是安静平和。", "tranquil；placid；calm", "serenity n. 宁静；serenely adv. 安详地", "a serene lake 宁静的湖面"),
        word("tranquil", "联想 tranquilizer（镇静剂）：被镇静后不再躁动，因此是平静、安宁的。", "serene；peaceful；placid", "tranquility n. 宁静；tranquilize v. 使镇静", "a tranquil village 宁静的村庄"),
      ],
      logicLinks: [{ from: "serene", to: "tranquil", label: "同义", detail: "都表示安静、宁静；serene 还常形容神情安详" }],
    },
    {
      title: "开创与新兴",
      count: "2",
      kind: "form",
      words: [
        word("seminal", "semin / semen = seed（种子）：能像种子一样生出后续研究或变革，就是开创性的。", "groundbreaking；pioneering；influential", "seminary n. 神学院；seminate / disseminate 含“散播”联想", "a seminal study 一项开创性研究"),
        word("emergent", "emerge = come out：刚刚浮出水面、开始形成，所以是新兴的。", "emerging；developing；nascent", "emerge v. 出现；emergence n. 出现", "an emergent industry 新兴产业"),
      ],
      logicLinks: [{ from: "seminal", to: "emergent", label: "场景联结", detail: "seminal 是开创源头，emergent 是随后刚刚出现" }],
    },
    {
      title: "可行、具体、理智",
      count: "3",
      kind: "meaning",
      words: [
        word("feasible", "和 feasibility study（可行性研究）一起记：经过评估，真的能做到。", "practicable；viable；workable", "feasibility n. 可行性；infeasible adj. 不可行的", "a feasible solution 可行的解决方案"),
        word("concrete", "水泥混凝土 concrete 是摸得到的；抽象想法变成可指出的证据，就是具体、确凿。", "specific；tangible；definite", "concretely adv. 具体地；反义：abstract", "concrete evidence 确凿的证据"),
        word("cerebral", "cerebrum = 大脑：靠大脑思考而不是凭情绪反应，就是理智的、理性的。", "intellectual；rational；analytical", "cerebrum n. 大脑；cerebral cortex 大脑皮层", "a cerebral approach 理性的方法"),
      ],
      logicLinks: [
        { from: "cerebral", to: "feasible", label: "场景联结", detail: "先理性评估，才能判断方案是否可行" },
        { from: "feasible", to: "concrete", label: "场景联结", detail: "可行的方案需要具体、确凿的证据" },
      ],
    },
    {
      title: "表达与感染力",
      count: "2",
      kind: "meaning",
      words: [
        word("eloquent", "loqu = speak：话说得清楚、有力量，因此是能言善辩、有口才的。", "articulate；persuasive；expressive", "eloquence n. 口才；loquacious adj. 话多的", "an eloquent speech 一场有感召力的演讲"),
        word("infectious", "infect = 传染：疾病能传染，笑声、热情也能“传染”给别人。", "contagious；catching；engaging", "infect v. 传染；infection n. 感染", "infectious enthusiasm 富有感染力的热情"),
      ],
      logicLinks: [{ from: "eloquent", to: "infectious", label: "场景联结", detail: "有口才的表达往往富有感染力" }],
    },
    {
      title: "克制与有利条件",
      count: "2",
      kind: "form",
      words: [
        word("abstemious", "用 abstain（戒除、克制）联想：对吃喝或享乐有节制，不过量。", "temperate；moderate；self-restrained", "abstemiously adv. 节制地；abstinence n. 节制、戒除", "an abstemious lifestyle 节制的生活方式"),
        word("conducive", "duc = lead：能把事情导向好结果，就是有利的；常用 conducive to。", "favorable；beneficial；helpful", "conduct v. 引导；conducive to 有利于", "conditions conducive to growth 有利于生长的条件"),
      ],
    },
    {
      title: "幽默与赞美",
      count: "2",
      kind: "form",
      words: [
        word("jocular", "joc = joke：开玩笑的语气就是诙谐、滑稽的。", "humorous；jovial；playful", "joke n./v. 玩笑；jocularity n. 诙谐", "a jocular tone 幽默诙谐的语气"),
        word("laudatory", "laud = praise：直接抓住“赞美”；表达赞美的文章或评论就是 laudatory。", "praising；complimentary；eulogistic", "laud v. 赞美；applaud v. 鼓掌、称赞", "a laudatory review 一篇赞美性的评论"),
      ],
    },
    {
      title: "独特、有特色",
      count: "2",
      kind: "meaning",
      words: [
        word("idiosyncratic", "idio = one's own：只属于一个人的习惯或风格，因此是独特甚至有点古怪的。", "peculiar；individual；distinctive", "idiosyncrasy n. 个人特质；idiolect n. 个人语体", "an idiosyncratic style 独特的风格"),
        word("distinctive", "distinct = 与别的分开：特征能让它和其他东西区分开，就是有特色的。", "characteristic；unique；idiosyncratic", "distinguish v. 区分；distinction n. 区别", "a distinctive voice 有特色的声音"),
      ],
      logicLinks: [{ from: "idiosyncratic", to: "distinctive", label: "同义", detail: "都可表示独特；idiosyncratic 更强调个人式、非典型" }],
    },
    {
      title: "先锋派",
      count: "1",
      kind: "form",
      words: [word("avant-garde", "法语原意是军队的“前卫”：走在艺术或思想最前面，就是先锋、前卫的。", "innovative；experimental；progressive", "avant-garde art 前卫艺术；反义：conventional", "avant-garde theater 先锋戏剧")],
    },
    {
      title: "挑剔与博学",
      count: "2",
      kind: "meaning",
      words: [
        word("fastidious", "想象一个人对每个细节都要反复检查：好的一面是注重细节，过度就是挑剔苛刻。", "meticulous；punctilious；fussy", "fastidious about 对…很挑剔；对照 meticulous", "fastidious attention to detail 对细节一丝不苟的关注"),
        word("erudite", "e = out，rud = rough / untrained：从未受教化的状态中走出来，变得学识渊博。", "learned；scholarly；knowledgeable", "erudition n. 博学；rude 可帮助联想 rud = untrained", "an erudite scholar 一位博学的学者"),
      ],
      logicLinks: [{ from: "fastidious", to: "erudite", label: "场景联结", detail: "对细节严谨、长期积累，可形成渊博的学识" }],
    },
    {
      title: "必需 VS 辅助",
      count: "1+1",
      kind: "contrast",
      words: [
        word("requisite", "requisite 和 require 一起记：被要求、不能缺少的，就是必需的。", "required；necessary；indispensable", "require v. 需要；requisition n. 征用、要求", "the requisite skills 必需的技能"),
        word("ancillary", "把 ancillary 想成“服务于主体”：它不是主体，而是辅助和补充。", "supplementary；subsidiary；auxiliary", "ancillary services 配套服务；对照 subordinate", "ancillary equipment 辅助设备"),
      ],
      contrastGroups: [
        { label: "必需的", tone: "blue", words: ["requisite"] },
        { label: "辅助的", tone: "pink", words: ["ancillary"] },
      ],
      logicLinks: [{ from: "requisite", to: "ancillary", label: "反义", detail: "requisite 是不可缺的，ancillary 是辅助、补充的" }],
    },
    {
      title: "-less：缺少某种品质",
      count: "2",
      kind: "root",
      words: [
        word("tactless", "tact = 分寸、圆滑，-less = without：说话做事没有分寸，就是不明智、不得体。", "indiscreet；insensitive；impolitic", "tact n. 圆滑；tactful adj. 得体的", "a tactless remark 一句不得体的话"),
        word("ruthless", "ruth = pity（怜悯），-less = without：没有怜悯，所以残忍无情。", "merciless；cruel；brutal", "ruth n. 怜悯；ruthlessly adv. 冷酷地", "a ruthless dictator 残忍的独裁者"),
      ],
      logicLinks: [{ from: "tactless", to: "ruthless", label: "词根联结", detail: "共用 -less = without，但一个缺分寸，一个缺怜悯" }],
    },
    {
      title: "衰败链条",
      count: "3",
      kind: "meaning",
      words: [
        word("moribund", "mori = die：已经接近死亡；不仅形容人，也常形容垂死的行业或制度。", "dying；declining；defunct", "mortal；mortality；morbid 都有死亡联想", "a moribund industry 濒临消亡的产业"),
        word("retrograde", "retro = backward，grad = step：向后走一步，就是倒退、退步。", "backward；regressive；reactionary", "retroactive 追溯的；progress = pro + gress（向前走）", "a retrograde policy 倒退的政策"),
        word("decadent", "decay 的场景：原本繁盛的东西开始腐坏、堕落，走向衰败。", "degenerate；corrupt；self-indulgent", "decadence n. 堕落、衰败；decay v./n. 腐坏", "a decadent lifestyle 腐化堕落的生活方式"),
      ],
      logicLinks: [
        { from: "retrograde", to: "decadent", label: "场景联结", detail: "先从进步走向倒退，再进入衰败腐化" },
        { from: "decadent", to: "moribund", label: "场景联结", detail: "衰败继续恶化，最后濒临消亡" },
      ],
    },
    {
      title: "粗略 VS 断续",
      count: "1+1",
      kind: "contrast",
      words: [
        word("sketchy", "sketch = 草图：只画轮廓没有细节，因此是粗略、不完整的。", "rough；incomplete；vague", "sketch n./v. 草图、勾勒；sketchily adv. 粗略地", "sketchy details 粗略的细节"),
        word("sporadic", "联想 spores（孢子）四散：出现得分散、不规律，因此是断断续续的。", "intermittent；irregular；occasional", "sporadically adv. 零星地；对照 continuous", "sporadic outbreaks 零星爆发"),
      ],
      contrastGroups: [
        { label: "信息不详", tone: "blue", words: ["sketchy"] },
        { label: "时间不连续", tone: "pink", words: ["sporadic"] },
      ],
    },
    {
      title: "耸人听闻",
      count: "1",
      kind: "form",
      words: [word("sensational", "sense / sensation = 感觉：刺激人的感官、制造强烈感觉，就会轰动或耸人听闻。", "shocking；startling；dramatic", "sensation n. 轰动；sensationalism n. 耸人听闻的做法", "a sensational headline 耸人听闻的标题")],
    },
    {
      title: "狡猾",
      count: "1",
      kind: "meaning",
      words: [word("cunning", "想象一个人不正面硬碰，而是精心设局：这种聪明带有欺骗色彩，就是狡猾。", "sly；wily；crafty", "回联 List 21 Part 1：devious tactics 狡诈的手段", "a cunning plan 狡猾的计划")],
    },
    {
      title: "教条、武断",
      count: "2",
      kind: "meaning",
      words: [
        word("doctrinaire", "doctrine = 教义：只按既定教义行事，不看现实情况，就是教条主义。", "dogmatic；inflexible；doctrinal", "doctrine n. 教义；doctrinal adj. 教义的", "a doctrinaire approach 教条主义的做法"),
        word("dogmatic", "dogma = 教条：把自己的看法当成不容质疑的真理，因此武断固执。", "doctrinaire；authoritarian；opinionated", "dogma n. 教条；dogmatically adv. 武断地", "a dogmatic assertion 一个武断的断言"),
      ],
      logicLinks: [{ from: "doctrinaire", to: "dogmatic", label: "同义", detail: "都表示教条、武断；doctrinaire 更强调理论不顾现实" }],
    },
    {
      title: "激烈 VS 严重",
      count: "1+1",
      kind: "contrast",
      words: [
        word("vehement", "想象情绪和语气都非常用力：不是普通反对，而是激烈、强烈地反对。", "forceful；passionate；fierce", "vehemence n. 激烈；vehemently adv. 强烈地", "vehement opposition 强烈反对"),
        word("dire", "把 dire 与严重后果固定搭配：事态到了可怕、紧急的程度。", "dreadful；grave；desperate", "dire need 极度缺乏；dire warning 严厉警告", "dire consequences 严重后果"),
      ],
      contrastGroups: [
        { label: "情绪、语气强烈", tone: "blue", words: ["vehement"] },
        { label: "局面、后果严重", tone: "pink", words: ["dire"] },
      ],
    },
  ],
};
