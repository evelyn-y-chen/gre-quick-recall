import glee1500Data from "./glee1500.json" with { type: "json" };
import type { GleeMindMap, MindMapWord } from "./gleeMindMaps.ts";

const gleeWords = new Set(glee1500Data.map((entry) => entry.word.toLocaleLowerCase()));

function prioritizedSynonyms(word: string, synonyms: string) {
  const candidates = synonyms.split("；").map((candidate) => candidate.trim()).filter(Boolean);
  const self = word.toLocaleLowerCase();
  return candidates.sort((left, right) => {
    const leftInternal = gleeWords.has(left.replace(/^[a-z]+\.\s*/i, "").toLocaleLowerCase()) && left.toLocaleLowerCase() !== self;
    const rightInternal = gleeWords.has(right.replace(/^[a-z]+\.\s*/i, "").toLocaleLowerCase()) && right.toLocaleLowerCase() !== self;
    return Number(rightInternal) - Number(leftInternal);
  }).join("；");
}

const study = (
  word: string,
  memory: string,
  synonyms: string,
  relatedWords: string,
  example: string,
): MindMapWord => ({ word, memory, synonyms: prioritizedSynonyms(word, synonyms), relatedWords, example });

/**
 * List 22 has not yet been covered by the published course. These two maps are
 * an explicitly labelled, teacher-style synthesis based only on the 50 words
 * in the learner's Glee 1500 list. They are not presented as teacher quotes.
 */
