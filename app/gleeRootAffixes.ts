export type RootAffixEntry = {
  form: string;
  meaning: string;
  coursePath: string;
  words: string[];
};

export type RootAffixList = {
  list: number;
  roots: RootAffixEntry[];
  note?: string;
};

export type RootAffixSummaryRow = {
  key: string;
  form: string;
  meaning: string;
  sourceLists: number[];
  words: Array<{ word: string; sourceLists: number[] }>;
  coursePaths: Array<{ list: number; text: string }>;
};

/** Words used by the teacher on a recap slide that are not standalone entries
 * in the Glee 1500 JSON.  Their meanings below come from that recap itself. */
export const GLEE_ROOT_AFFIX_COURSE_MEANINGS: Record<string, string> = {
  anthropomorphic: "adj. 拟人的；赋予非人事物以人格的",
  magnificent: "adj. 宏大的；壮丽的",
  pertinent: "adj. 相关的；切题的",
};

const root = (form: string, meaning: string, coursePath: string, ...words: string[]): RootAffixEntry => ({
  form,
  meaning,
  coursePath,
  words,
});

/**
 * Course-only source of truth.
 *
 * The order, spellings and associations below follow the teacher's end-of-List
 * root/affix recap screens and spoken recap.  We intentionally do not append
 * dictionary-derived relatives or "helpful" synonyms of our own.
 */
