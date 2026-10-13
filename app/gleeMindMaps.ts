import { GLEE_STUDY_NOTES } from "./gleeStudyNotes.ts";
import { LIST_21_PART_2 } from "./list21Part2.ts";
import { LIST_22_MIND_MAPS } from "./list22MindMaps.ts";
import { LIST_23_TO_30_MIND_MAPS } from "./list23To30MindMaps.ts";
import glee1500Data from "./glee1500.json" with { type: "json" };

export type MindMapBranchKind = "meaning" | "root" | "form" | "contrast";

export type MindMapWord = {
  word: string;
  gloss?: string;
  synonyms?: string;
  relatedWords?: string;
  example?: string;
  memory?: string;
};

export type MindMapLogicLink = {
  from: string;
  to: string;
  label: "同义" | "反义" | "形近不同义" | "词根联结" | "派生联结" | "场景联结";
  detail?: string;
};

/**
 * Keep the word graph as a forest. Older cloud snapshots may contain a link
 * whose direction was later corrected in the course notes; blindly combining
 * both directions would create a cycle and leave every word in that cycle
 * without a visible root node.
 */
export function acyclicMindMapLogicLinks(links: MindMapLogicLink[]) {
  const accepted: MindMapLogicLink[] = [];
  const parentByTarget = new Map<string, MindMapLogicLink>();

  for (const link of links) {
    if (parentByTarget.has(link.to)) continue;
    const visited = new Set([link.to]);
    let ancestor: string | undefined = link.from;
    let createsCycle = false;
    while (ancestor) {
      if (visited.has(ancestor)) {
        createsCycle = true;
        break;
      }
      visited.add(ancestor);
      ancestor = parentByTarget.get(ancestor)?.from;
    }
    if (createsCycle) continue;
    accepted.push(link);
    parentByTarget.set(link.to, link);
  }

  return accepted;
}

export type MindMapBranch = {
  title: string;
  count: string;
  kind: MindMapBranchKind;
  words: MindMapWord[];
  note?: string;
  relation?: string;
  logicLinks?: MindMapLogicLink[];
  contrastGroups?: Array<{
    label: string;
    tone: "blue" | "pink";
    words: string[];
  }>;
};

export type GleeMindMap = {
  id: string;
  list: number;
  part: 1 | 2;
  branches: MindMapBranch[];
};

type MindMapWordInput = string | [string, string] | MindMapWord;

const words = (...items: MindMapWordInput[]): MindMapWord[] => items.map((item) => {
  const entry = typeof item === "string"
    ? { word: item }
    : Array.isArray(item)
      ? { word: item[0], gloss: item[1] }
      : item;
  return { ...GLEE_STUDY_NOTES[entry.word.toLocaleLowerCase()], ...entry };
});

