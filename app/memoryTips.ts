export type MemoryTip = {
  label: "词根词缀" | "语义桥" | "谐音联想" | "等价联结" | "三向联结" | "核心义" | "课程记忆" | "我的锚点" | "同义词群" | "辨析" | "搭配派生" | "英文考法";
  title: string;
  detail: string;
};

type EquivalentEntry = {
  left: string;
  right: string;
  meaning: string;
};

const SPECIAL_TIPS: Record<string, MemoryTip[]> = {
  superficial: [
    {
      label: "语义桥",
      title: "superficies = 表面 + -al = …的",
      detail: "只停在表面 → 表面的；肤浅的",
    },
  ],
  unidimensional: [
    {
      label: "词根词缀",
      title: "uni = 一 + dimension = 维度 + -al = …的",
      detail: "只有一个维度、没有深度 → 单向度的；肤浅的",
    },
  ],
  equivocal: [
    {
      label: "词根词缀",
      title: "equi = 相等 + voc = 说/声音 + -al = …的",
      detail: "两种说法分量相等 → 模棱两可的；有歧义的",
    },
  ],
  circumspect: [
    {
      label: "词根词缀",
      title: "circum = 周围 + spect = 看",
      detail: "向四周看 → 谨慎的；考虑周到的",
    },
  ],
  introspect: [
    {
      label: "词根词缀",
      title: "intro = 向内 + spect = 看",
      detail: "向内心看 → 反省；内省",
    },
  ],
  magnanimous: [
    {
      label: "词根词缀",
      title: "magn = 大 + anim = 心灵/精神 + -ous = …的",
      detail: "心胸大 → 宽宏大量的；慷慨的",
    },
  ],
  benevolent: [
    {
      label: "词根词缀",
      title: "bene = 善/好 + vol = 意愿 + -ent = …的",
      detail: "善良的意愿 → 仁慈的；乐善好施的",
    },
  ],
  malfeasance: [
    {
      label: "词根词缀",
      title: "mal = 坏 + feas = 做 + -ance = 行为",
      detail: "做坏事 → 违法或不正当行为",
    },
  ],
  omniscient: [
    {
      label: "词根词缀",
      title: "omni = 全部 + sci = 知道 + -ent = …的",
      detail: "全部都知道 → 无所不知的",
    },
  ],
  omnipresent: [
    {
      label: "词根词缀",
      title: "omni = 全部 + present = 在场",
      detail: "所有地方都在场 → 无处不在的",
    },
  ],
  omnivorous: [
    {
      label: "词根词缀",
      title: "omni = 全部 + vor = 吃 + -ous = …的",
      detail: "什么都吃 → 杂食的；涉猎广泛的",
    },
  ],
  misanthrope: [
    {
      label: "词根词缀",
      title: "mis = 厌恶 + anthrop = 人类",
      detail: "厌恶人类的人 → 厌世者",
    },
  ],
  anthropogenic: [
    {
      label: "词根词缀",
      title: "anthrop = 人类 + gen = 产生 + -ic = …的",
      detail: "由人类产生 → 人为造成的",
    },
  ],
  anachronism: [
    {
      label: "语义桥",
      title: "ana = 错位/向后 + chron = 时间 + -ism = 现象",
      detail: "时间错位 → 时代错误；不合时宜",
    },
  ],
  synchronous: [
    {
      label: "词根词缀",
      title: "syn = 共同 + chron = 时间 + -ous = …的",
      detail: "在共同时间发生 → 同步的",
    },
  ],
  pseudonym: [
    {
      label: "词根词缀",
      title: "pseudo = 假的 + nym = 名字",
      detail: "假名字 → 笔名；化名",
    },
  ],
  univocal: [
    {
      label: "词根词缀",
      title: "uni = 一 + voc = 声音/说法 + -al = …的",
      detail: "只有一种说法 → 含义明确的；单义的",
    },
  ],
  unilateral: [
    {
      label: "词根词缀",
      title: "uni = 一 + later = 侧面 + -al = …的",
      detail: "只来自一边 → 单方面的",
    },
  ],
  amorphous: [
    {
      label: "词根词缀",
      title: "a- = 没有 + morph = 形状 + -ous = …的",
      detail: "没有固定形状 → 无定形的；结构不清的",
    },
  ],
  cacophony: [
    {
      label: "词根词缀",
      title: "caco = 坏/不悦 + phon = 声音",
      detail: "不悦的声音 → 刺耳嘈杂的声音",
    },
  ],
  xenophobic: [
    {
      label: "词根词缀",
      title: "xeno = 外来者 + phob = 恐惧/排斥 + -ic = …的",
      detail: "恐惧或排斥外来者 → 恐外的",
    },
  ],
  claustrophobic: [
    {
      label: "词根词缀",
      title: "claustr = 封闭空间 + phob = 恐惧 + -ic = …的",
      detail: "害怕封闭空间 → 幽闭恐惧的",
    },
  ],
};