export const GLEE_ROOT_AFFIX_LISTS: RootAffixList[] = [
  { list: 1, roots: [
    root("min-", "小（small）", "老师让我们联想 mini；minute 表示极小的。", "minute"),
    root("nov-", "新（new）", "从 innovation 联想“创新＝新”；老师说明 o/e、v/w 可作字母替换。", "novel"),
    root("flu-", "流（flow）", "从 fluent“流利、流畅”联想到水流；fluid 是流体，也可指像液体一样容易变化。", "fluid"),
    root("aug-", "大、增加", "联想 Augustus“奥古斯都大帝”；august 因而表示宏大、庄严。", "august"),
    root("sume-", "拿（take）", "用 consume“把东西拿走、消耗”记；assume 是把责任拿到自己身上，因此可表示承担。", "assume"),
  ] },
  { list: 2, roots: [
    root("tract-", "拉（draw）", "attract 是把注意力拉过来；contract 可把双方拉到一起成为合同，也可向内拉而收缩，或把人与疾病拉到一起而感染。", "contract"),
    root("cred-", "相信、信用（trust）", "由“相信”得到可信、信用；credit 还可因认可而表示称赞，discredit 则表示不相信或败坏名声。", "credit"),
  ] },
  { list: 3, roots: [], note: "本 List 课末是固定短语复习，老师没有单列词根词缀总结。" },
  { list: 4, roots: [
    root("magn-", "大（large）", "magnanimous 是心胸很大、尤其能宽容或赞赏竞争对手，因此表示宽宏大量。", "magnanimous"),
    root("chron-", "时间（time）", "联想神话中的 Cronus；anachronistic 表示时间错位，或不属于现代而过时。", "anachronistic"),
    root("anthrop-", "人类", "老师把 anthropocentric、anthropogenic、anthropomorphic 放在同一根下：分别联结人类中心、人为产生和赋予非人事物以人格。", "anthropocentric", "anthropogenic", "anthropomorphic"),
    root("veri-", "真（true）", "联想 very“真”；verisimilitude 表示逼真、写实。", "verisimilitude"),
    root("lev-", "举起、轻", "联想 leverage“杠杆”；levity 是把严肃话题举重若轻地处理，因此是不严肃的态度。", "levity"),
    root("sent-", "感觉、感情（sense）", "联想 sentimental；dissent 是感情或意见相反，consent 则是感觉相同、形成共识。", "dissent"),
    root("ject-", "扔（throw）", "conjecture 是把已有信息向外抛出一个结论，因此是猜测。", "conjecture"),
    root("spec-", "看（look）", "speculate 是先看情况再给出结论，因此表示推测；老师也提醒金融语境可指投机。", "speculate"),
  ] },
  { list: 5, roots: [
    root("mal-", "坏（bad）", "maladaptive 是不能良好适应，因此表示不适应的。", "maladaptive"),
    root("magn-", "大（large）", "magnificent 表示宏大；magnify 是让东西变大，因此表示放大或加剧。", "magnificent", "magnify"),
    root("err-", "跑偏（wander）", "跑偏正轨就会出错；erroneous 表示错误的，errant 表示偏离正轨。", "erroneous", "errant"),
    root("dom-", "主宰（master）", "占据最重要、主导的位置，因此 dominant 表示占主导的。", "dominant"),
    root("min-", "小（small）", "minimal 是极小、微不足道；minimize 是让其变小，也可表示刻意低估重要性。", "minimal", "minimize"),
    root("bene-", "好（good）", "联想 benefit“好处”；beneficial 就是有益、有好处。", "beneficial"),
    root("sequ-", "跟随（follow）", "按顺序一步步跟随，因此 sequential 表示按顺序的。", "sequential"),
    root("cess-", "走（go）", "一步步往下走形成序列，successive 因此表示连续、依次的。", "successive"),
    root("vas-", "走（go）", "与 vad- 同根；pervasive 是走得到处都是，因此表示遍及、弥漫。", "pervasive"),
    root("-ify / -fy", "动词后缀", "老师强调这里主要用来识别动词词性，不要求死记后缀的具体译义。", "simplify", "falsify", "justify", "modify", "magnify"),
    root("-ize", "动词后缀", "老师强调看到该后缀先识别为动词。", "minimize", "rationalize", "energize", "materialize"),
    root("-ous / -ious / -eous", "形容词后缀", "老师把本组以这些后缀结尾的形容词集中识别。", "rigorous", "tendentious", "erroneous"),
    root("-ant / -ent", "形容词后缀", "老师把 errant、dominant 作为本组形容词后缀例词。", "errant", "dominant"),
    root("-ible / -able", "形容词后缀", "表示“可以……的”这一类形容词形式。", "readable", "inferable", "expendable", "favorable"),
    root("-al / -ial", "形容词后缀", "老师用本组词来识别形容词词性。", "beneficial", "functional", "experimental", "elemental", "sequential"),
  ] },
  { list: 6, roots: [
    root("st-", "站（stand）", "static 是站着不动，因此表示静止的。", "static"),
    root("dem-", "人民", "联想 democracy“民主”；democratic 表示民主的。", "democratic"),
    root("gen-", "产生（generate）", "engender 与 generate 同根，都表示产生。", "engender"),
    root("nov-", "新（new）", "联想 innovate / innovation；novice 是新手，也由“新”联结。", "novice"),
    root("pos-", "放置（put）", "把该放的东西都放好，内心就安定，因此 composed 表示镇定的。", "composed"),
    root("pel-", "驱动（drive）", "compel 是逼迫、驱动；dispel 则把这种力量取消，使东西消散，因此表示驱散、打消。", "dispel"),
  ] },
  { list: 7, roots: [
    root("sur-", "超过（over）", "联想 super；surfeit 和 surplus 都是超过正常量，因此都表示过量。", "surfeit", "surplus"),
    root("ple-", "装填（fill）", "plethora 是装太多；replete 是反复装而充满；deplete 是把装入的东西去掉而耗尽；complement 是把不同部分装到一起而互补；supplementary 是补入额外内容；implement 是装好后让其发挥作用、实施。", "plethora", "replete", "deplete", "complement", "supplementary", "implement"),
    root("pli-", "折叠（fold）", "折叠身体像鞠躬致意，因此 compliment 表示称赞、恭维，也可指赠礼。", "compliment"),
    root("pan-", "全部（all）", "panacea 是“全部都能治”的药，因此表示万灵药。", "panacea"),
    root("mal-", "坏（bad）", "malady 是身体不好而得病；malign 是说坏话或恶意的；malodorous 是 bad + odor“坏气味”，因此恶臭；malfeasance 是做坏事，表示不法行为。", "malady", "malign", "malodorous", "malfeasance"),
    root("ac-", "尖锐（sharp）", "acerbic、acrimonious 都指言语尖锐、带刺，因此表示尖酸刻薄。", "acerbic", "acrimonious"),
    root("mord-", "咬（bite）", "联想 morsel“一口食物”；mordant 像咬人一样让人难受，因此表示尖刻、辛辣。", "mordant"),
    root("insul-", "岛、隔离", "联想 peninsula、insulate；岛国式封闭心态引申为狭隘、没见过世面。", "insular"),
    root("luc-", "光（light）", "有光就清楚；lucid、pellucid 都表示清晰、透明或容易理解。", "lucid", "pellucid"),
    root("cond-", "藏在后面", "recondite 像藏到后面看不懂，因此表示小众、难理解。", "recondite"),
    root("ter-", "土地（earth）", "钻到土里看不清，老师用来联结 esoteric“难以理解”。", "esoteric"),
    root("plex-", "编织、交织", "很多东西交织到一起会复杂、使人困惑，因此联结 perplex。", "perplex"),
  ] },
  { list: 8, roots: [
    root("lud- / lus-", "玩（play）", "elude 像跑出去玩而躲开；elusive 是它的派生形式，老师提醒 d/s 替换。", "elude", "elusive"),
    root("vad- / vas-", "走（go）", "evade 是向外跑而躲避；evasive 是其派生形式，可表示逃避话题。", "evade", "evasive"),
    root("circum-", "环绕（circle）", "circumvent 是绕圈走而规避；circumspect 是绕圈看而谨慎；circumscribe 是画圈把人圈住而限制。", "circumvent", "circumspect", "circumscribe"),
    root("fin-", "边界（boundary）", "confine 是放进边界而限制；definitive 是把边界定下来而确定、权威；affinity 可联结为小范围里的相似或亲近。", "confine", "definitive", "affinity"),
    root("omni-", "全部（all）", "omnipresent 是全都出现，因此表示无处不在。", "omnipresent"),
    root("min-", "小（small）", "联想 mini；diminutive、minuscule 都表示极小。", "diminutive", "minuscule"),
    root("ben-", "好（good）", "benign 表示无害、良性。", "benign"),
    root("noc- / nox- / nic-", "毒、伤害", "innocuous 是没有毒害；noxious、pernicious 是有毒有害，前者与后两者构成反向。", "innocuous", "noxious", "pernicious"),
    root("rod- / ros-", "咬（bite）", "corrosive 像一起咬坏东西，因此表示有腐蚀、破坏作用。", "corrosive"),
    root("cur-", "跑（run）", "incursion 是跑进去；precursor 是跑在前面的人；cursory 是匆匆跑过而草率；discursive 是跑得到处都是而离题。", "incursion", "precursor", "cursory", "discursive"),
    root("gress-", "走、迈步（step）", "digress 是向旁边迈步而跑题；transgress 是越过界线、践踏底线而违反。", "digress", "transgress"),
    root("archa-", "古老（old）", "联想 archaeology；archaic 表示极其古老、过时。", "archaic"),
    root("cred-", "相信（believe）", "credulous 是容易相信别人；discredit 可表示不相信、质疑或败坏名声。", "credulous", "discredit"),
  ] },
  { list: 9, roots: [
    root("trans-", "穿过", "transient 是匆匆穿过的过客，因此表示短暂。", "transient"),
    root("it-", "走（walk）", "联想 visit“边走边看”；transitory 是很快走过去，因此短暂。", "transitory"),
    root("van-", "消失（vanish）", "向外很快消散，因此 evanescent 表示稍纵即逝。", "evanescent"),
    root("dur-", "长久；坚硬", "enduring 由“长久”表示持久；obdurate 由“坚硬”表示顽固，老师特别纠正二者不要混义。", "enduring", "obdurate"),
    root("clud- / clus-", "关闭（close）", "occlude 是朝一个方向关上而堵塞；preclude 是提前关门而阻止；inclusive 是包含在内；exclusive 是关在外面而排他、独家。", "occlude", "preclude", "inclusive", "exclusive"),
    root("prehend- / prehens-", "抓（seize）", "comprehend 是抓住含义而理解；comprehensive 是全都抓住而全面；apprehend 可表示抓住人、抓住含义，apprehensive 则是担心；reprehensible 是应当被抓回来谴责。", "comprehend", "comprehensive", "apprehend", "apprehensive", "reprehensible"),
    root("min-", "突出（jut）", "prominent 是向前突出而显眼；eminent 是向外突出而杰出；imminent 是突到眼前而即将发生。", "prominent", "eminent", "imminent"),
    root("volu-", "转动", "嘴和舌不断转动，因此 voluble 表示话多、健谈。", "voluble"),
    root("loqu-", "说（speak）", "loquacious 表示很能说、话多。", "loquacious"),
    root("cis-", "切（cut）", "concise 是切掉多余而简洁；decisive 是切下决定而果断；incisive 是向内切而犀利。", "concise", "decisive", "incisive"),
    root("trench-", "切、挖", "trenchant 像挖壕沟般切入而犀利；entrenched 是待在壕沟里不出来而根深蒂固。", "trenchant", "entrenched"),
    root("puls-", "推（push）", "compulsory 是推着你走，因此表示强制的、义务的。", "compulsory"),
  ] },
  { list: 10, roots: [
    root("rept- / rap-", "抓、拿（seize）", "surreptitious 像从下面偷偷拿走而秘密；rapacious 是把东西都拿走而贪婪。", "surreptitious", "rapacious"),
    root("vor-", "吃（eat）", "联想 carnivore / herbivore；voracious 是特别能吃，也可引申为贪婪、如饥似渴。", "voracious"),
    root("ver-", "真（true）", "联想 very / verify；veracious 因此表示真实、诚实。", "veracious"),
    root("ten-", "抓住（hold）", "tenacious 是牢牢抓住不放，因此执着、坚持不懈。", "tenacious"),
    root("pugn-", "打、攻击（fight）", "pugnacious 是喜欢打斗而好斗；impugn 是用言语攻击，因此指责、质疑。", "pugnacious", "impugn"),
    root("bell-", "战争（war）", "belligerent 是喜欢带来战争，因此好斗、敌对。", "belligerent"),
    root("bol-", "扔（throw）", "hyperbole 是扔得特别高，因此表示夸张、夸大。", "hyperbole"),
    root("over-", "过度", "overstate 是过度陈述，overblown 是吹得过头，因此都联结夸大。", "overstate", "overblown"),
    root("under-", "不足、向下", "understatement 是保守陈述；underrate 是低估；undercut、undermine 都表示削弱。", "understatement", "underrate", "undercut", "undermine"),
    root("heter-", "不同、其他（other）", "heterogeneous 是不同来源、不同种类，因此多元混合。", "heterogeneous"),
    root("par-", "相同（same）", "disparate 是不相同；disparage 是不把对方当作与自己平等的人而贬低。", "disparate", "disparage"),
    root("lith-", "石头（stone）", "monolithic 是一整块石头，因此表示大一统、铁板一块。", "monolithic"),
    root("dain-", "值得（worth）", "disdain 是认为对方不值得、不配，因此表示轻视。", "disdain"),
    root("fid-", "相信（trust）", "diffident 是不相信自己，因此不自信、羞怯。", "diffident"),
  ] },
  { list: 11, roots: [
    root("mon-", "一、单一（one / single）", "monotonous 是单一声调，因此单调无聊。", "monotonous"),
    root("ped-", "脚（foot）", "pedestrian 原指用脚行走的路人；引申为平凡、无聊、乏味。", "pedestrian"),
    root("cumb-", "躺（lie）", "cumbersome 像笨重物体躺在那里搬不动，因此笨重。", "cumbersome"),
    root("ag-", "行动（act）", "agile 是容易行动，因此行动敏捷或头脑机敏。", "agile"),
    root("fic-", "做（do / make）", "proficient 是不断向前做、精进技能，因此熟练。", "proficient"),
    root("tri-", "三（three）", "trivial 联想三岔路口交换不重要信息，因此表示不重要。", "trivial"),
    root("peri-", "周围、边缘（around）", "peripheral 位于边缘，因而引申为不重要。", "peripheral"),
    root("tang-", "触碰（touch）", "tangent 是两者只碰一下而相切，也可引申为跑题、不重要。", "tangent"),
    root("tain- / tin-", "抓住（hold）", "pertain 是抓到自己手里而与自己相关；pertinent 是其形容词形式。", "pertain", "pertinent"),
    root("fert-", "生育、承载（bear）", "fertile 是容易生育，因此多产、肥沃。", "fertile"),
    root("volu-", "卷（roll）", "convoluted 是都卷在一起，因此结构复杂。", "convoluted"),
    root("plic-", "折叠（fold）", "complicated 是都折叠在一起，因此复杂。", "complicated"),
    root("plex-", "编织", "complex 是编织到一起、难以区分，因此复杂；也联结 perplex“困惑”。", "complex"),
  ] },
  { list: 12, roots: [
    root("somn-", "睡（sleep）", "somnolent 使人昏昏欲睡。", "somnolent"),
    root("gen-", "出生、产生（birth）", "genuine 是原产、原装、原汁原味，因此真实。", "genuine"),
    root("spec-", "看（look）", "specious 是看起来像真的、其实不是，因此似是而非、假的。", "specious"),
    root("fic-", "做（do / make）", "artificial 是用技巧做出来的，因此人造，也可引申为不天然、假的。", "artificial"),
    root("tend-", "延伸（stretch）", "portend 是把未来向外延伸、展示到眼前，因此预示。", "portend"),
    root("sci-", "知道（know）", "prescient 是预先知道，因此有先见之明、预知。", "prescient"),
    root("peri-", "风险（risk）", "perilous 是充满风险，因此危险。", "perilous"),
    root("und-", "流（flow）", "abundant 像水流到处都是而大量；redundant 像不断往里注水而多余。", "abundant", "redundant"),
    root("fus-", "流（flow）", "profusion 是水不断向前涌现，因此大量、丰富。", "profusion"),
    root("flu-", "流（flow）", "superfluous 是流得太多而多余；affluent 是钱财不断流入而富裕。", "superfluous", "affluent"),
    root("thet-", "放置（put）", "antithetical 是把相反的东西放在一起，因此对立。", "antithetical"),
    root("dic-", "说（speak）", "contradict 是说相反的话，因此反驳或相矛盾。", "contradict"),
    root("rog-", "要求（ask）", "arrogant 像不断提出过分要求，因此傲慢自大。", "arrogant"),
    root("sequ-", "跟随（follow）", "obsequious 是跟在别人后面，因此谄媚、拍马屁。", "obsequious"),
  ] },
  { list: 13, roots: [
    root("vers-", "转（turn）", "adversarial 由 adverse 联结为对立敌对；reversal 是转回来、反转；subversive 是从下面把它翻转而颠覆；conversant / versatile 都联结为在各方面转得开、熟练或多才多艺。", "adversarial", "adverse", "reversal", "subversive", "conversant", "versatile"),
    root("mut-", "变化（change）", "联想 mutation；mutable 表示可以改变。", "mutable"),
    root("turb-", "搅动", "imperturbable 是不被搅动而沉着；turbid 是水被搅浑；turbulent 是地区或时代被搅乱而动荡。", "imperturbable", "turbid", "turbulent"),
    root("pel-", "推（push）", "expel 是向外推出，因此驱逐。", "expel"),
    root("hind-", "后面（behind）", "hinder 是把人放到后面、拖慢进度，因此阻碍。", "hinder"),
    root("ped-", "脚（foot）", "impede 像在脚上套上镣铐，使人不能前进，因此阻碍。", "impede"),
    root("cumb-", "躺（lie）", "encumber 像重物躺在路上挡住前行，因此阻碍。", "encumber"),
    root("ter-", "恐惧", "deter 是用恐惧吓阻，使人不敢行动。", "deter"),
    root("fer-", "带来（bring）", "defer 是往后带而推迟；把自己往后放又可表示遵从，deferential 因而是毕恭毕敬的。", "defer", "deferential"),
    root("pos-", "放置（put）", "disposition 是把位置、姿态放好，引申为性情或倾向。", "disposition"),
    root("orient-", "东方、方向", "orientation 是方向确定，因而引申为倾向。", "orientation"),
    root("lect-", "选择（choose）", "predilection 是提前选好自己喜欢的东西，因此偏好。", "predilection"),
    root("prob-", "证明（prove）", "probity 由经得住检验证明联结为正直。", "probity"),
    root("it-", "走（go）", "itinerant 是到处走，因此居无定所。", "itinerant"),
    root("peri-", "周围（around）", "peripatetic 是四处走动，因此居无定所。", "peripatetic"),
    root("punct-", "针、刺（prick）", "punctilious 是关注针尖般小的细节，因此仔细认真；compunction 是内心像被针扎，因此内疚后悔。", "punctilious", "compunction"),
  ] },
  { list: 14, roots: [
    root("ambi-", "两者都（both）", "ambivalent 是两边价值都好而难以取舍、矛盾纠结；ambiguous 是两条路都能走而不确定。", "ambivalent", "ambiguous"),
    root("voc-", "喊、声音（call / voice）", "equivocal 是两边声音一样而不确定；provocative 是把反应叫出来；advocate 是把声音对外放大、替某事发声。", "equivocal", "provocative", "advocate"),
    root("err-", "跑偏（wander）", "erratic 是四处乱跑，因此不规律、不可预测。", "erratic"),
    root("cant-", "说、唱（chant）", "recant 是把说过的话收回，因此撤回言论或政策。", "recant"),
    root("frag- / fract-", "碎裂（break）", "fragile 是容易碎；老师提醒 frail 是其变体词形。", "fragile"),
    root("tang-", "触碰（touch）", "tangible 是看得见、摸得着，因此可感知。", "tangible"),
    root("sal-", "跳（jump）", "salient 像跳得很高而显出来，因此显眼、突出。", "salient"),
    root("spic-", "看（look）", "是 spec- 的变体；conspicuous 是大家都能看见，因此明显。", "conspicuous"),
    root("flag-", "火焰（flame）", "flagrant 像熊熊燃烧而特别明显，且常指明目张胆地坏。", "flagrant"),
    root("arch-", "统治、等级", "联想 anarchy、monarchy；hierarchical 是分等级、分层级。", "hierarchical"),
    root("her-", "粘（stick）", "inherent 是粘在内部而内在；adhere 是粘上或坚守；coherent 是不同部分粘在一起而连贯。", "inherent", "adhere", "coherent"),
    root("plac-", "使舒适、平静（please）", "placatory 是安抚性的；implacable 是无法进入平静状态而不可平息；complacent 是对自己满意而自满。", "placatory", "implacable", "complacent"),
  ] },
  { list: 15, roots: [
    root("sang-", "血（blood）", "sanguine 是面有血色；引申为乐观、自信。", "sanguine"),
    root("path-", "感情（feeling）", "apathetic 是没有感情，因此冷漠、无感。", "apathetic"),
    root("ferv-", "沸腾（boil）", "fervent 像沸腾的水一样热烈，因此热情洋溢。", "fervent"),
    root("fus-", "流（flow）", "effusive 是情感像水一样向外流，因此热情洋溢。", "effusive"),
    root("fract-", "碎裂（break）", "fractious 像随时会碎裂爆发，因此易怒，也可指难管教。", "fractious"),
    root("fact-", "做（do / make）", "faction 是一起做事形成的派系；factious 因而表示派系林立、好争斗。", "factious"),
    root("fa-", "说（speak）", "affable 字面是愿意同你说话，因此容易相处。", "affable"),
    root("spic-", "看（look）", "auspicious 联想出门看见好兆头，因此吉利、幸运。", "auspicious"),
    root("salu-", "健康（health）", "salutary、salubrious 都与健康、有益有关；前者也可指从坏事中得到的有益教训。", "salutary", "salubrious"),
    root("oner-", "负担（burden）", "onerous 是负担很重，因此费力繁重。", "onerous"),
    root("vers- / vert-", "转（turn）", "controversial 是观点反转冲突而有争议；incontrovertible 是不能被反转，因此无可置疑。", "controversial", "incontrovertible"),
    root("lev-", "举起（rise）", "联想 lever / elevator；alleviate 是把重担举起一些，使痛苦减轻。", "alleviate"),
    root("moll-", "软（soft）", "mollify 是让东西软下来，因此缓和、平息。", "mollify"),
    root("tenu-", "薄（thin）", "attenuate 是让东西变薄，因此减弱、减轻；tenuous 本身薄弱，因此指脆弱、稀薄。", "attenuate", "tenuous"),
  ] },
  { list: 16, roots: [
    root("cept- / ceive-", "拿（take）", "联想 receive；deceive / deception 是把人往下带入骗局。", "deception"),
    root("du-", "双重（double）", "duplicity 是两面状态，因此欺诈、两面派；duplicate 是做副本。", "duplicity", "duplicate"),
    root("plic-", "折叠（fold）", "duplicate 是折成双份；replicate 是 re“再次”折叠，因此复制、复刻结果。", "duplicate", "replicate"),
    root("flour- / flor-", "花（flower）", "花都开了，因此 flourish 表示繁荣；作名词还可指装饰性修辞。", "flourish"),
    root("vac-", "空（empty）", "联想 vacation / vacuum；vacant 是位置或眼神空，vacuous 是内容空洞、没有干货。", "vacant", "vacuous"),
    root("gen-", "出生（birth）", "indigenous 是在这里出生，因此本土、本地。", "indigenous"),
    root("nounce-", "公开说", "denounce 是公开说坏话，因此谴责。", "denounce"),
    root("alt-", "高（tall）", "exalt 是把人放到很高的位置，因此拔高、称赞。", "exalt"),
    root("claim-", "喊", "acclaim 是喊好、认可，因此赞扬。", "acclaim"),
    root("col-", "脖子（neck）", "accolade 联想把奖牌挂在脖子上，因此表示赞誉、嘉奖。", "accolade"),
    root("tent-", "伸展（stretch）", "unostentatious 是不向外伸展、不花枝招展，因此低调朴实。", "unostentatious"),
    root("dox-", "观点（opinion）", "orthodox 是正统观点；unorthodox 是非正统；heterodox 是与正统相对的异端观点。", "orthodox", "unorthodox", "heterodox"),
    root("ten-", "抓住（hold）", "untenable 是没有东西可抓，因此站不住脚、没有根据。", "untenable"),
    root("cede-", "走（go）", "unprecedented 是没有走在前面的先例，因此史无前例。", "unprecedented"),
    root("plat-", "平（flat）", "platitude 是言辞平平、没有新鲜内容，因此陈词滥调。", "platitude"),
  ] },
  { list: 17, roots: [
    root("nym-", "名字（name）", "anonymous 是没有名字而匿名；synonymous 是名字相同而同义。", "anonymous", "synonymous"),
    root("limin-", "边界（limit）", "eliminate 是把东西从边界内清除出去，因此彻底消除。", "eliminate"),
    root("radic-", "根（root）", "radical 可表示根本、彻底或激进；eradicate 是连根拔起，因此根除。", "eradicate"),
    root("serv-", "保留（keep）", "conservative 是保留原有事物，因此保守。", "conservative"),
    root("grav-", "重（heavy）", "联想 gravity；aggravate 是让情况更重，因此加剧、恶化。", "aggravate"),
    root("ac-", "尖锐（sharp）", "exacerbate 是让事情更尖锐，因此加剧、恶化。", "exacerbate"),
    root("liber-", "自由（free）", "联想 liberate；liberal 表示思想宽容，也可表示花钱大方。", "liberal"),
    root("lav-", "洗（wash）", "lavish 联想花钱如流水，因此奢侈、挥霍。", "lavish"),
    root("rid-", "笑（laugh）", "ridicule、deride 都表示嘲笑。", "ridicule", "deride"),
    root("jud-", "评价", "judicious 是给出明智评价，因此明智、审慎。", "judicious"),
    root("cept-", "抓（seize）", "perceptive 是能彻底抓住信息，因此敏锐。", "perceptive"),
    root("scend-", "爬（climb）", "transcend 是越过去，因此超越。", "transcend"),
    root("fect-", "做（do / make）", "defect 是向下做出不好的东西，因此缺陷。", "defect"),
    root("fic-", "做（do / make）", "deficit 同样联结为做得不足，因此缺失、赤字。", "deficit"),
  ] },
  { list: 18, roots: [
    root("sacr-", "神圣（holy）", "sacrosanct 把神圣意义叠加强调，因此极其神圣、不可侵犯。", "sacrosanct"),
    root("sanct-", "神圣（holy）", "与 sacr- 一起强化 sacrosanct 的神圣含义。", "sacrosanct"),
    root("cept-", "拿、抓（take）", "susceptible 像在下面被人拿捏，因此易受影响；exceptional 是从人群里被拿出来，因此例外、杰出。", "susceptible", "exceptional"),
    root("sid-", "坐（sit）", "assiduous 是一直坐得住，因此勤勉认真。", "assiduous"),
    root("radic-", "根（root）", "radical 与根本、激进相连。", "radical"),
    root("altru-", "他者（other）", "altruistic 是为了他者、没有自己，因此利他无私。", "altruistic"),
    root("bene-", "好（good）", "benevolent 是抱有好的意愿，因此仁慈善良。", "benevolent"),
    root("vol-", "意愿（will）", "联想 volunteer；benevolent 是 good will“善意”。", "benevolent"),
    root("luc-", "光（light）", "elucidate 是把东西照亮、弄清楚，因此阐明。", "elucidate"),
    root("lumin-", "光", "联想 lumen“流明”；illuminate 是让光照进来，因此照亮、阐明。", "illuminate"),
    root("vert-", "转（turn）", "subvert 是从下面反转，因此颠覆。", "subvert"),
    root("ac-", "尖锐（sharp）", "acute 由尖锐联结锐角、头脑敏锐或局势剧烈。", "acute"),
    root("culp-", "罪", "exculpate 是把罪责拿出去，因此免罪。", "exculpate"),
    root("oner-", "负担（burden）", "exonerate 是把责任负担拿出去，因此免除罪责。", "exonerate"),
    root("st-", "站（stand）", "staunch 是站定不动，因此坚定。", "staunch"),
    root("pos-", "放（put）", "apposite 是放在恰当位置，因此合适恰当。", "apposite"),
  ] },
  { list: 19, roots: [
    root("press-", "压（press）", "depressing 是向下压，像心里压着石头，因此令人沮丧。", "depressing"),
    root("homo-", "相同（same）", "homogeneous 表示同质、相同。", "homogeneous"),
    root("gen-", "出生（birth）", "homogeneous 是相同的出生来源，因此同质。", "homogeneous"),
    root("path-", "感情（feeling）", "sympathetic 是相同感情，因此可表示同情，也可表示支持赞同。", "sympathetic"),
    root("equ-", "相同（equal）", "equivalent 是价值相同而等值；equable 是内心或天气平和。", "equivalent", "equable"),
    root("termin-", "结束（end）", "terminal 由“结束”表示最终的，也可指航站楼。", "terminal"),
    root("par-", "相同（pair）", "parity 是一双一对的相同，因此平等；disparity 是其反义。", "parity"),
    root("mini-", "小（small）", "diminish 是变小，因此减少。", "diminish"),
    root("med-", "治疗（medicine）", "remedy 是治疗、纠正或补救。", "remedy"),
    root("anim-", "生命（live）", "联想 animal；animate 是使有活力，因此激活、激励。", "animate"),
    root("am-", "爱（love）", "enamor 是进入爱的状态而迷恋；amateur 是因为爱好而做事的业余者。", "enamor", "amateur"),
    root("tort-", "扭（twist）", "distort 是扭到别的方向，因此歪曲、扭曲。", "distort"),
    root("mis-", "送（send）", "demise 像把人向下送走，因此死亡。", "demise"),
    root("tract-", "拉（draw）", "extract 是向外拉出，因此提炼、提取信息。", "extract"),
  ] },
  { list: 20, roots: [
    root("umbr-", "影子（shadow）", "联想 umbrella；umbrage 像被阴影遮住而生气，常见 take umbrage at。", "umbrage"),
    root("ting-", "触碰（touch）", "contingent 是与外部条件接触、受其决定，因此取决于。", "contingent"),
    root("greg-", "人群（group）", "联想 aggregate / segregate；gregarious 是喜欢和人群聚在一起，因此爱社交。", "gregarious"),
    root("auto-", "自己", "autonomous 是自己给自己作主，因此独立自主。", "autonomous"),
    root("ven-", "售卖（sell）", "venal 是出卖权利以换取利益，因此贪腐、可收买。", "venal"),
    root("nat-", "出生（born）", "联想 native；innate 是与生俱来、本来就有。", "innate"),
    root("pot-", "力量、权力（power）", "impotent 是没有力量，因此无能、无力。", "impotent"),
    root("son-", "声音", "联想 sonic；resonate 是声音反复回响，引申为共鸣、对人重要。", "resonate"),
    root("stru-", "构建（build）", "联想 structure / construction；construe 是构建含义，因此解释、解读。", "construe"),
    root("scribe-", "写（write）", "proscribe 是写出来规定不能做，因此禁止。", "proscribe"),
    root("vis-", "看（see）", "improvise 是没有提前看、没有准备，因此即兴发挥。", "improvise"),
    root("quies-", "安静（quiet）", "acquiesce 是安静地接受，因此默许。", "acquiesce"),
    root("brev-", "短（short）", "abbreviate 是让东西变短，因此缩短、缩写。", "abbreviate"),
    root("van-", "空（empty）", "vanish 是变成一场空，因此消失；老师同时回扣 evanescent。", "vanish"),
    root("thes-", "放置", "synthesis 是把东西放到一起，因此综合、合成。", "synthesis"),
    root("sens-", "感觉（sense）", "consensus 是大家感觉相同，因此共识。", "consensus"),
    root("cord-", "心（heart）", "discord 是心不在一起，因此不一致、冲突。", "discord"),
  ] },
  { list: 21, roots: [], note: "List 21 Part 2 词汇已按前课方法仿讲补齐；本处仅收录老师课末词根词缀总结，待官方更新后再补。" },
];