const RAW_GLEE_MIND_MAPS: GleeMindMap[] = [
  {
    id: "7-1",
    list: 7,
    part: 1,
    branches: [
      { title: "狭隘的 VS 见过世面的", count: "4", kind: "contrast", words: words("insular", "parochial", "provincial", "cosmopolitan"), note: "前三个表示狭隘；cosmopolitan 表示见过世面。", contrastGroups: [{ label: "狭隘的", tone: "blue", words: ["insular", "parochial", "provincial"] }, { label: "见过世面的", tone: "pink", words: ["cosmopolitan"] }] },
      { title: "尖酸刻薄的", count: "5", kind: "meaning", words: words("acerbic", "acrimonious", "vitriolic", "caustic", "mordant") },
      { title: "不足", count: "2", kind: "meaning", words: words("paucity", "dearth") },
      { title: "过多", count: "3", kind: "meaning", words: words("surfeit", "surplus", "plethora"), relation: "plethora → ple = fill" },
      { title: "ple = fill", count: "5+1", kind: "root", words: words("replete", "deplete", "complement", "compliment", "supplementary", "implement"), note: "注意 complement（补充物）与 compliment（赞美）的拼写。", logicLinks: [{ from: "complement", to: "compliment", label: "形近不同义", detail: "complement 补充、补足；compliment 赞美" }] },
      { title: "万灵药 VS 病", count: "2", kind: "contrast", words: words(["panacea", "万灵药"], ["malady", "病"]), relation: "malady → mal = bad", contrastGroups: [{ label: "万灵药", tone: "blue", words: ["panacea"] }, { label: "病", tone: "pink", words: ["malady"] }] },
      { title: "mal = bad", count: "3", kind: "root", words: words("malign", ["malodorous", "难闻的；恶臭的"], "malfeasance"), note: "malodorous：难闻的、恶臭的；用 mal = bad 联结记忆。" },
    ],
  },
  {
    id: "7-2",
    list: 7,
    part: 2,
    branches: [
      { title: "困惑", count: "6", kind: "meaning", words: words("nonplus", "perplex", "flummox", "baffle", "confound", "obfuscate") },
      { title: "谜题", count: "3", kind: "meaning", words: words("enigmatic", "conundrum", "riddle") },
      { title: "清晰易懂的", count: "5", kind: "meaning", words: words("accessible", "transparent", "limpid", "lucid", "pellucid") },
      { title: "难以理解的", count: "9+2", kind: "meaning", words: words("inscrutable", "scrutinize", "unfathomable", "fathom", "impenetrable", "recondite", "esoteric", "arcane", "abstruse", "opaque", "obscure"), note: "九个词表示难以理解；scrutinize 与 fathom 是用来联结词形和反向含义的辅助词。", logicLinks: [{ from: "inscrutable", to: "scrutinize", label: "形近不同义", detail: "inscrutable 难以理解；scrutinize 仔细检查" }, { from: "unfathomable", to: "fathom", label: "反义", detail: "无法理解 ↔ 理解" }] },
    ],
  },
  {
    id: "8-1",
    list: 8,
    part: 1,
    branches: [
      { title: "极小的", count: "2", kind: "meaning", words: words("diminutive", "minuscule") },
      { title: "无处不在的", count: "3", kind: "meaning", words: words("universal", "ubiquitous", "omnipresent") },
      { title: "不切实际的 VS 务实的", count: "5", kind: "contrast", words: words("utopian", "quixotic", "fanciful", "pragmatic", "practical"), note: "前三个表示不切实际；后两个表示务实。", contrastGroups: [{ label: "不切实际的", tone: "blue", words: ["utopian", "quixotic", "fanciful"] }, { label: "务实的", tone: "pink", words: ["pragmatic", "practical"] }] },
      { title: "躲避", count: "8+2", kind: "meaning", words: words("elude", "elusive", "evade", "evasive", "eschew", "shun", "dodge", "sidestep", "bypass", "circumvent"), relation: "circumvent → circum = circle", logicLinks: [{ from: "elude", to: "elusive", label: "派生联结", detail: "elude 躲避；elusive 难以捕捉的" }, { from: "evade", to: "evasive", label: "派生联结", detail: "evade 躲避；evasive 逃避的、含糊其辞的" }] },
      { title: "circum = circle", count: "2+1", kind: "root", words: words("circumspect", "circumscribe", "confine"), relation: "confine → fin = boundary", logicLinks: [{ from: "circumscribe", to: "confine", label: "同义", detail: "都可表示限制、限定" }] },
      { title: "fin = boundary", count: "2", kind: "root", words: words("definitive", "affinity") },
    ],
  },
  {
    id: "8-2",
    list: 8,
    part: 2,
    branches: [
      { title: "轻信的", count: "2+1", kind: "meaning", words: words("gullible", "credulous", "discredit"), note: "cred = believe：用 discredit 联结 credulous。", logicLinks: [{ from: "credulous", to: "discredit", label: "词根联结", detail: "cred = believe；credulous 轻信的，discredit 使不可信" }] },
      { title: "过时的", count: "5", kind: "meaning", words: words("outmoded", "outdated", "obsolete", "archaic", "antediluvian") },
      { title: "无害的 VS 有害的", count: "2+5", kind: "contrast", words: words("benign", "innocuous", "noxious", "pernicious", "deleterious", "detrimental", "corrosive"), note: "benign / innocuous 无害；其余五个有害。", contrastGroups: [{ label: "无害的", tone: "blue", words: ["benign", "innocuous"] }, { label: "有害的", tone: "pink", words: ["noxious", "pernicious", "deleterious", "detrimental", "corrosive"] }] },
      { title: "cur = run", count: "4+6", kind: "root", words: words("incursion", "precursor", "forerunner", "cursory", "perfunctory", "hasty", "discursive", "digress", "transgress", "violate"), note: "不走心的：cursory / perfunctory / hasty；违反：transgress / violate。", logicLinks: [{ from: "precursor", to: "forerunner", label: "同义", detail: "都表示先驱、先兆" }, { from: "cursory", to: "perfunctory", label: "同义", detail: "都可表示草率、不走心" }, { from: "cursory", to: "hasty", label: "同义", detail: "都可表示仓促、草率" }, { from: "discursive", to: "digress", label: "词根联结", detail: "都带有偏离主题、离题的方向" }, { from: "transgress", to: "violate", label: "同义", detail: "都表示违反、违背" }] },
    ],
  },
  {
    id: "9-1",
    list: 9,
    part: 1,
    branches: [
      { title: "min = jut", count: "3", kind: "root", words: words("prominent", "eminent", "imminent") },
      { title: "clud / clus = close", count: "4", kind: "root", words: words("occlude", "preclude", "inclusive", "exclusive") },
      { title: "prehend / prehens = seize", count: "5+3", kind: "root", words: words("comprehensive", "comprehend", "apprehensive", "apprehend", "deplorable", "reprehensible", "exhaustive", "encyclopedic"), note: "应受谴责的：deplorable / reprehensible。", logicLinks: [{ from: "comprehend", to: "comprehensive", label: "派生联结", detail: "comprehend 理解、包括 → comprehensive 全面的" }, { from: "apprehend", to: "apprehensive", label: "派生联结", detail: "apprehend 理解、逮捕 → apprehensive 忧虑的" }, { from: "deplorable", to: "reprehensible", label: "同义", detail: "都表示应受谴责的" }, { from: "exhaustive", to: "encyclopedic", label: "同义", detail: "都可表示全面、详尽" }] },
      { title: "短暂的", count: "6", kind: "meaning", words: words("transient", "transitory", "ephemeral", "evanescent", "fleeting", "momentary") },
      { title: "持久的", count: "3+1", kind: "meaning", words: words("eternal", "abiding", "enduring", "obdurate"), relation: "enduring ↔ obdurate（词形联结）", logicLinks: [{ from: "enduring", to: "obdurate", label: "形近不同义", detail: "enduring 持久的；obdurate 顽固的" }] },
    ],
  },
  {
    id: "9-2",
    list: 9,
    part: 2,
    branches: [
      { title: "形近词-2", count: "3+1", kind: "form", words: words("ingenious", "ingenuous", "disingenuous", "naïve"), note: "ingenious / ingenuous / disingenuous 形近；naïve 与 ingenuous 同义。", logicLinks: [{ from: "ingenious", to: "ingenuous", label: "形近不同义", detail: "ingenious 聪明有创造力的；ingenuous 天真的" }, { from: "ingenuous", to: "disingenuous", label: "派生联结", detail: "ingenuous 天真的；disingenuous 不真诚的、装天真的" }, { from: "ingenuous", to: "naïve", label: "同义", detail: "都可表示天真、缺乏经验" }] },
      { title: "形近词-1", count: "3+1", kind: "form", words: words("discrete", "discreet", "compulsory", "discretionary"), note: "自主决定 vs 强制的：discretionary ↔ compulsory。", logicLinks: [{ from: "discrete", to: "discreet", label: "形近不同义", detail: "分离的 ↔ 谨慎的" }, { from: "compulsory", to: "discretionary", label: "反义", detail: "强制的 ↔ 自主决定的" }] },
      { title: "话多啰嗦的", count: "5", kind: "meaning", words: words("voluble", "garrulous", "loquacious", "verbose", "prolix") },
      { title: "话少简洁的", count: "8", kind: "meaning", words: words("taciturn", "reticent", "laconic", "reserved", "succinct", "terse", "pithy", "concise") },
      { title: "cis = cut", count: "2+2", kind: "root", words: words("decisive", "incisive", "trenchant", "entrenched"), note: "incisive / trenchant 表示犀利；trenchant ↔ entrenched。", logicLinks: [{ from: "incisive", to: "trenchant", label: "同义", detail: "都可表示犀利、尖锐" }, { from: "trenchant", to: "entrenched", label: "形近不同义", detail: "犀利的 ↔ 根深蒂固的" }] },
    ],
  },
  {
    id: "10-1",
    list: 10,
    part: 1,
    branches: [
      { title: "好斗的", count: "2+1", kind: "meaning", words: words("belligerent", "truculent", "pugnacious", "impugn"), relation: "pugn = fight：pugnacious → impugn", logicLinks: [{ from: "pugnacious", to: "impugn", label: "词根联结", detail: "pugnacious 好斗的；沿 pugn = fight 联结到 impugn（指责、质疑）" }] },
      { title: "-acious = too much", count: "6+2", kind: "root", words: words("pugnacious", "veracious", "mendacious", "tenacious", "rapacious", "avaricious", "voracious"), note: "贪婪的：rapacious / avaricious / voracious。", relation: "pugnacious 同时接入下一组“好斗的”", logicLinks: [{ from: "rapacious", to: "avaricious", label: "同义", detail: "都表示贪婪的" }, { from: "avaricious", to: "voracious", label: "同义", detail: "voracious 可由“狼吞虎咽”引申为贪婪" }] },
      { title: "形近词", count: "3+2", kind: "form", words: words("covet", "clandestine", "surreptitious", "covert", "overt"), note: "covet 与 covert 形近但含义不同；covert 再联结两个“秘密的”同义词和反义词 overt。", logicLinks: [{ from: "covet", to: "covert", label: "形近不同义", detail: "covet 渴求；covert 秘密的、隐藏的" }, { from: "covert", to: "clandestine", label: "同义", detail: "都表示秘密、暗中的" }, { from: "covert", to: "surreptitious", label: "同义", detail: "都表示秘密、隐藏的" }, { from: "covert", to: "overt", label: "反义", detail: "隐藏的 ↔ 公开明显的" }] },
      { title: "可塑的，易受影响的", count: "2", kind: "meaning", words: words("plastic", "malleable") },
      { title: "客观中立的", count: "3", kind: "meaning", words: words("evenhanded", "impartial", "objective") },
      { title: "主观偏见的", count: "2", kind: "meaning", words: words("subjective", "partisan") },
      { title: "混合物", count: "3", kind: "meaning", words: words("hodgepodge", "pastiche", "patchwork") },
    ],
  },
  {
    id: "10-2",
    list: 10,
    part: 2,
    branches: [
      { title: "胆小的", count: "3", kind: "meaning", words: words("timid", "timorous", "diffident") },
      { title: "忽视", count: "1", kind: "meaning", words: words("disregard"), relation: "与“鄙视，轻视”辨析" },
      { title: "鄙视，轻视", count: "5", kind: "meaning", words: words("slight", "pejorative", "contemptuous", "disdain", "scorn") },
      { title: "夸张，夸张的", count: "5", kind: "meaning", words: words("exaggerate", "hyperbole", "overstate", "overblown", "inflated"), note: "over- 系列：overstate / overblown。", logicLinks: [{ from: "overstate", to: "overblown", label: "词根联结", detail: "over- 表示过度，两词都指夸大" }] },
      { title: "under- 系列", count: "4", kind: "root", words: words("understatement", "underrate", "undercut", "undermine"), relation: "与 over- 系列对照" },
      { title: "多元混合的", count: "5+2", kind: "meaning", words: words("eclectic", "heterogeneous", "motley", "disparate", "divergent", "disparage", ["monolithic", "大一统的"]), note: "前五个表示多元、混合或不同；disparage 是形近辅助词；monolithic 是反向对照。", logicLinks: [{ from: "disparate", to: "disparage", label: "形近不同义", detail: "disparate 不同的；disparage 贬低、轻视" }, { from: "disparate", to: "monolithic", label: "反义", detail: "多元不同 ↔ 大一统" }] },
    ],
  },
  {
    id: "11-1",
    list: 11,
    part: 1,
    branches: [
      { title: "精明的", count: "2", kind: "meaning", words: words("shrewd", "canny") },
      { title: "熟练灵巧的", count: "4", kind: "meaning", words: words("agile", "adroit", "deft", "proficient") },
      { title: "笨重的", count: "0.5+5", kind: "meaning", words: words("awkward", "clumsy", "ungainly", "unwieldy", "cumbersome", "ponderous"), relation: "ponderous 同时关联“乏味无聊的”" },
      { title: "乏味无聊的", count: "13+0.5", kind: "meaning", words: words("bland", "banal", "dull", "dreary", "vapid", "insipid", "jejune", "tedious", "monotonous", "humdrum", "pedestrian", "mundane", "prosaic", "ponderous") },
    ],
  },
  {
    id: "11-2",
    list: 11,
    part: 2,
    branches: [
      { title: "简单直率的", count: "4", kind: "meaning", words: words("straightforward", "forthright", "blunt", "plainspoken") },
      { title: "复杂的", count: "8", kind: "meaning", words: words("convoluted", "complicated", "complex", "knotty", "intricate", "elaborate", "byzantine", "baroque"), relation: "与“简单直率的”对照" },
      { title: "不重要的", count: "9", kind: "meaning", words: words("trivial", "trifling", "negligible", "marginal", "peripheral", "tangent", "extraneous", "immaterial", "irrelevant") },
      { title: "相关重要的", count: "3", kind: "meaning", words: words("relevant", "germane", "pertain"), relation: "与“不重要的”对照" },
      { title: "多产的", count: "2", kind: "meaning", words: words("fecund", "fertile") },
    ],
  },
  {
    id: "12-1",
    list: 12,
    part: 1,
    branches: [
      { title: "拍马屁", count: "4", kind: "meaning", words: words("adulate", "flatter", "sycophantic", "obsequious") },
      { title: "革命性的", count: "2", kind: "meaning", words: words("revolutionary", "transformative") },
      { title: "预示", count: "5", kind: "meaning", words: words("presage", "portend", "prefigure", "prescient", "prophetic") },
      { title: "催眠的", count: "3", kind: "meaning", words: words("soporific", "somnolent", "lethargic") },
      { title: "声望", count: "2", kind: "meaning", words: words("prestige", "cachet") },
      { title: "真 VS 假", count: "6", kind: "contrast", words: words(["genuine", "真的"], ["feigned", "假的"], ["spurious", "假的"], ["specious", "假的"], ["artificial", "假的"], ["forge", "伪造"]), note: "genuine 为真；其余词表示假、伪装或伪造。", contrastGroups: [{ label: "真的", tone: "blue", words: ["genuine"] }, { label: "假的 / 伪造", tone: "pink", words: ["feigned", "spurious", "specious", "artificial", "forge"] }] },
    ],
  },
  {
    id: "12-2",
    list: 12,
    part: 2,
    branches: [
      { title: "肤浅的", count: "2", kind: "meaning", words: words("superficial", "facile") },
      { title: "多余的", count: "2+1", kind: "form", words: words("affluent", "superfluous", "redundant"), note: "flu = flow：affluent 与 superfluous 用词根联结；superfluous / redundant 表示多余。", logicLinks: [{ from: "affluent", to: "superfluous", label: "词根联结", detail: "flu = flow；affluent 富裕的，superfluous 多余的" }, { from: "superfluous", to: "redundant", label: "同义", detail: "都表示多余、冗余" }] },
      { title: "大量丰富的", count: "5", kind: "meaning", words: words("abundant", "myriad", "profusion", "numerous", "ample") },
      { title: "稀缺不足的", count: "4", kind: "meaning", words: words("paltry", "meager", "scant", "exiguous"), relation: "与“大量丰富的”对照" },
      { title: "矛盾对立的", count: "4+1", kind: "meaning", words: words("paradoxical", "antithetical", "contradict", "ironic", "irenic"), note: "前四个表示矛盾、对立；irenic 是形近辅助词。", logicLinks: [{ from: "ironic", to: "irenic", label: "形近不同义", detail: "ironic 讽刺的；irenic 和平的、促和的" }] },
      { title: "危险的", count: "3", kind: "meaning", words: words("precarious", "perilous", "hazardous", "haphazard"), relation: "hazardous ↔ haphazard", logicLinks: [{ from: "hazardous", to: "haphazard", label: "形近不同义", detail: "hazardous 危险的；haphazard 随意、杂乱的" }] },
      { title: "随机任意的", count: "2", kind: "meaning", words: words("haphazard", "arbitrary") },
      { title: "傲慢的", count: "3", kind: "meaning", words: words("arrogant", "overbearing", "hubris") },
    ],
  },
  {
    id: "13-1",
    list: 13,
    part: 1,
    branches: [
      {
        title: "敌对的",
        count: "4",
        kind: "meaning",
        words: words(
          { word: "inimical", memory: "enemy 的元音都换成 i：enemy → inimical；敌人的 → 敌对的。", synonyms: "antagonistic；adversarial；adverse", relatedWords: "inimical to…：对……不利", example: "inimical to innovation 对创新不利" },
          { word: "hostile", memory: "谐音“害死它”：想伤害它，双方就是敌对关系。", synonyms: "antagonistic；inhospitable", relatedWords: "hostility n. 敌意；inhospitable adj. 不友好的／不宜居住的", example: "hostile to the idea of change 反对改变的想法" },
          { word: "antagonistic", memory: "anti = 反 + agony = 痛苦：反对你又让你痛苦 → 敌对的。", synonyms: "inimical；adversarial；competing（冲突的）", relatedWords: "注意 competing 是“冲突、对立的”，不是 competitive“有竞争力的”" },
          { word: "adversarial", memory: "adversary = 对手；对手之间的关系 → 敌对的。", synonyms: "antagonistic", relatedWords: "adversary n. 对手；来自 vers = turn" },
        ),
        relation: "adversarial → vers = turn",
      },
      {
        title: "vers = turn",
        count: "5+1",
        kind: "root",
        words: words(
          { word: "adverse", memory: "ad = 朝向 + vers = 转：转到反面 → 不利的。", synonyms: "unfavorable；inimical", relatedWords: "adversary n. 对手；adversity n. 逆境；adversarial adj. 敌对的", example: "adverse effects 不良影响／副作用" },
          { word: "reversal", memory: "re = back + vers = turn：转回去 → 逆转、反转。", relatedWords: "reverse v. 逆转", example: "a reversal of fortune 命运逆转" },
          { word: "subversive", memory: "sub = under + vers = turn：从下面翻转、把上面拉下来 → 颠覆性的。", synonyms: "seditious；iconoclastic", relatedWords: "subvert v. 颠覆；subversion n. 颠覆", example: "subversive ideas 颠覆性的理念" },
          { word: "conversant", memory: "con = 加强 + vers = 转：某件事玩得转 → 熟悉的。", synonyms: "familiar；versed", relatedWords: "conversant with…：熟悉……", example: "conversant with the procedure 熟悉流程" },
          { word: "versatile", memory: "vers = turn：许多领域都玩得转 → 多才多艺的。", synonyms: "protean；all-around；adaptable", example: "a versatile actor 多才多艺的演员" },
          { word: "protean", memory: "Proteus 是会变形的希腊神：能不断变化 → 善变；能适应多领域 → 多才多艺。", synonyms: "versatile；adaptable", relatedWords: "兼有“多才多艺的”和“善变的”两个义项" },
        ),
        note: "versatile / protean：多才多艺；protean 还可表示善变。",
        logicLinks: [{ from: "versatile", to: "protean", label: "同义", detail: "都可表示多才多艺；protean 还可表示善变" }],
      },
      {
        title: "善变的",
        count: "6",
        kind: "meaning",
        words: words(
          { word: "fickle", memory: "谐音“飞快”：变化得飞快 → 善变的。", synonyms: "capricious；unpredictable", relatedWords: "fickleness n. 反复无常" },
          { word: "whimsical", memory: "whim = 突发奇想、心血来潮；一会一个想法 → 善变的。", synonyms: "capricious；inconstant", relatedWords: "whim n. 突发奇想" },
          { word: "capricious", memory: "capr = goat；山羊突然跳来跳去 → 任性、反复无常。", synonyms: "whimsical；mercurial；fickle；volatile", relatedWords: "caprice n. 任性、反复无常" },
          { word: "mercurial", memory: "Mercury（水银／墨丘利）流动变化快 → 善变的。", synonyms: "volatile；erratic", example: "a mercurial personality 善变的性格" },
          { word: "mutable", memory: "mut = change；联想 mutation“变异” → 可变的、易变的。", synonyms: "fluid；changeable", relatedWords: "mutation n. 变异；immutable adj. 不变的（反义）" },
          { word: "volatile", memory: "原指化学性质不稳定、易挥发；引申为善变、波动。", synonyms: "mercurial；capricious", relatedWords: "volatility n. 波动性", example: "a volatile market 动荡的市场" },
        ),
        relation: "与 imperturbable 形成记忆对照",
      },
      {
        title: "turb = stir",
        count: "3",
        kind: "root",
        words: words(
          { word: "imperturbable", memory: "im = not + perturb = 扰乱：不受外界扰动 → 淡定、情绪稳定。", synonyms: "unflappable；unruffled；composed", relatedWords: "perturb v. 扰乱" },
          { word: "turbid", memory: "turb = stir：水被搅动后变浑 → 浑浊的。", synonyms: "muddy；murky", relatedWords: "易混：turgid 浮夸难懂的；torrid 酷热的／热情的", example: "turbid water 浑浊的水" },
          { word: "turbulent", memory: "turb = stir：社会被反复搅动 → 动荡、混乱的。", synonyms: "tumultuous；chaotic", example: "turbulent times 动荡时期" },
        ),
      },
      {
        title: "驱逐",
        count: "3",
        kind: "meaning",
        words: words(
          { word: "banish", memory: "ban = 禁止；禁止进入 → 驱逐。", synonyms: "expel；oust", relatedWords: "还可表示“打消（疑虑／担心）”", example: "banish doubts 打消疑虑" },
          { word: "oust", memory: "联想 out：让人出去；也可指把掌权者赶下台。", synonyms: "expel；banish", example: "oust someone from office 把某人赶下台" },
          { word: "expel", memory: "ex = out + pel = push：向外推 → 驱逐、开除。", synonyms: "oust；banish", relatedWords: "pel = push；compel v. 迫使", example: "expel someone from school 开除某人" },
        ),
      },
      {
        title: "爱说教的",
        count: "2",
        kind: "meaning",
        words: words(
          { word: "preachy", memory: "preach = 布道；像牧师一样不断讲道德 → 爱说教的。", synonyms: "didactic；moralizing", relatedWords: "通常为贬义" },
          { word: "didactic", memory: "谐音联想“爹” + act“做事”：爹味地教你做事 → 爱说教的。", synonyms: "preachy；moralizing", relatedWords: "didacticism n. 说教", example: "didactic literature 说教意味很强的文学" },
        ),
      },
    ],
  },
  {
    id: "13-2",
    list: 13,
    part: 2,
    branches: [
      {
        title: "阻碍",
        count: "5",
        kind: "meaning",
        words: words(
          { word: "hamper", memory: "hamper 还指大篮子；篮子堵在路上 → 阻碍。", synonyms: "hinder；impede；encumber", relatedWords: "hamper n. 大篮子", example: "be hampered by a lack of funds 因缺少资金而受阻" },
          { word: "hinder", memory: "hind = behind：把进度往后拖 → 阻碍。", synonyms: "hamper；impede；stymie", relatedWords: "hindrance n. 阻碍", example: "hinder communication 阻碍交流" },
          { word: "handicap", memory: "赛马给强马增加负重，使它更难跑 → 阻碍。", synonyms: "hamper；hinder；impede", relatedWords: "还可表示“残障；不利条件”", example: "handicap development 阻碍发展" },
          { word: "impede", memory: "ped = foot：给脚戴上镣铐，走不快 → 阻碍。", synonyms: "hinder；hamper", relatedWords: "impediment n. 阻碍；ped = foot", example: "impede innovation 阻碍创新" },
          { word: "encumber", memory: "cumb = lie：大石头躺在路上挡道 → 阻碍。", synonyms: "hamper；impede", relatedWords: "cumbersome adj. 笨重的；unencumbered by… 不受……阻碍" },
        ),
        note: "阻碍 = 让进程变慢或更困难；不能和“阻止（完全停下）”混作同义词。",
      },
      {
        title: "阻止",
        count: "2+2",
        kind: "form",
        words: words(
          { word: "forestall", memory: "fore = before + stall = 停：提前让它停下 → 预先阻止。", synonyms: "prevent；preclude；deter", relatedWords: "avert；stave off", example: "forestall a disaster 预防灾难" },
          { word: "deter", memory: "ter = frighten：把人吓住，不敢行动 → 阻止。", synonyms: "prevent；preclude", relatedWords: "deterrent n. 威慑物／威慑力", example: "deter violence 遏止暴力" },
          { word: "defer", memory: "fer = bring：把事情往后放 → 推迟；把自己往后放 → 遵从。", synonyms: "postpone（推迟）；submit／yield（遵从）", relatedWords: "deference n. 遵从、敬意；deferrable adj. 可延期的", example: "defer a meeting；defer to your parents" },
          { word: "deferential", memory: "defer“遵从” + -ential：对别人毕恭毕敬、顺从的。", synonyms: "respectful", relatedWords: "deference n. 敬意；注意 respectful 是“尊敬别人的”，不是 respected“受尊敬的”" },
        ),
        note: "deter 表示阻止；defer / deferential 是形近词，不属于“阻止”义。",
        logicLinks: [{ from: "forestall", to: "deter", label: "同义", detail: "都表示阻止、预先制止" }, { from: "deter", to: "defer", label: "形近不同义", detail: "deter 阻止；defer 推迟、遵从" }, { from: "defer", to: "deferential", label: "派生联结", detail: "defer 的“遵从”义 → deferential 恭敬的" }],
      },
      {
        title: "倾向，偏好",
        count: "5",
        kind: "meaning",
        words: words(
          { word: "disposition", memory: "dis = 分开 + posit = 放置：位置摆定 → 性情、倾向。", synonyms: "inclination；predisposition；proclivity", relatedWords: "position n. 位置" },
          { word: "orientation", memory: "orient = 东方／定向；方向确定 → 倾向、取向。", synonyms: "inclination；bias（偏好义）", relatedWords: "orient v. 定向", example: "sexual orientation 性取向" },
          { word: "predilection", memory: "pre = before + lect = choose：提前选好喜欢的 → 偏爱。", synonyms: "preference；partiality；proclivity", example: "a predilection for jazz 对爵士乐的偏爱" },
          { word: "penchant", memory: "谐音“捧场”：喜欢才去捧场 → 偏爱。", synonyms: "liking；inclination；preference", example: "a penchant for sweets 对甜食的偏爱" },
          { word: "proclivity", memory: "pro = forward + cliv = slope：沿坡自然向前 → 自然倾向。", synonyms: "predilection；affinity；disposition", relatedWords: "通常表示较固定的倾向，常跟不良倾向搭配", example: "a proclivity toward violence 暴力倾向" },
        ),
      },
      {
        title: "证实 VS 证伪",
        count: "3+1",
        kind: "contrast",
        words: words(
          { word: "substantiate", gloss: "证实", memory: "substance = 实质性证据；拿出实据 → 证实。", synonyms: "confirm；verify", example: "be substantiated by data 被数据证实" },
          { word: "authenticate", gloss: "证实", memory: "authentic = 真的；证明某物是真的 → 鉴定、证实。", synonyms: "verify；substantiate", relatedWords: "authentic adj. 真实的", example: "authenticate a manuscript 鉴定手稿真伪" },
          { word: "corroborate", gloss: "证实", memory: "联想 robust“坚固”：把证据加固 → 证实。", synonyms: "confirm；document；verify", example: "corroborated by evidence 得到证据证实" },
          { word: "debunk", gloss: "证伪", memory: "看到 myth／legend／misinformation，想到 debunk：拆穿、证伪。", synonyms: "refute；disprove；discredit", relatedWords: "常见搭配：debunk a myth／legend／misinformation" },
        ),
        contrastGroups: [{ label: "证实", tone: "pink", words: ["substantiate", "authenticate", "corroborate"] }, { label: "证伪", tone: "blue", words: ["debunk"] }],
      },
      {
        title: "居无定所的",
        count: "2",
        kind: "meaning",
        words: words(
          { word: "itinerant", memory: "it = walk：从一个地方走到另一个地方 → 巡游、居无定所。", synonyms: "peripatetic；nomadic", relatedWords: "修饰人、职业或生活方式", example: "an itinerant lifestyle 居无定所的生活" },
          { word: "peripatetic", memory: "peri = around + pat = walk：四处走 → 巡游、居无定所。", synonyms: "itinerant；nomadic", relatedWords: "修饰人、职业或生活方式", example: "a peripatetic career 四处奔走的职业生涯" },
        ),
      },
      {
        title: "正直",
        count: "3",
        kind: "meaning",
        words: words(
          { word: "integrity", memory: "integer = 完整；人格完整、表里如一 → 正直。", synonyms: "probity；rectitude；honesty", example: "academic integrity 学术诚信" },
          { word: "probity", memory: "prob / prov = prove：人品经得住检验 → 正直。", synonyms: "integrity；rectitude；honesty", example: "financial probity 财务诚信" },
          { word: "scrupulous", memory: "联想“思顾”：反复顾及道德 → 正直；反复顾及细节 → 仔细认真。", synonyms: "honest；meticulous；punctilious", relatedWords: "scruple n. 顾虑；unscrupulous adj. 不道德的", example: "scrupulous attention 仔细的关注" },
        ),
        relation: "scrupulous 兼有“正直的”和“仔细认真的”两个义项",
      },
      {
        title: "仔细认真的",
        count: "2+1",
        kind: "form",
        words: words(
          { word: "meticulous", memory: "抓住 extremely careful：连格式、对齐等小细节都检查 → 一丝不苟。", synonyms: "exact；thorough；painstaking；scrupulous；fastidious；punctilious", example: "meticulous attention to detail 对细节极其认真" },
          { word: "compunction", memory: "com = 加强 + punct = 针刺：内心像被针扎 → 内疚、后悔。", synonyms: "scruple；misgiving", relatedWords: "常与 no／without 连用", example: "lie without compunction 撒谎而毫无愧疚" },
          { word: "punctilious", memory: "punct = prick（针刺）：连针尖大小的细节都关注 → 一丝不苟。", synonyms: "meticulous；scrupulous", relatedWords: "punct = prick；联想 acupuncture“针灸”" },
        ),
        note: "punct = prick：punctilious 关注针尖般的小细节；compunction 是内心被针扎的愧疚。",
        logicLinks: [{ from: "compunction", to: "punctilious", label: "词根联结", detail: "punct = prick；compunction 内疚，punctilious 一丝不苟的" }],
      },
    ],
  },
  {
    id: "14-1",
    list: 14,
    part: 1,
    branches: [
      { title: "ambi = both", count: "2", kind: "root", words: words("ambivalent", "ambiguous", "equivocal"), relation: "ambiguous ↔ equivocal", logicLinks: [{ from: "ambiguous", to: "equivocal", label: "同义", detail: "都可表示模糊、不确定、模棱两可" }] },
      { title: "voc = call", count: "3", kind: "root", words: words("equivocal", "provocative", "advocate"), relation: "advocate → 支持 VS 阻挠" },
      { title: "支持 VS 阻挠", count: "2+1", kind: "contrast", words: words(["endorse", "支持"], ["espouse", "支持"], ["thwart", "阻挠"]), contrastGroups: [{ label: "支持", tone: "blue", words: ["endorse", "espouse"] }, { label: "阻挠", tone: "pink", words: ["thwart"] }] },
      { title: "奇怪的", count: "4", kind: "meaning", words: words("peculiar", "quirky", "eccentric", "erratic") },
      { title: "异常的", count: "2", kind: "meaning", words: words("anomalous", "atypical") },
      { title: "放弃", count: "6", kind: "meaning", words: words("recant", "jettison", "relinquish", "forgo", "forsake", "abandon") },
      { title: "吸引人的", count: "2", kind: "meaning", words: words("absorbing", "gripping") },
      { title: "模仿", count: "3", kind: "meaning", words: words("emulate", "imitate", "mimic") },
    ],
  },
  {
    id: "14-2",
    list: 14,
    part: 2,
    branches: [
      { title: "强的 VS 弱的", count: "1+3", kind: "contrast", words: words(["robust", "强健的"], ["feeble", "虚弱的"], ["frail", "虚弱的"], ["fragile", "脆弱的"]), contrastGroups: [{ label: "强的", tone: "blue", words: ["robust"] }, { label: "弱的", tone: "pink", words: ["feeble", "frail", "fragile"] }] },
      { title: "可感知的 VS 难感知的", count: "3+1", kind: "contrast", words: words("palpable", "tangible", "appreciable", "imperceptible"), note: "前三个可感知；imperceptible 难以感知。", contrastGroups: [{ label: "可感知的", tone: "blue", words: ["palpable", "tangible", "appreciable"] }, { label: "难感知的", tone: "pink", words: ["imperceptible"] }] },
      { title: "显眼的", count: "4", kind: "meaning", words: words("salient", "patent", "conspicuous", "flagrant") },
      { title: "分等级的", count: "2", kind: "meaning", words: words("stratified", "hierarchical") },
      { title: "内在的", count: "2+2", kind: "form", words: words("coherent", "adhere", "inherent", "intrinsic"), note: "coherent / adhere / inherent 为词形联结；inherent / intrinsic 表示内在。", logicLinks: [{ from: "coherent", to: "adhere", label: "词根联结", detail: "her = stick；coherent 连贯的，adhere 坚持、黏附" }, { from: "adhere", to: "inherent", label: "词根联结", detail: "共同含有 her = stick" }, { from: "inherent", to: "intrinsic", label: "同义", detail: "都表示内在的、固有的" }] },
      { title: "激怒", count: "3", kind: "meaning", words: words("exasperate", "vex", "irk"), relation: "与“愿意和解的”形成对照" },
      { title: "愿意和解的", count: "2+2", kind: "form", words: words("implacable", "complacent", "placatory", "conciliatory"), note: "placatory / conciliatory 表示愿意和解；implacable / complacent 用词形联结。", logicLinks: [{ from: "placatory", to: "conciliatory", label: "同义", detail: "都表示安抚的、愿意和解的" }, { from: "implacable", to: "complacent", label: "形近不同义", detail: "implacable 难以平息的；complacent 自满的" }] },
    ],
  },
  {
    id: "15-1",
    list: 15,
    part: 1,
    branches: [
      { title: "乐观自信的 VS 不乐观的", count: "2+1", kind: "contrast", words: words(["sanguine", "乐观自信"], ["upbeat", "乐观"], ["bleak", "不乐观"]), contrastGroups: [{ label: "乐观自信的", tone: "blue", words: ["sanguine", "upbeat"] }, { label: "不乐观的", tone: "pink", words: ["bleak"] }] },
      { title: "冷漠的", count: "4", kind: "meaning", words: words("phlegmatic", "apathetic", "nonchalant", "indifferent"), relation: "与“狂热的，热情的”对照" },
      { title: "狂热的，热情的", count: "4", kind: "meaning", words: words("zealous", "fervent", "effusive", "exuberant") },
      { title: "易怒的 VS 容易相处的", count: "4+1+1", kind: "contrast", words: words(["affable", "容易相处"], ["factious", "派系的、制造分裂的（形近词）"], ["fractious", "易怒、难驾驭"], ["fiery", "热情的、易怒的"], ["irascible", "易怒"], ["choleric", "易怒"]), note: "affable 容易相处；fractious / fiery / irascible / choleric 易怒；factious 是由 fractious 引出的形近词，表示派系性、制造分裂。", logicLinks: [{ from: "fractious", to: "factious", label: "形近不同义", detail: "fractious 易怒、难驾驭；factious 派系性、制造分裂" }], contrastGroups: [{ label: "容易相处的", tone: "blue", words: ["affable"] }, { label: "易怒的", tone: "pink", words: ["fractious", "fiery", "irascible", "choleric"] }] },
      { title: "忧伤 VS 令人愉悦的", count: "1+2", kind: "contrast", words: words(["melancholy", "忧伤"], ["delightful", "令人愉悦"], ["agreeable", "令人愉悦"]), contrastGroups: [{ label: "忧伤", tone: "blue", words: ["melancholy"] }, { label: "令人愉悦", tone: "pink", words: ["delightful", "agreeable"] }] },
      { title: "吉利的", count: "2", kind: "meaning", words: words("auspicious", "propitious") },
      { title: "有益健康的", count: "4", kind: "meaning", words: words("restorative", "tonic", "salubrious", "salutary") },
    ],
  },
  {
    id: "15-2",
    list: 15,
    part: 2,
    branches: [
      { title: "费力繁重的", count: "6", kind: "meaning", words: words("laborious", "taxing", "burdensome", "onerous", "demanding", "exacting") },
      { title: "引发争论的 VS 无可质疑的", count: "4+1", kind: "contrast", words: words(["polemical", "引发争论"], ["controversial", "引发争论"], ["contentious", "引发争论"], ["divisive", "引发争论"], ["incontrovertible", "无可质疑"]), contrastGroups: [{ label: "引发争论的", tone: "blue", words: ["polemical", "controversial", "contentious", "divisive"] }, { label: "无可质疑的", tone: "pink", words: ["incontrovertible"] }] },
      { title: "减轻，缓和", count: "10+1", kind: "root", words: words("tenuous", "attenuate", "soothe", "moderate", "palliate", "abate", "allay", "mitigate", "mollify", "alleviate", "assuage"), note: "tenuous 本身表示薄弱；由 tenu = thin 联结 attenuate“使变弱、减轻”，再扩展到其余缓和词。", logicLinks: [{ from: "tenuous", to: "attenuate", label: "词根联结", detail: "tenu = thin；tenuous 薄弱的，attenuate 使变弱、减轻" }] },
      { title: "可渗透的", count: "2", kind: "meaning", words: words("porous", "permeable") },
    ],
  },
  {
    id: "16-1",
    list: 16,
    part: 1,
    branches: [
      { title: "谴责", count: "12+1", kind: "form", words: words("censor", "censure", "decry", "denounce", "excoriate", "harangue", "invective", "diatribe", "rant", "lambast", "scold", "castigate", "condemn"), note: "censor ↔ censure 是形近词；其余词集中记“谴责、痛斥”。", logicLinks: [{ from: "censor", to: "censure", label: "形近不同义", detail: "censor 审查；censure 强烈谴责" }] },
      { title: "本地的 VS 入侵者", count: "2", kind: "contrast", words: words(["indigenous", "本地的"], ["interloper", "入侵者"]), contrastGroups: [{ label: "本地的", tone: "blue", words: ["indigenous"] }, { label: "入侵者", tone: "pink", words: ["interloper"] }] },
      { title: "诈骗，欺诈", count: "3+2", kind: "form", words: words("deception", "fraud", "duplicity", "duplicate", "replicate"), note: "deception / fraud / duplicity 表示欺诈；再由 duplicity 沿 plic = fold 联结复制词。", logicLinks: [{ from: "duplicity", to: "duplicate", label: "词根联结", detail: "plic = fold；duplicity 欺骗，duplicate 复制" }, { from: "duplicate", to: "replicate", label: "同义", detail: "都可表示复制" }] },
      { title: "繁荣，兴旺", count: "2", kind: "meaning", words: words("flourish", "thrive") },
      { title: "令人恐惧的", count: "2", kind: "meaning", words: words("formidable", "daunting") },
      { title: "模糊不清的", count: "2", kind: "meaning", words: words("nebulous", "vague") },
      { title: "vac = empty", count: "2", kind: "root", words: words("vacant", "vacuous") },
    ],
  },
  {
    id: "16-2",
    list: 16,
    part: 2,
    branches: [
      { title: "前所未有的 VS 陈词滥调", count: "1+2", kind: "contrast", words: words(["unprecedented", "前所未有"], ["platitude", "陈词滥调"], ["cliché", "陈词滥调"]), contrastGroups: [{ label: "前所未有的", tone: "blue", words: ["unprecedented"] }, { label: "陈词滥调", tone: "pink", words: ["platitude", "cliché"] }] },
      { title: "未被破坏的", count: "2", kind: "meaning", words: words("unblemished", "pristine") },
      { title: "没有根据的", count: "3", kind: "meaning", words: words("unfounded", "unwarranted", "untenable") },
      { title: "爱炫耀的 VS 低调的", count: "2", kind: "contrast", words: words(["pretentious", "爱炫耀"], ["unostentatious", "低调"]), contrastGroups: [{ label: "爱炫耀的", tone: "blue", words: ["pretentious"] }, { label: "低调的", tone: "pink", words: ["unostentatious"] }] },
      { title: "赞扬", count: "7", kind: "meaning", words: words("hail", "extol", "exalt", "acclaim", "accolade", "encomium", "tribute") },
      { title: "平凡普通的", count: "2", kind: "meaning", words: words("unremarkable", "unexceptional") },
      { title: "dox = opinion", count: "3", kind: "root", words: words("orthodox", "unorthodox", "heterodox") },
    ],
  },
  {
    id: "17-1",
    list: 17,
    part: 1,
    branches: [
      { title: "加剧，恶化", count: "2", kind: "meaning", words: words("exacerbate", "aggravate") },
      { title: "类似的", count: "2", kind: "meaning", words: words("analogous", "comparable") },
      { title: "保守不变的", count: "2", kind: "meaning", words: words("conservative", "hidebound") },
      { title: "消灭，根除", count: "2", kind: "meaning", words: words("eradicate", "eliminate") },
      { title: "nym = name", count: "2", kind: "root", words: words("synonymous", "anonymous") },
      { title: "担心，不安", count: "2", kind: "meaning", words: words("misgiving", "trepidation") },
      { title: "鲁莽草率的", count: "5+1", kind: "form", words: words("reckless", "reckon", "impetuous", "madcap", "impulsive", "audacious"), note: "reckless ↔ reckon 词形联结；其余词集中记“鲁莽、冲动”。", logicLinks: [{ from: "reckless", to: "reckon", label: "形近不同义", detail: "reckless 鲁莽的；reckon 认为、计算" }] },
      { title: "与“马”有关", count: "3+1+1", kind: "form", words: words(["curb", "限制、约束"], ["bridle", "限制、约束"], ["rein", "限制、约束"], ["spur", "刺激、促进"], ["spurn", "鄙弃、拒绝（形近词）"]), note: "curb / bridle / rein 都由马具引申为“限制”；spur 是用马刺促进前进；spurn 再由 spur 引出的形近词，表示拒绝。", logicLinks: [{ from: "curb", to: "bridle", label: "同义", detail: "都由马具引申为限制、约束" }, { from: "bridle", to: "rein", label: "同义", detail: "都可表示勒住、控制" }, { from: "curb", to: "spur", label: "反义", detail: "curb 限制；spur 促进" }, { from: "spur", to: "spurn", label: "形近不同义", detail: "spur 激励、促进；spurn 鄙弃、拒绝" }], contrastGroups: [{ label: "限制", tone: "blue", words: ["curb", "bridle", "rein"] }, { label: "促进", tone: "pink", words: ["spur"] }] },
      { title: "拒绝", count: "3", kind: "meaning", words: words("spurn", "rebuff", "repudiate"), relation: "spurn 同时出现在形近词组" },
    ],
  },
  {
    id: "17-2",
    list: 17,
    part: 2,
    branches: [
      { title: "缺陷", count: "3", kind: "meaning", words: words("deficit", "defect", "blemish") },
      { title: "超越", count: "4", kind: "meaning", words: words("eclipse", "transcend", "outstrip", "overshadow") },
      { title: "明智的，敏锐的", count: "5", kind: "meaning", words: words("insightful", "discerning", "perceptive", "prudent", "judicious") },
      { title: "嘲笑", count: "3", kind: "meaning", words: words("mockery", "deride", "ridicule") },
      { title: "节俭", count: "2", kind: "meaning", words: words("thrift", "frugal") },
      { title: "小气", count: "2", kind: "meaning", words: words("stingy", "parsimonious") },
      { title: "大方", count: "3", kind: "meaning", words: words("unstinting", "liberal", "largesse") },
      { title: "挥霍", count: "3", kind: "meaning", words: words("extravagant", "lavish", "opulent") },
    ],
  },
  {
    id: "18-1",
    list: 18,
    part: 1,
    branches: [
      { title: "颠覆", count: "2", kind: "meaning", words: words("subvert", "upend") },
      { title: "阐明", count: "2", kind: "meaning", words: words("illuminate", "elucidate") },
      { title: "暂缓", count: "2", kind: "meaning", words: words("respite", "lull") },
      { title: "仁慈利他的", count: "2", kind: "meaning", words: words("altruistic", "benevolent") },
      { title: "剧烈 VS 克制", count: "3+1", kind: "contrast", words: words(["radical", "剧烈"], ["overhaul", "彻底改革"], ["upheaval", "剧变"], ["temperate", "克制"]), contrastGroups: [{ label: "剧烈", tone: "blue", words: ["radical", "overhaul", "upheaval"] }, { label: "克制", tone: "pink", words: ["temperate"] }] },
      { title: "完美无瑕的", count: "2", kind: "meaning", words: words("impeccable", "consummate") },
      { title: "司空见惯的", count: "2", kind: "meaning", words: words("quotidian", "commonplace") },
      { title: "极其神圣的", count: "2", kind: "meaning", words: words("inviolable", "sacrosanct") },
      { title: "易受伤的", count: "2", kind: "meaning", words: words("vulnerable", "susceptible") },
      { title: "勤奋的 VS 懒惰的", count: "2+2", kind: "contrast", words: words(["diligent", "勤奋"], ["assiduous", "勤奋"], ["sluggish", "懒惰"], ["inert", "懒惰"]), contrastGroups: [{ label: "勤奋的", tone: "blue", words: ["diligent", "assiduous"] }, { label: "懒惰的", tone: "pink", words: ["sluggish", "inert"] }] },
    ],
  },
  {
    id: "18-2",
    list: 18,
    part: 2,
    branches: [
      { title: "self- 相关", count: "2+1", kind: "root", words: words("self-evident", "perpetuate", "self-perpetuating"), logicLinks: [{ from: "perpetuate", to: "self-perpetuating", label: "派生联结", detail: "perpetuate 使持续；self-perpetuating 自我延续的" }] },
      { title: "合适的", count: "2", kind: "meaning", words: words("apposite", "apt") },
      { title: "崇敬", count: "3+1", kind: "form", words: words("defy", "deify", "revere", "venerate"), note: "defy ↔ deify 是形近词；revere / venerate 表示崇敬。", logicLinks: [{ from: "defy", to: "deify", label: "形近不同义", detail: "defy 反抗；deify 神化、崇拜" }, { from: "revere", to: "venerate", label: "同义", detail: "都表示尊敬、崇敬" }] },
      { title: "激增", count: "3", kind: "meaning", words: words("burgeon", "abound", "proliferate") },
      { title: "严厉的", count: "3+1", kind: "form", words: words("acute", "severe", "dour", "harsh"), note: "acute / severe 可表示严重；dour / harsh 表示严厉。", logicLinks: [{ from: "acute", to: "severe", label: "同义", detail: "都可表示严重、剧烈" }, { from: "dour", to: "harsh", label: "同义", detail: "都可表示严厉、冷峻" }] },
      { title: "免责", count: "2", kind: "meaning", words: words("exculpate", "exonerate") },
      { title: "坚定的", count: "2", kind: "meaning", words: words("unyielding", "staunch") },
      { title: "艰苦费力的", count: "2", kind: "meaning", words: words("strenuous", "arduous") },
      { title: "怀疑的", count: "2", kind: "meaning", words: words("dubious", "skeptical") },
      { title: "非凡的", count: "2", kind: "meaning", words: words("exceptional", "extraordinary") },
    ],
  },
  {
    id: "19-1",
    list: 19,
    part: 1,
    branches: [
      { title: "名词", count: "7", kind: "meaning", words: words("testimony", "windfall", "hallmark", "parity", "rationale", "exactitude", "asymmetry") },
      { title: "连词", count: "1", kind: "meaning", words: words("albeit") },
      { title: "形容词", count: "5", kind: "form", words: words("ignorant", "terminal", "equable", "equivalent", "sympathetic"), note: "equ = equal：equable ↔ equivalent。", logicLinks: [{ from: "equable", to: "equivalent", label: "词根联结", detail: "equ = equal；equable 平和稳定的，equivalent 等价的" }] },
      { title: "形容词", count: "14", kind: "form", words: words("incompatible", "indiscriminate", "inevitable", "unsettling", "assertive", "problematic", "startling", "depressing", "enviable", "wayward", "inflammatory", "slippery", "opportune", "homogeneous"), note: "前四个单独观察否定前缀。" },
    ],
  },
  {
    id: "19-2",
    list: 19,
    part: 2,
    branches: [
      { title: "动词组 A", count: "12", kind: "form", words: words(["glean", "提取、获得"], ["extract", "提取、获得"], ["misrepresent", "扭曲"], ["distort", "扭曲"], ["reinforce", "支持、加强"], ["bolster", "支持、加强"], ["buttress", "支持、加强"], ["demise", "衰退"], ["ebb", "衰退"], ["wane", "衰退"], ["decay", "衰退"], ["languish", "衰退"]), logicLinks: [{ from: "glean", to: "extract", label: "同义", detail: "都表示提取、获得" }, { from: "misrepresent", to: "distort", label: "同义", detail: "都可表示歪曲、曲解" }, { from: "reinforce", to: "bolster", label: "同义", detail: "都表示支持、加强" }, { from: "reinforce", to: "buttress", label: "同义", detail: "都表示支持、加强" }, { from: "demise", to: "ebb", label: "同义", detail: "都可联结衰退、衰落" }, { from: "demise", to: "wane", label: "同义", detail: "都可联结衰退、衰落" }, { from: "demise", to: "decay", label: "同义", detail: "都可联结衰退、衰落" }, { from: "demise", to: "languish", label: "同义", detail: "都可联结衰退、衰落" }] },
      { title: "动词组 B", count: "11", kind: "form", words: words("defame", "safeguard", ["diminish", "减少"], ["dwindle", "减少"], "remedy", "animate", "embody", "befit", "belie", "enamor", "amateur"), note: "am = love：enamor ↔ amateur。", logicLinks: [{ from: "diminish", to: "dwindle", label: "同义", detail: "都表示减少、缩小" }, { from: "enamor", to: "amateur", label: "词根联结", detail: "am = love；enamor 使迷恋，amateur 业余爱好者" }] },
    ],
  },
  {
    id: "20-1",
    list: 20,
    part: 1,
    branches: [
      { title: "形容词组 A", count: "13", kind: "form", words: words(["stringent", "严格的"], ["impotent", "无能为力的"], ["futile", "徒劳、无效的"], ["feckless", "无能、无效的"], ["loath", "不情愿的"], ["paradigmatic", "典范性的"], ["innate", "天生的"], ["venal", "贪污、唯利是图的"], ["spontaneous", "自发、自然的"], ["egalitarian", "主张人人平等的"], ["precocious", "早熟的"], ["fortuitous", "偶然的"], ["melodramatic", "夸张、戏剧化的"]) },
      { title: "名词", count: "5", kind: "form", words: words(["umbrage", "生气、被冒犯"], ["chagrin", "失望、懊恼"], ["abeyance", "暂停、搁置"], ["alacrity", "欣然、乐意"], ["bulwark", "保护者、屏障"]) },
      { title: "形容词组 B", count: "8", kind: "form", words: words(["wary", "小心谨慎的"], ["contingent", "依情况而定的"], ["proprietary", "私有、专有的"], ["aesthetic", "审美的"], ["gregarious", "群居、爱社交的"], ["lucrative", "能赚钱的"], ["exigent", "紧急迫切的"], ["autonomous", "独立自主的"]) },
    ],
  },
  {
    id: "20-2",
    list: 20,
    part: 2,
    branches: [
      { title: "形容词", count: "6", kind: "form", words: words(["grandiose", "浮夸、华而不实的"], ["austere", "朴实无华的"], ["churlish", "粗鲁的"], ["courteous", "有礼貌的"], ["counterintuitive", "反直觉、意外的"], ["intuitive", "凭直觉的"]), note: "依次复习：朴实/浮夸、礼貌/粗鲁、直觉/反直觉。" },
      { title: "名词", count: "5", kind: "form", words: words(["discord", "不一致、不和"], ["consensus", "共识、一致"], ["snapshot", "简况、大致印象"], ["synthesis", "综合"], ["sanity", "神志清醒、理智"]) },
      { title: "动词", count: "13", kind: "form", words: words(["ameliorate", "改善"], ["buoy", "鼓励、支持"], ["resonate", "引发共鸣、对某人重要"], ["construe", "解释、解读"], ["proscribe", "禁止"], ["improvise", "即兴创作"], ["acquiesce", "默许、勉强接受"], ["chasten", "使懊悔、使收敛"], ["abbreviate", "缩短、缩写"], ["curtail", "缩减、限制"], ["relish", "享受、喜爱"], ["evince", "显示、表明"], ["vanish", "消失"]) },
    ],
  },
  {
    id: "21-1",
    list: 21,
    part: 1,
    branches: [
      {
        title: "一词多义 · 上",
        count: "8",
        kind: "form",
        words: words(
          {
            word: "devious",
            memory: "de = away，vi / via = way：道路偏离正道就是迂回；人的行为偏离正道就是狡诈、不诚实。",
            synonyms: "indirect；circuitous；cunning；underhanded",
            relatedWords: "反义：aboveboard 光明正大的",
            example: "a devious route 迂回的路线；devious tactics 狡诈的手段",
          },
          {
            word: "amorphous",
            memory: "a = without，morph = form（形状）：没有固定形状；引申为组织或计划没有明确结构和目标。",
            synonyms: "formless；shapeless；unorganized；nebulous；diffuse",
            relatedWords: "morph 与 form 为字母换位联想；nebula n. 星云",
            example: "an amorphous cloud 无定形的云；an amorphous plan 缺乏条理的计划",
          },
          {
            word: "articulate",
            memory: "无论作形容词还是动词，核心都是 clear：能把话说清楚。形容词与动词的词尾读音不同。",
            synonyms: "adj. eloquent；fluent；v. enunciate",
            relatedWords: "enunciate：e = out + nunc / nounce = announce",
            example: "an articulate speaker 表达清晰的演讲者；articulate a vision 清晰阐述愿景",
          },
          {
            word: "intimate",
            memory: "关系亲密时，说敏感内容不便太直接，于是用故事或类比间接提醒：亲密的 → 暗示。",
            synonyms: "adj. close；familiar；v. hint；imply",
            relatedWords: "作动词时强调 show something indirectly",
            example: "an intimate friend 亲密的朋友；intimate his disapproval 暗示他的不满",
          },
          {
            word: "diffuse",
            memory: "dis 同化为 dif = away，fus = pour：向四面八方流散；扩散过度便不集中、松散、啰嗦。",
            synonyms: "adj. unfocused；amorphous；verbose；v. spread；scatter；disperse",
            relatedWords: "注意形容词与动词的读音不同；confuse 同含 fus = pour",
            example: "a diffuse style 松散啰嗦的文风；diffuse knowledge 传播知识",
          },
          {
            word: "utter",
            memory: "联想 out：把话送到外面就是“说出”；从外到内全部涵盖，便是“完全的、彻底的”。",
            synonyms: "v. voice；pronounce；adj. complete；absolute",
            relatedWords: "动词和形容词读音相同，依搭配判断词义",
            example: "not utter a word 一言不发；utter nonsense 一派胡言",
          },
          {
            word: "subordinate",
            memory: "sub = under，ord = order：把 A 的排序放在 B 下面，所以 A 从属于 B，也因此是次要的。",
            synonyms: "v. subject；adj. secondary",
            relatedWords: "结构：subordinate A to B，B 比 A 重要；subject A to B 同构",
            example: "subordinate style to substance 让形式服务于内容；a subordinate role 次要角色",
          },
          {
            word: "fraught",
            memory: "来自 freight（装载）：装满就是“充满”；若心里装满坏事、烦心事，便令人担心和焦虑。",
            synonyms: "uneasy；stressful；fraught with = charged with",
            relatedWords: "单独修饰名词多为“令人不安的”；fraught with 后通常接不好的事物",
            example: "a fraught silence 令人不安的沉默；fraught with danger 充满危险",
          },
        ),
        note: "老师称这一专题为“双重人格”：这些词在 GRE 中两个义项都会考，需结合词性与搭配判断。",
      },
      {
        title: "一词多义 · 下",
        count: "9",
        kind: "form",
        words: words(
          {
            word: "deliberate",
            memory: "de = 加强，liber = scale（秤）：放在秤上反复权衡，就是深思熟虑；想过以后去做，也就是故意。",
            synonyms: "calculated；purposeful；intentional",
            relatedWords: "对照：radical / impulsive；spontaneous / natural",
            example: "a deliberate decision 深思熟虑的决定；a deliberate insult 蓄意侮辱",
          },
          {
            word: "antecedent",
            memory: "ante = before，ced = go：走在前面的，因此作形容词是先前的，作名词是先例。",
            synonyms: "adj. prior；preceding；previous；n. precursor；precedent",
            relatedWords: "anterior adj. 在前的；precedent n. 先例",
            example: "antecedent events 先前的事件；historical antecedents 历史先例",
          },
          {
            word: "manipulate",
            memory: "man = hand：用手摆弄就是操作；暗中摆布人或事，便引申为用不公正技巧操纵。",
            synonyms: "操作：handle；operate；操纵：exploit；maneuver",
            relatedWords: "manual；manuscript；manufacture 都含 man = hand",
            example: "manipulate a tool 操作工具；manipulate public opinion 操纵舆论",
          },
          {
            word: "dissipate",
            memory: "dis = away，sip = 小口喝：一小口一小口把东西耗光，因此既可消散，也可把财富挥霍掉。",
            synonyms: "消散：attenuate；abate；浪费：squander；waste",
            relatedWords: "与 diffuse 都有向外散开的感觉；squander 的反向联想是 husband（节俭使用）",
            example: "the fog dissipated 雾消散了；dissipate a fortune 挥霍家产",
          },
          {
            word: "surrender",
            memory: "sur 来自 sub = under，render = give：把自己或东西交到别人手里，就是投降、屈服，也就是放弃、交出。",
            synonyms: "投降：cede；yield；放弃：abandon；relinquish",
            relatedWords: "常用 surrender to；relinquish 常搭配 power / right",
            example: "surrender to temptation 屈服于诱惑；surrender one's rights 放弃权利",
          },
          {
            word: "shrink",
            memory: "核心都是“缩”：物体向里缩就是收缩变小；人向后缩就是退缩、逃避。",
            synonyms: "退缩：draw back；recoil；缩小：dwindle；contract",
            relatedWords: "退缩义常用 shrink from / recoil from",
            example: "shrink from responsibility 逃避责任；the economy shrank 经济萎缩",
          },
          {
            word: "quash",
            memory: "联想 squash（压扁）：把叛乱压下去是镇压平息；把提案或裁决压下去是否决、撤销。",
            synonyms: "镇压：suppress；quell；否决：annul；nullify",
            relatedWords: "suppress：sup = under + press = 压；nullify：使归零",
            example: "quash a rebellion 镇压叛乱；quash a verdict 撤销判决",
          },
          {
            word: "resolve",
            memory: "re = again + solve：反复也要解决问题，是“解决”；一再坚持解决，也显示“决心”。",
            synonyms: "解决：solve；settle；决心：determination；resolution；tenacity",
            relatedWords: "反义：irresolution 犹豫不决；tenacity 来自 tenacious",
            example: "resolve a dispute 解决争端；show great resolve 展现极大决心",
          },
          {
            word: "intrigue",
            memory: "两个义项差异较大，按词性记：动词是激起兴趣；名词是秘密策划、阴谋诡计。",
            synonyms: "v. fascinate；captivate；n. scheme；conspiracy；plot",
            relatedWords: "intriguing = fascinating / absorbing（引人入胜的）；反向联想 bland（乏味的）",
            example: "intrigue the audience 吸引观众；political intrigue 政治阴谋",
          },
        ),
        note: "这一侧按原图的顺时针读法从左下向左上排列：deliberate → … → intrigue。",
      },
    ],
  },
  LIST_21_PART_2,
  ...LIST_22_MIND_MAPS,
  ...LIST_23_TO_30_MIND_MAPS,
];