export const LIST_22_MIND_MAPS: GleeMindMap[] = [
  {
    id: "22-1",
    list: 22,
    part: 1,
    branches: [
      {
        title: "难闻、令人厌恶",
        count: "1",
        kind: "meaning",
        words: [study("noisome", "noisome 和 noise 无关；历史上和 annoy 的‘伤害、招人厌’相近 → 有害或令人极不愉快，常指恶臭。", "foul；offensive；noxious", "noisome odor 恶臭；注意 noisy 才是‘吵闹的’", "a noisome smell 一股令人作呕的恶臭")],
        note: "仿 Glee 讲解：用 noisome ≠ noisy 做形近辨析，再抓住‘令人厌恶、常指恶臭’这个核心义。",
      },
      {
        title: "反抗、不服管",
        count: "2",
        kind: "meaning",
        words: [
          study("defiant", "由 defy（违抗）联想：别人要求服从，态度却是“我偏不” → 公然反抗、挑衅。", "rebellious；resistant", "defy v. 违抗；defiance n. 反抗", "a defiant refusal 公然抗拒的拒绝"),
          study("recalcitrant", "re = back，calcitr = kick：像不肯受控的马向后踢 → 顽固不服管、难以处理。", "stubborn；intractable", "recalcitrance n. 顽抗；联想 heel“脚后跟”", "a recalcitrant student 难以管教的学生"),
        ],
        note: "仿 Glee 讲解：defiant 偏当下表现出的反抗态度；recalcitrant 偏长期顽固、拒绝管理。",
        logicLinks: [{ from: "defiant", to: "recalcitrant", label: "同义", detail: "都表示不服从；recalcitrant 的顽固和难管程度更强" }],
      },
      {
        title: "反传统与蔑视规则",
        count: "2",
        kind: "meaning",
        words: [
          study("iconoclast", "icon = 偶像、图像，clast = breaker：打碎偶像的人 → 挑战传统观念的人。", "nonconformist；dissenter", "iconoclastic adj. 反传统的；iconoclasm n. 反传统", "an intellectual iconoclast 思想上的反传统者"),
          study("flout", "把规则放在眼前却故意不理，强调公开、带着蔑视地违反；不要和 flaunt“炫耀”混淆。", "defy；disregard", "flout the law 无视法律；flaunt wealth 炫耀财富", "openly flout the rules 公然无视规则"),
        ],
        note: "iconoclast 是挑战传统的“人”；flout 是公然无视传统或规则的“动作”。",
        logicLinks: [{ from: "iconoclast", to: "flout", label: "场景联结", detail: "反传统者往往会公开挑战或无视既有规范" }],
      },
      {
        title: "敏锐精明",
        count: "1",
        kind: "meaning",
        words: [study("acumen", "acu = sharp：头脑像尖刃一样迅速切中要害 → 精明、敏锐。", "insight；shrewdness；discernment", "acute adj. 敏锐的；acuity n. 敏锐", "business acumen 商业敏锐度")],
      },
      {
        title: "权宜之计",
        count: "1",
        kind: "meaning",
        words: [study("expediency", "先问“现在能不能解决问题”，不一定问“长期是否正确” → 为求方便采取的权宜之计。", "practicality；convenience", "expedient adj./n. 权宜的；权宜之计", "a measure adopted for political expediency 出于政治权宜采取的措施")],
      },
      {
        title: "疲劳",
        count: "1",
        kind: "meaning",
        words: [study("fatigue", "身体或精神被反复消耗，能量见底 → 疲劳、倦怠。", "exhaustion；weariness", "fatigued adj. 疲惫的；mental fatigue 精神疲劳", "suffer from extreme fatigue 极度疲劳")],
      },
      {
        title: "惩罚",
        count: "1",
        kind: "meaning",
        words: [study("penalty", "违反规则后要付出的代价 → 惩罚、处罚，也可指比赛中的罚分。", "punishment；sanction", "penal adj. 刑罚的；penalize v. 惩罚", "a severe penalty for fraud 对欺诈的严厉处罚")],
      },
      {
        title: "laps = slip / fall",
        count: "2",
        kind: "root",
        words: [
          study("lapse", "laps = slip / fall：思想或注意力滑了一下 → 一时疏忽、小错误。", "slip；oversight", "a lapse in judgment 判断失误；relapse 再次滑回、复发", "a brief lapse of concentration 短暂走神"),
          study("collapse", "col = together + lapse = fall：整体一起倒下 → 崩塌；制度或计划则是瓦解、崩溃。", "crumble；fail", "collapsed adj. 倒塌的；lapse n. 疏忽", "the negotiations collapsed 谈判破裂了"),
        ],
        logicLinks: [{ from: "lapse", to: "collapse", label: "词根联结", detail: "共同含 laps = slip / fall；一个是滑一下，一个是整体倒下" }],
      },
      {
        title: "增加、加强",
        count: "2",
        kind: "meaning",
        words: [
          study("amplify", "ampl = large：把声音、信号或影响变大 → 放大、增强。", "magnify；intensify", "amplifier n. 扩音器；amplitude n. 振幅", "amplify the signal 放大信号"),
          study("augment", "aug = increase：在原有基础上再加一些 → 增加、扩大。", "increase；expand；enhance", "augmentation n. 增加、扩大", "augment the existing resources 增加现有资源"),
        ],
        logicLinks: [{ from: "amplify", to: "augment", label: "同义", detail: "都表示增加；amplify 常放大强度，augment 常增加数量或规模" }],
      },
      {
        title: "加速与激发行动",
        count: "2",
        kind: "meaning",
        words: [
          study("accelerate", "celer = swift：让速度变快，也可让发展或变化更快发生。", "speed up；hasten", "acceleration n. 加速；decelerate v. 减速", "accelerate economic growth 加速经济增长"),
          study("galvanize", "联想 Galvani 的电刺激：像通电一样把人猛然激活 → 刺激、促使采取行动。", "spur；mobilize；rouse", "galvanize somebody into action 激励某人行动", "galvanize the public into action 激起公众行动"),
        ],
        note: "accelerate 让过程更快；galvanize 像通电一样把人激发起来。",
        logicLinks: [{ from: "accelerate", to: "galvanize", label: "场景联结", detail: "一个推动过程提速，一个推动人立即行动" }],
      },
      {
        title: "珍爱",
        count: "1",
        kind: "meaning",
        words: [study("cherish", "把人或回忆放在心里小心保存 → 珍爱、珍视。", "treasure；value", "cherished adj. 珍爱的；cherish a hope 心怀希望", "cherish the memory 珍藏这段回忆")],
      },
      {
        title: "吸引与兴奋",
        count: "2",
        kind: "meaning",
        words: [
          study("captivate", "capt = take：注意力被“抓走” → 使着迷、吸引。", "fascinate；enchant", "captive n. 俘虏；capture v. 捕获", "captivate the audience 吸引观众"),
          study("exhilarate", "hilar = cheerful：把人的愉悦感调动出来 → 使兴奋、使振奋。", "excite；elate；enliven", "exhilarating adj. 令人振奋的；exhilaration n. 兴奋", "The victory exhilarated the team. 胜利令全队振奋。"),
        ],
        note: "captivate 先把注意力抓住；exhilarate 再强调产生兴奋、振奋的情绪。",
        logicLinks: [{ from: "captivate", to: "exhilarate", label: "场景联结", detail: "被吸引后可能产生兴奋感，但二者并非严格同义" }],
      },
      {
        title: "抵消、弥补",
        count: "2",
        kind: "meaning",
        words: [
          study("offset", "把一项放到另一项的对面，使两边重新平衡 → 抵消、弥补。", "counterbalance；compensate", "offsetting adj. 抵消的；offset A against B", "The gains offset the losses. 收益抵消了损失。"),
          study("compensate", "com = together，pens = weigh：把两边重新称平 → 补偿；也可弥补不足。", "offset；reimburse；make up for", "compensation n. 补偿；compensate for 弥补", "compensate for the lack of experience 弥补经验不足"),
        ],
        logicLinks: [{ from: "offset", to: "compensate", label: "同义", detail: "都能表示抵消、弥补；compensate 还常指给人赔偿" }],
      },
      {
        title: "否认、排除",
        count: "3",
        kind: "meaning",
        words: [
          study("dismiss", "dis = away，miss = send：把观点从考虑范围里送走 → 不予考虑、无视；也可解雇。", "disregard；reject", "dismissal n. 解雇、驳回；dismiss a concern 不理会担忧", "dismiss the claim as irrelevant 认为该说法无关而不予考虑"),
          study("gainsay", "gain- 在这里联想 against，say = 说：说反对的话 → 否认、反驳。", "deny；contradict", "常用于 cannot gainsay：无法否认", "No one can gainsay the evidence. 没有人能否认这项证据。"),
          study("obviate", "ob = against，via = way：把挡路的问题提前移开 → 排除、避免，使某事不再必要。", "avert；preclude；eliminate", "obviate the need for 使……不再必要；obviation n. 排除", "This change obviates the need for further testing. 这项改变免去了进一步测试的必要。"),
        ],
        note: "dismiss 是不把它纳入考虑；gainsay 是开口否认；obviate 是提前排除问题或需要。",
        logicLinks: [
          { from: "dismiss", to: "gainsay", label: "场景联结", detail: "从不予考虑到直接出言否认" },
          { from: "gainsay", to: "obviate", label: "场景联结", detail: "obviate 不是口头否认，而是把问题或需要真正排除" },
        ],
      },
      {
        title: "哀叹、惋惜",
        count: "2",
        kind: "meaning",
        words: [
          study("bemoan", "be + moan：围绕一件事不断叹息、抱怨 → 哀叹。", "lament；bewail", "bemoan the loss 哀叹损失", "bemoan the decline of public trust 哀叹公众信任的下降"),
          study("lament", "面对损失或令人遗憾的变化而悲伤、惋惜；可作动词，也可作名词。", "bemoan；mourn", "lamentation n. 哀叹；lamentable adj. 令人惋惜的", "lament the disappearance of the tradition 为传统消失而惋惜"),
        ],
        logicLinks: [{ from: "bemoan", to: "lament", label: "同义", detail: "都表示哀叹；bemoan 有时更带反复抱怨的语气" }],
      },
    ],
  },
  {
    id: "22-2",
    list: 22,
    part: 2,
    branches: [
      {
        title: "困扰、纠缠",
        count: "2",
        kind: "meaning",
        words: [
          study("plague", "plague 原指瘟疫：像疾病一样长期缠着不放 → 困扰、折磨。", "afflict；torment；trouble", "be plagued by 被……困扰；plague n. 瘟疫", "be plagued by self-doubt 饱受自我怀疑困扰"),
          study("badger", "badger 是獾；联想不断追着对方、反复逼问 → 纠缠、烦扰。", "pester；harass", "badger somebody into doing 纠缠某人迫使其做某事", "reporters badgered him with questions 记者不断追问他"),
        ],
        note: "仿 Glee 讲解：plague 像长期疾病一样困扰；badger 强调人不断追问、纠缠。",
        logicLinks: [{ from: "plague", to: "badger", label: "同义", detail: "都表示持续烦扰；badger 更常是人主动反复纠缠" }],
      },
      {
        title: "压制、窒息",
        count: "3",
        kind: "meaning",
        words: [
          study("suppress", "sup = under，press = 压：向下压住，不让反对、信息或情绪出现 → 压制。", "repress；quell", "suppression n. 压制；suppress dissent 压制异议", "suppress the evidence 隐瞒证据"),
          study("suffocate", "首先是空气被堵住而窒息；抽象地也可表示环境压抑得让人喘不过气。", "choke；smother", "suffocation n. 窒息；suffocating adj. 令人窒息的", "suffocate in the smoke 在烟雾中窒息"),
          study("stifle", "把呼吸、声音、笑或想法压回去 → 使窒息，也表示压制、抑制。", "suppress；smother；restrain", "stifle a yawn 忍住哈欠；stifling adj. 闷热压抑的", "stifle creativity 扼杀创造力"),
        ],
        logicLinks: [
          { from: "suppress", to: "stifle", label: "同义", detail: "都表示压制；stifle 保留了“堵住呼吸”的画面" },
          { from: "stifle", to: "suffocate", label: "场景联结", detail: "从抽象压制连回生理上的窒息" },
        ],
      },
      {
        title: "厌恶与怨恨",
        count: "2",
        kind: "meaning",
        words: [
          study("abhor", "ab = away，hor = shudder：厌恶到想躲开、浑身发抖 → 痛恨、憎恶。", "detest；loathe", "abhorrent adj. 令人憎恶的；horror n. 恐惧、厌恶", "abhor cruelty 痛恨残忍行为"),
          study("resent", "觉得自己受到不公平对待，心里留下不满 → 怨恨、愤恨。", "begrudge；take offense at", "resentment n. 怨恨；resent being told… 反感被告知……", "resent outside interference 怨恨外部干涉"),
        ],
        note: "abhor 是对事物本身强烈厌恶；resent 常因“我受到冒犯或不公”而怨恨。",
        logicLinks: [{ from: "abhor", to: "resent", label: "场景联结", detail: "一个是强烈憎恶，一个是受到冒犯后的怨恨" }],
      },
      {
        title: "强加 VS 屈服、让步",
        count: "1+2",
        kind: "contrast",
        words: [
          study("impose", "im = upon，pose = put：把要求或负担放到别人身上 → 强加。", "force；levy", "imposition n. 强加、负担；impose A on B", "impose strict limits on spending 对开支施加严格限制"),
          study("succumb", "sub = under，cumb = lie：倒在压力下面 → 屈服；也可指死于疾病。", "yield；submit", "succumb to pressure 屈服于压力；succumb to illness 病逝", "succumb to temptation 屈服于诱惑"),
          study("concede", "con + cede = go / yield：向对方让出一步 → 让步；也可不情愿地承认。", "yield；admit", "concession n. 让步；concede defeat 认输", "concede that the plan had failed 承认计划已经失败"),
        ],
        note: "impose 是把压力施加给别人；succumb 是在压力下屈服；concede 是退让一步或承认对方观点。",
        contrastGroups: [
          { label: "施加", tone: "blue", words: ["impose"] },
          { label: "屈服 / 让步", tone: "pink", words: ["succumb", "concede"] },
        ],
      },
      {
        title: "停滞、削弱与毁灭",
        count: "5",
        kind: "meaning",
        words: [
          study("stagnate", "联想 stagnant water“死水”：不流动、不发展 → 停滞。", "stall；languish", "stagnant adj. 停滞的；stagnation n. 停滞", "the economy began to stagnate 经济开始停滞"),
          study("hamstring", "hamstring 是腿后肌腱；伤到它就迈不开步 → 严重妨碍、削弱行动能力。", "cripple；hobble", "be hamstrung by 受……严重制约", "budget cuts hamstrung the project 预算削减严重阻碍了项目"),
          study("blight", "本义是使植物枯萎的病害；抽象地表示使希望、地区或前途受损。", "ruin；mar", "blight n. 枯萎病、破坏因素；urban blight 城市衰败", "blight her career 毁掉她的事业"),
          study("devastate", "让一片地方变得空旷荒芜 → 严重破坏、摧毁；也可使人极度悲痛。", "destroy；ravage", "devastation n. 毁灭；devastated adj. 极度悲痛的", "the storm devastated the region 暴风雨摧毁了该地区"),
          study("doom", "像提前写下坏结局 → 注定失败或遭遇不幸。", "condemn；destine", "be doomed to 注定……；doomed adj. 注定失败的", "doom the plan to failure 使计划注定失败"),
        ],
        note: "按后果加重来记：stagnate 停住 → hamstring 使迈不开步 → blight 损害前景 → devastate 摧毁 → doom 注定坏结局。",
        logicLinks: [
          { from: "stagnate", to: "hamstring", label: "场景联结", detail: "从发展停滞到行动能力被削弱" },
          { from: "hamstring", to: "blight", label: "场景联结", detail: "严重阻碍进一步发展并损害前景" },
          { from: "blight", to: "devastate", label: "场景联结", detail: "由损害递进到大规模摧毁" },
          { from: "devastate", to: "doom", label: "场景联结", detail: "严重破坏可能使事情注定失败" },
        ],
      },
      {
        title: "词形辨析",
        count: "3",
        kind: "form",
        words: [
          study("collude", "col = together，lud = play：暗中一起“玩同一套把戏” → 串通、共谋。", "conspire；connive", "collusion n. 串通；collude with 与……串通", "collude to fix prices 串通操纵价格"),
          study("dissemble", "semble = appearance：把真实意图藏在另一层表象下面 → 伪装、掩盖。", "disguise；conceal；pretend", "dissimulation n. 掩饰；注意不是 disassemble“拆开”", "dissemble one's motives 掩饰自己的动机"),
          study("resemble", "re + semble = likeness：看起来具有相似表象 → 与……相似。", "look like；be similar to", "resemblance n. 相似；resembling adj. 相似的", "The child resembles her mother. 这个孩子像她的母亲。"),
        ],
        note: "collude 是共谋；dissemble 是掩盖真实；resemble 是相似。后两词形近但意义完全不同。",
        logicLinks: [
          { from: "collude", to: "dissemble", label: "场景联结", detail: "共谋者往往需要掩盖真实意图" },
          { from: "dissemble", to: "resemble", label: "形近不同义", detail: "dissemble 掩饰；resemble 相似" },
        ],
      },
      {
        title: "信息的引出、传递与泄露",
        count: "3",
        kind: "meaning",
        words: [
          study("elicit", "e = out：通过提问或刺激把本来藏着的回答、反应引出来。", "evoke；draw out", "elicit a response 引出回应；elicitation n. 引出", "The question elicited a surprising answer. 这个问题引出了意外的回答。"),
          study("impart", "把自己拥有的一部分知识分享给别人 → 传递、传授。", "convey；transmit", "impart knowledge 传授知识；impart a quality 赋予某种特质", "impart practical skills 传授实用技能"),
          study("divulge", "把原本不公开的信息放出来 → 泄露、透露，常接 secret / information。", "disclose；reveal", "divulge a secret 泄露秘密；divulgence n. 泄露", "refuse to divulge the source 拒绝透露消息来源"),
        ],
        note: "elicit 是从别人那里引出；impart 是把自己的知识传给别人；divulge 是把不该公开的信息透露出去。",
        logicLinks: [
          { from: "elicit", to: "impart", label: "场景联结", detail: "先引出信息，再把信息传递给别人" },
          { from: "impart", to: "divulge", label: "场景联结", detail: "都是传递信息；divulge 特别强调秘密或未公开内容" },
        ],
      },
      {
        title: "散开与偏离方向",
        count: "2",
        kind: "meaning",
        words: [
          study("scatter", "把聚在一起的东西向许多方向撒开 → 散开、分散。", "disperse；strew", "scattered adj. 分散的；scatter seeds 播撒种子", "The crowd scattered quickly. 人群迅速散开。"),
          study("deflect", "de = away，flect = bend：把运动、注意力或批评弯向别处 → 使偏离、转移。", "divert；turn aside", "reflection n. 反射；flexible adj. 可弯曲的", "deflect criticism 转移批评"),
        ],
        note: "scatter 是从一点向多个方向散开；deflect 是把原本的一条方向弯到别处。",
        logicLinks: [{ from: "scatter", to: "deflect", label: "场景联结", detail: "都改变原来的集中或前进方向，但运动方式不同" }],
      },
      {
        title: "克制、忍住不做",
        count: "1",
        kind: "meaning",
        words: [study("forbear", "forbear 后接 to do：本来能做，但主动忍住不做 → 克制。", "refrain；abstain", "forbearance n. 克制、宽容；forbear to comment 忍住不评论", "She forbore to criticize him. 她克制住没有批评他。")],
      },
      {
        title: "祛魅、幻想破灭",
        count: "1",
        kind: "meaning",
        words: [study("disenchant", "dis = remove，enchant = 施魔法：解除魔法滤镜 → 使幻想破灭、使不再抱幻想。", "disillusion；disappoint", "disenchanted adj. 不再抱幻想的；disenchantment n. 幻灭", "become disenchanted with politics 对政治不再抱幻想")],
      },
    ],
  },
];