const ROOT_AFFIX_FAMILY_FORMS: Record<string, string> = {
  "spec-": "spec- / spic-",
  "spic-": "spec- / spic-",
  "cept-": "cept- / ceive-",
  "cept-/ceive-": "cept- / ceive-",
  "vers-": "vers- / vert-",
  "vert-": "vers- / vert-",
  "vers-/vert-": "vers- / vert-",
  "frag-/fract-": "frag- / fract-",
  "fract-": "frag- / fract-",
  "fac-": "fac- / fic- / fact- / fect-",
  "fic-": "fac- / fic- / fact- / fect-",
  "fact-": "fac- / fic- / fact- / fect-",
  "fect-": "fac- / fic- / fact- / fect-",
  "vad-/vas-": "vad- / vas-",
  "vas-": "vad- / vas-",
  "clud-/clus-": "clud- / clus-",
  "clud-": "clud- / clus-",
  "clus-": "clud- / clus-",
  "prehend-/prehens-": "prehend- / prehens-",
  "prehend-": "prehend- / prehens-",
  "prehens-": "prehend- / prehens-",
};

function normalizedRootAffixForm(form: string) {
  return form.toLocaleLowerCase().replace(/\s+/g, "");
}

function rootAffixFamily(form: string, meaning: string) {
  const normalizedForm = normalizedRootAffixForm(form);
  const familyForm = ROOT_AFFIX_FAMILY_FORMS[normalizedForm] ?? form;
  const familyKey = normalizedRootAffixForm(familyForm);

  // These spellings represent unrelated roots in the teacher's recaps.  Keep
  // them apart even though their surface forms happen to be identical.
  if (familyKey === "min-" && /突出|伸出|jut/i.test(meaning)) return { key: "min-:jut", form };
  if (familyKey === "ter-" && /恐惧|fear/i.test(meaning)) return { key: "ter-:fear", form };
  if (familyKey === "peri-" && /风险|危险|risk/i.test(meaning)) return { key: "peri-:risk", form };

  return { key: `${familyKey}:main`, form: familyForm };
}