/**
 * Explicitly preserve the closing-slide reading path instead of inferring it
 * from vocabulary-list numbers. The teacher's maps are read clockwise:
 * right top → right bottom → left bottom → left top. `title::count` is used
 * only where a slide contains two branches with the same title.
 */
const TEACHER_BRANCH_SEQUENCE: Record<string, string[]> = {
  "7-1": ["不足", "过多", "ple = fill", "万灵药 VS 病", "mal = bad", "尖酸刻薄的", "狭隘的 VS 见过世面的"],
  "7-2": ["清晰易懂的", "难以理解的", "谜题", "困惑"],
  "8-1": ["躲避", "circum = circle", "fin = boundary", "不切实际的 VS 务实的", "无处不在的", "极小的"],
  "8-2": ["无害的 VS 有害的", "cur = run", "过时的", "轻信的"],
  "9-1": ["短暂的", "持久的", "prehend / prehens = seize", "clud / clus = close", "min = jut"],
  "9-2": ["话多啰嗦的", "话少简洁的", "cis = cut", "形近词-1", "形近词-2"],
  "10-1": ["可塑的，易受影响的", "客观中立的", "主观偏见的", "混合物", "形近词", "-acious = too much", "好斗的"],
  "10-2": ["夸张，夸张的", "under- 系列", "多元混合的", "鄙视，轻视", "忽视", "胆小的"],
  "11-1": ["乏味无聊的", "笨重的", "熟练灵巧的", "精明的"],
  "11-2": ["不重要的", "相关重要的", "多产的", "复杂的", "简单直率的"],
  "12-1": ["催眠的", "声望", "真 VS 假", "预示", "革命性的", "拍马屁"],
  "12-2": ["矛盾对立的", "危险的", "随机任意的", "傲慢的", "稀缺不足的", "大量丰富的", "多余的", "肤浅的"],
  "13-1": ["敌对的", "vers = turn", "善变的", "turb = stir", "驱逐", "爱说教的"],
  "13-2": ["阻碍", "阻止", "倾向，偏好", "证实 VS 证伪", "居无定所的", "正直", "仔细认真的"],
  "14-1": ["ambi = both", "voc = call", "支持 VS 阻挠", "奇怪的", "异常的", "放弃", "吸引人的", "模仿"],
  "14-2": ["强的 VS 弱的", "可感知的 VS 难感知的", "显眼的", "分等级的", "内在的", "激怒", "愿意和解的"],
  "15-1": ["乐观自信的 VS 不乐观的", "冷漠的", "狂热的，热情的", "易怒的 VS 容易相处的", "忧伤 VS 令人愉悦的", "吉利的", "有益健康的"],
  "15-2": ["费力繁重的", "引发争论的 VS 无可质疑的", "减轻，缓和", "可渗透的"],
  "16-1": ["诈骗，欺诈", "繁荣，兴旺", "令人恐惧的", "模糊不清的", "vac = empty", "本地的 VS 入侵者", "谴责"],
  "16-2": ["赞扬", "平凡普通的", "dox = opinion", "爱炫耀的 VS 低调的", "没有根据的", "未被破坏的", "前所未有的 VS 陈词滥调"],
  "17-1": ["担心，不安", "鲁莽草率的", "与“马”有关", "拒绝", "nym = name", "消灭，根除", "保守不变的", "类似的", "加剧，恶化"],
  "17-2": ["节俭", "小气", "大方", "挥霍", "嘲笑", "明智的，敏锐的", "超越", "缺陷"],
  "18-1": ["完美无瑕的", "司空见惯的", "极其神圣的", "易受伤的", "勤奋的 VS 懒惰的", "剧烈 VS 克制", "仁慈利他的", "暂缓", "阐明", "颠覆"],
  "18-2": ["免责", "坚定的", "艰苦费力的", "怀疑的", "非凡的", "严厉的", "激增", "崇敬", "合适的", "self- 相关"],
  "19-1": ["形容词::14", "形容词::5", "连词", "名词"],
  "19-2": ["动词组 B", "动词组 A"],
  "20-1": ["名词", "形容词组 B", "形容词组 A"],
  "20-2": ["动词", "名词", "形容词"],
  "21-1": ["一词多义 · 上", "一词多义 · 下"],
  "21-2": [
    "安静、宁静", "开创与新兴", "可行、具体、理智", "表达与感染力", "克制与有利条件", "幽默与赞美",
    "独特、有特色", "先锋派", "挑剔与博学", "必需 VS 辅助", "-less：缺少某种品质", "衰败链条",
    "粗略 VS 断续", "耸人听闻", "狡猾", "教条、武断", "激烈 VS 严重",
  ],
  "22-1": [
    "难闻、令人厌恶", "反抗、不服管", "反传统与蔑视规则", "敏锐精明", "权宜之计", "疲劳", "惩罚", "laps = slip / fall",
    "增加、加强", "加速与激发行动", "珍爱", "吸引与兴奋", "抵消、弥补", "否认、排除", "哀叹、惋惜",
  ],
  "22-2": [
    "困扰、纠缠", "压制、窒息", "厌恶与怨恨", "强加 VS 屈服、让步", "停滞、削弱与毁灭",
    "词形辨析", "信息的引出、传递与泄露", "散开与偏离方向", "克制、忍住不做", "祛魅、幻想破灭",
  ],
};