// 谐音只收录一眼能回到原义的短钩子；不把谐音冒充词源。
const MNEMONIC_TIPS: Record<string, MemoryTip> = {
  capricious: {
    label: "谐音联想",
    title: "capricious ≈“看脾气”",
    detail: "全看脾气、说变就变 → 反复无常的；任性的",
  },
  garrulous: {
    label: "谐音联想",
    title: "garrulous ≈“嘎啦嘎啦”",
    detail: "嘎啦嘎啦说不停 → 饶舌的；话多的",
  },
  laconic: {
    label: "谐音联想",
    title: "laconic ≈“懒开口”",
    detail: "懒得多说 → 简洁的；寡言的",
  },
  parsimonious: {
    label: "谐音联想",
    title: "parsimonious ≈“怕失 money”",
    detail: "怕钱没了，舍不得花 → 吝啬的；过度节省的",
  },
  fastidious: {
    label: "谐音联想",
    title: "fastidious ≈“烦死地挑”",
    detail: "这也挑、那也挑 → 挑剔的；难取悦的",
  },
};

const FORMULA_TIPS: Record<string, { formula: string; bridge: string }> = {
  discredit: { formula: "dis = 去掉/否定 + cred = 相信", bridge: "使人不再相信 → 使丧失信誉" },
  credulous: { formula: "cred = 相信 + -ulous = 容易…的", bridge: "太容易相信 → 轻信的" },
  contradictory: { formula: "contra = 相反 + dict = 说 + -ory = …的", bridge: "说法相反 → 矛盾的" },
  ascribe: { formula: "a(d)- = 向 + scribe = 写", bridge: "把某事“写到”某原因上 → 归因于" },
  prescribe: { formula: "pre = 事先 + scribe = 写", bridge: "事先写下规则 → 规定；开处方" },
  circumscribe: { formula: "circum = 周围 + scribe = 写/划", bridge: "在周围划线 → 限制；划定范围" },
  proscribe: { formula: "pro = 向前/公开 + scribe = 写", bridge: "公开写出禁令 → 禁止" },
  extract: { formula: "ex = 向外 + tract = 拉", bridge: "向外拉出 → 提取；拔出" },
  retract: { formula: "re = 向回 + tract = 拉", bridge: "拉回来 → 撤回；缩回" },
  contract: { formula: "con = 共同/向内 + tract = 拉", bridge: "拉到一起 → 收缩；契约" },
  protract: { formula: "pro = 向前 + tract = 拉", bridge: "向前拉长 → 延长；拖延" },
  eject: { formula: "e(x)- = 向外 + ject = 扔", bridge: "向外扔 → 逐出；喷出" },
  dejected: { formula: "de = 向下 + ject = 扔 + -ed = …的", bridge: "像被扔到低处 → 沮丧的" },
  interjection: { formula: "inter = 中间 + ject = 扔 + -ion = 话语", bridge: "扔进谈话中间的话 → 插话；感叹词" },
  precede: { formula: "pre = 在前 + cede = 走", bridge: "走在前面 → 先于" },
  antecedent: { formula: "ante = 在前 + ced = 走 + -ent = 事物", bridge: "走在前面的事物 → 前件；先例" },
  loquacious: { formula: "loqu = 说话 + -acious = 爱…的", bridge: "爱不停说话 → 健谈的；多话的" },
  circumlocution: { formula: "circum = 绕着 + locut = 说 + -ion = 言语", bridge: "绕着说 → 迂回说法" },
  interlocutor: { formula: "inter = 相互 + locut = 说 + -or = 人", bridge: "互相说话的人 → 对话者" },
  benefactor: { formula: "bene = 好/善 + fact = 做 + -or = 人", bridge: "做好事的人 → 恩人；捐助者" },
  pseudonym: { formula: "pseudo = 假的 + nym = 名字", bridge: "假名字 → 笔名；化名" },
  immutable: { formula: "im- = 不 + mut = 改变 + -able = 能…的", bridge: "不能改变 → 不变的" },
  belligerent: { formula: "bell = 战争 + ger = 进行 + -ent = …的", bridge: "总想开战 → 好战的；好斗的" },
  pacific: { formula: "pac = 和平 + fic = 使成为 + -ic = …的", bridge: "使事物平和 → 和平的；平静的" },
  veracious: { formula: "ver = 真实 + -acious = 具有…的", bridge: "具有真实性 → 说真话的；真实的" },
  somnolent: { formula: "somn = 睡眠 + -olent = 充满…的", bridge: "充满睡意 → 困倦的；催眠的" },
  pugnacious: { formula: "pugn = 打斗 + -acious = 爱…的", bridge: "爱打斗 → 好斗的" },
  impugn: { formula: "im- = 向/攻击 + pugn = 打斗", bridge: "用言语攻击 → 质疑；驳斥" },
  repugnant: { formula: "re = 反向 + pugn = 对抗 + -ant = …的", bridge: "让人本能对抗 → 令人厌恶的" },
  apathetic: { formula: "a- = 没有 + path = 感受 + -etic = …的", bridge: "没有情感反应 → 冷漠的；无动于衷的" },
  iconoclast: { formula: "icon = 偶像/观念 + clast = 打破者", bridge: "打破偶像或旧观念的人 → 因循破坏者" },
  confer: { formula: "con = 一起 + fer = 带", bridge: "把意见带到一起 → 商议；授予" },
  defer: { formula: "de = 离开/往后 + fer = 带", bridge: "往后带 → 推迟；顺从" },
  facile: { formula: "fac = 做 + -ile = 容易…的", bridge: "容易做 → 容易的；流于肤浅的" },
  facilitate: { formula: "facil = 容易 + -itate = 使…", bridge: "使变得容易 → 促进；使便利" },
  homogeneous: { formula: "homo = 相同 + gen = 种类 + -ous = …的", bridge: "属于同一种类 → 同质的" },
  heterogeneous: { formula: "hetero = 不同 + gen = 种类 + -ous = …的", bridge: "属于不同种类 → 异质的；多样的" },
  lucid: { formula: "luc = 光/明亮 + -id = …的", bridge: "有光就看得清 → 清楚易懂的" },
  elucidate: { formula: "e(x)- = 向外 + luc = 光 + -ate = 使…", bridge: "使光照出来 → 阐明；解释" },
  immortal: { formula: "im- = 不 + mort = 死 + -al = …的", bridge: "不会死 → 不朽的；永生的" },
  vivacious: { formula: "viv = 生命/活 + -acious = 充满…的", bridge: "充满生命力 → 活泼的" },
  revive: { formula: "re = 再 + viv = 活", bridge: "再次活过来 → 复活；使恢复" },
  digress: { formula: "di(s)- = 离开 + gress = 走", bridge: "从主路走开 → 离题" },
  transgress: { formula: "trans = 越过 + gress = 走", bridge: "走过界线 → 越界；违反" },
  regressive: { formula: "re = 向后 + gress = 走 + -ive = …的", bridge: "向后走 → 退步的；倒退的" },
};