/** Build the all-List index around roots rather than around Lists.
 * Repeated roots are represented once, while every course occurrence and
 * every associated word retains its original List provenance. */
export function buildRootAffixSummaryRows(lists: RootAffixList[] = GLEE_ROOT_AFFIX_LISTS): RootAffixSummaryRow[] {
  const rows = new Map<string, {
    key: string;
    form: string;
    meanings: string[];
    sourceLists: number[];
    words: Map<string, { word: string; sourceLists: number[] }>;
    coursePaths: Array<{ list: number; text: string }>;
  }>();

  lists.forEach((listItem) => {
    listItem.roots.forEach((entry) => {
      const family = rootAffixFamily(entry.form, entry.meaning);
      const row = rows.get(family.key) ?? {
        key: family.key,
        form: family.form,
        meanings: [] as string[],
        sourceLists: [] as number[],
        words: new Map(),
        coursePaths: [] as Array<{list:number;text:string}>,
      };

      if (!row.meanings.includes(entry.meaning)) row.meanings.push(entry.meaning);
      if (!row.sourceLists.includes(listItem.list)) row.sourceLists.push(listItem.list);
      if (!row.coursePaths.some((item) => item.list === listItem.list && item.text === entry.coursePath)) {
        row.coursePaths.push({ list: listItem.list, text: entry.coursePath });
      }
      entry.words.forEach((word) => {
        const wordKey = word.toLocaleLowerCase();
        const existingWord = row.words.get(wordKey) ?? { word, sourceLists: [] };
        if (!existingWord.sourceLists.includes(listItem.list)) existingWord.sourceLists.push(listItem.list);
        row.words.set(wordKey, existingWord);
      });
      rows.set(family.key, row);
    });
  });

  return Array.from(rows.values()).map((row) => ({
    key: row.key,
    form: row.form,
    meaning: row.meanings.join("；"),
    sourceLists: row.sourceLists,
    words: Array.from(row.words.values()),
    coursePaths: row.coursePaths,
  }));
}