function normalizedCourseWord(word: string) {
  return word.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

const COURSE_WORD_RANKS = new Map<string, number>();
for (const item of glee1500Data) {
  COURSE_WORD_RANKS.set(`${item.list}:${normalizedCourseWord(item.word)}`, item.globalNumber);
}

function courseRank(list: number, word: string) {
  return COURSE_WORD_RANKS.get(`${list}:${normalizedCourseWord(word)}`) ?? Number.MAX_SAFE_INTEGER;
}

function teacherReviewWords(map: GleeMindMap, branch: MindMapBranch) {
  return branch.words
    .map((word, sourceIndex) => ({ word, sourceIndex }))
    .sort((left, right) => courseRank(map.list, left.word.word) - courseRank(map.list, right.word.word) || left.sourceIndex - right.sourceIndex)
    .map(({ word }) => word);
}

function teacherReviewBranches(map: GleeMindMap) {
  const branches = map.branches.map((branch) => ({
    ...branch,
    words: teacherReviewWords(map, branch),
  }));
  const sequence = TEACHER_BRANCH_SEQUENCE[map.id];
  if (!sequence) return branches;
  const remaining = [...branches];
  const ordered = sequence.flatMap((reference) => {
    const [title, count] = reference.split("::");
    const matchIndex = remaining.findIndex((branch) => branch.title === title && (!count || branch.count === count));
    return matchIndex < 0 ? [] : remaining.splice(matchIndex, 1);
  });
  return [...ordered, ...remaining];
}

export const GLEE_MIND_MAPS: GleeMindMap[] = RAW_GLEE_MIND_MAPS.map((map) => ({
  ...map,
  branches: teacherReviewBranches(map),
}));