const ROOT_FAMILIES: Array<{ words: string[]; root: string; meaning: string; cue: string }> = [
  { words: ["discredit", "credulous", "credential"], root: "cred", meaning: "相信", cue: "看到 cred，先问它与“相信、可信”有什么关系。" },
  { words: ["dictate", "dictator", "indict", "valediction", "contradictory"], root: "dict", meaning: "说、宣告", cue: "dict 是“说”；命令、宣告和反驳都从“说”展开。" },
  { words: ["ascribe", "prescribe", "nondescript", "circumscribe", "proscribe", "scribble"], root: "scrib / script", meaning: "写", cue: "先抓住“写”，再结合前缀判断写上、规定或划定。" },
  { words: ["prospect", "circumspect", "introspect"], root: "spect", meaning: "看", cue: "spect 是“看”；向前看、环顾、向内看会产生不同含义。" },
  { words: ["extract", "retract", "abstraction", "contract", "tractable", "detract", "protract"], root: "tract", meaning: "拉、拖", cue: "想象一根绳子被不同方向的前缀拉动。" },
  { words: ["conjecture", "objective", "subject", "project", "object", "objectionable", "dejected", "eject", "interjection"], root: "ject", meaning: "投、扔", cue: "把 ject 想成“扔”，再看前缀决定扔向哪里。" },
  { words: ["concede", "accede", "cede", "precede", "precedent", "antecedent"], root: "cede / ceed", meaning: "走、让步", cue: "核心动作是“走开/让出”，也可由前缀推到先行、同意。" },
  { words: ["colloquial", "eloquent", "loquacious", "circumlocution", "interlocutor", "obloquy"], root: "loqu / locut", meaning: "说话", cue: "这组词都围绕说话的方式、对象或评价展开。" },
  { words: ["benevolent", "benefactor", "beneficiary"], root: "bene", meaning: "好、善", cue: "bene 出现时，优先联想到善意、好处和受益。" },
  { words: ["omniscient", "omnipresent", "omnivorous"], root: "omni", meaning: "全部", cue: "omni 是“全部”，后半部分决定“全知、全在、全吃”。" },
  { words: ["universal", "unilateral", "unidimensional", "univocal"], root: "uni", meaning: "一", cue: "uni 是“一”，可联想到一个整体、单边、单维或单义。" },
  { words: ["multifarious", "multitudinous"], root: "multi", meaning: "多", cue: "multi 先锁定“多”，再回忆是种类多还是数量多。" },
  { words: ["anachronism", "synchronous"], root: "chron", meaning: "时间", cue: "chron 管时间：时间错位是不合时宜，同一时间是同步。" },
  { words: ["anthropogenic", "misanthrope"], root: "anthrop", meaning: "人类", cue: "anthrop 把含义锚定在人、人类。" },
  { words: ["morph", "amorphous"], root: "morph", meaning: "形状", cue: "morph 是形状；a- 表示没有，于是 amorphous 是无定形。" },
  { words: ["equivocal", "provocative", "evocative", "vociferous", "univocal"], root: "voc", meaning: "声音、呼唤", cue: "voc 与发声有关，再结合前缀理解含义方向。" },
  { words: ["magnanimous", "magnify"], root: "magn", meaning: "大", cue: "magn 是“大”：放大，或心胸很大。" },
  { words: ["novel", "novice"], root: "nov", meaning: "新", cue: "nov 是“新”：新奇的事物或刚入门的新人。" },
  { words: ["immortal", "mortify"], root: "mort", meaning: "死亡", cue: "mort 锚定“死亡”；im- 是否定，mortify 则联想到让人难堪得要死。" },
  { words: ["vivacious", "revive", "convivial", "revitalize"], root: "viv / vit", meaning: "生命、活", cue: "先想到生命力，再推到活泼、复苏和使恢复活力。" },
  { words: ["digress", "degrade", "transgress", "regressive"], root: "grad / gress", meaning: "走、迈步", cue: "结合前缀想象走开、向下、越界或向后退。" },
  { words: ["lucid", "elucidate"], root: "luc", meaning: "光、明亮", cue: "有光就看得清：lucid 是清楚易懂，e-lucid-ate 是把事情阐明。" },
  { words: ["immutable"], root: "mut", meaning: "改变", cue: "im- 表示不，mut 表示改变：不能改变的、不变的。" },
  { words: ["belligerent", "rebellious"], root: "bell", meaning: "战争", cue: "bell 指战争：主动好战是 belligerent，反抗权威可联想到重新开战。" },
  { words: ["pacific"], root: "pac", meaning: "和平", cue: "pac 锚定和平，所以 pacific 可表示和平的、平静的。" },
  { words: ["veracious"], root: "ver", meaning: "真实", cue: "ver 是真实，veracious 就是说真话的、真实的。" },
  { words: ["somnolent"], root: "somn", meaning: "睡眠", cue: "somn 与睡眠有关，somnolent 就是困倦欲睡的。" },
  { words: ["taciturn"], root: "tac", meaning: "沉默", cue: "把 tac 锁定为不说话：taciturn 是寡言的、沉默的。" },
  { words: ["pugnacious", "impugn", "repugnant"], root: "pugn", meaning: "打斗", cue: "pugn 是打斗：好斗、攻击质疑，或让人本能抗拒，都从“对抗”展开。" },
  { words: ["apathetic"], root: "path", meaning: "感受、情感", cue: "a- 表示没有，path 是感受：没有情感反应就是冷漠的。" },
  { words: ["iconoclast"], root: "icon + clast", meaning: "形象 + 打破", cue: "字面是打碎偶像的人，引申为攻击传统观念、打破信条的人。" },
  { words: ["confer", "defer"], root: "fer", meaning: "携带", cue: "fer 是携带；con- 表示共同带来，可指商议，de- 带开则引申为推迟或顺从。" },
  { words: ["facile", "facilitate", "factitious", "malfeasance"], root: "fac / feas", meaning: "做、制造", cue: "先抓“做”：容易做、促成去做、人为制造，或做坏事。" },
  { words: ["progenitor", "indigenous", "homogeneous", "heterogeneous"], root: "gen", meaning: "出生、产生、种类", cue: "gen 管来源和种类：祖先、本地生长、同种或异种。" },
];

function coreMeaning(meaning: string) {
  return meaning.split(/[；;，,]/).map((item) => item.trim()).filter(Boolean)[0] ?? meaning;
}

function connectToPdfMeaning(bridge: string, meaning: string) {
  const literal = bridge.split("→")[0]?.trim();
  return literal ? `${literal} → ${meaning}` : meaning;
}

export function buildMemoryTips(
  word: string,
  meaning: string,
  equivalents: EquivalentEntry[],
): MemoryTip[] {
  const normalized = word.toLowerCase().trim();
  const tips = (SPECIAL_TIPS[normalized] ?? []).map((tip) => ({
    ...tip,
    detail: connectToPdfMeaning(tip.detail, meaning),
  }));

  const formulaTip = FORMULA_TIPS[normalized];
  if (formulaTip && !tips.some((tip) => tip.label === "词根词缀" || tip.label === "语义桥")) {
    tips.push({
      label: "词根词缀",
      title: formulaTip.formula,
      detail: connectToPdfMeaning(formulaTip.bridge, meaning),
    });
  }

  if (!tips.some((tip) => tip.label === "词根词缀")) {
    const family = ROOT_FAMILIES.find((item) => item.words.includes(normalized));
    if (family) {
      tips.push({
        label: "词根词缀",
        title: `${family.root} = ${family.meaning}`,
        detail: `${word} → ${coreMeaning(meaning)}`,
      });
    }
  }

  const mnemonic = MNEMONIC_TIPS[normalized];
  if (mnemonic && !tips.some((tip) => tip.label === "谐音联想")) {
    tips.push({ ...mnemonic, detail: connectToPdfMeaning(mnemonic.detail, meaning) });
  }

  const links = equivalents
    .filter((item) => item.left.toLowerCase() === normalized || item.right.toLowerCase() === normalized)
    .map((item) => ({
      partner: item.left.toLowerCase() === normalized ? item.right : item.left,
      meaning: item.meaning,
    }))
    .filter((item, index, items) => items.findIndex((other) => other.partner === item.partner) === index)
    .slice(0, 3);
  if (links.length) {
    tips.push({
      label: "等价联结",
      title: links.map((item) => item.partner).join(" · "),
      detail: links.map((item) => `${item.partner} = ${item.meaning}`).join("；"),
    });
  }

  tips.push({
    label: "核心义",
    title: `${word} = ${coreMeaning(meaning)}`,
    detail: meaning,
  });

  return tips.slice(0, 3);
}

export function buildEquivalentMemoryTips(
  left: string,
  right: string,
  meaning: string,
  equivalents: EquivalentEntry[],
): MemoryTip[] {
  const leftTip = buildMemoryTips(left, meaning, equivalents)
    .find((tip) => tip.label === "词根词缀" || tip.label === "语义桥" || tip.label === "谐音联想");
  const rightTip = buildMemoryTips(right, meaning, equivalents)
    .find((tip) => tip.label === "词根词缀" || tip.label === "语义桥" || tip.label === "谐音联想");
  const tips: MemoryTip[] = [];

  if (leftTip) tips.push({ ...leftTip, title: `${left}：${leftTip.title}` });
  if (rightTip) tips.push({ ...rightTip, title: `${right}：${rightTip.title}` });
  tips.push({
    label: "三向联结",
    title: `${left} = ${right}`,
    detail: `共同义：${meaning}`,
  });

  return tips.slice(0, 3);
}
