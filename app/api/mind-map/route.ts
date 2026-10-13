import { acyclicMindMapLogicLinks, GLEE_MIND_MAPS, type GleeMindMap, type MindMapLogicLink, type MindMapWord } from "../../gleeMindMaps";
import { GLEE_TABLE_LISTS, type GleeTableList } from "../../gleeTableLists";
import { readMindMapState, writeMindMapState } from "../../../db/mindMapStore";

const MAPS_KEY = "glee-maps-v1";
const TABLES_KEY = "glee-tables-v1";
const RECALL_KEY = "glee-recall-v1";
const LINK_LABELS = new Set<MindMapLogicLink["label"]>(["同义", "反义", "形近不同义", "词根联结", "派生联结", "场景联结"]);
const BRANCH_KINDS = new Set(["meaning", "root", "form", "contrast"]);

function cleanText(value: unknown, maximum = 160) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validateMaps(value: unknown, requireComplete = true): GleeMindMap[] | null {
  if (!Array.isArray(value) || value.length > GLEE_MIND_MAPS.length || (requireComplete && value.length !== GLEE_MIND_MAPS.length)) return null;
  const expectedIds = new Set(GLEE_MIND_MAPS.map((map) => map.id));
  const seenIds = new Set<string>();
  const maps: GleeMindMap[] = [];

  for (const rawMap of value) {
    if (!rawMap || typeof rawMap !== "object") return null;
    const candidate = rawMap as Record<string, unknown>;
    const id = cleanText(candidate.id, 20);
    const list = Number(candidate.list);
    const part = Number(candidate.part);
    const sourceMap = GLEE_MIND_MAPS.find((map) => map.id === id);
    if (!sourceMap || !expectedIds.has(id) || seenIds.has(id) || list !== sourceMap.list || part !== sourceMap.part || !Array.isArray(candidate.branches)) return null;
    seenIds.add(id);

    const branches = [] as GleeMindMap["branches"];
    for (const rawBranch of candidate.branches.slice(0, 30)) {
      if (!rawBranch || typeof rawBranch !== "object") return null;
      const branch = rawBranch as Record<string, unknown>;
      const title = cleanText(branch.title, 80);
      const count = cleanText(branch.count, 20);
      const kind = cleanText(branch.kind, 20) as GleeMindMap["branches"][number]["kind"];
      if (!title || !count || !BRANCH_KINDS.has(kind) || !Array.isArray(branch.words) || branch.words.length > 80) return null;

      const words = branch.words.map((rawWord) => {
        const entry = rawWord && typeof rawWord === "object" ? rawWord as Record<string, unknown> : {};
        return {
          word: cleanText(entry.word, 80),
          gloss: cleanText(entry.gloss, 240) || undefined,
          synonyms: cleanText(entry.synonyms, 360) || undefined,
          relatedWords: cleanText(entry.relatedWords, 360) || undefined,
          example: cleanText(entry.example, 800) || undefined,
          memory: typeof entry.memory === "string" ? cleanText(entry.memory, 800) : undefined,
        };
      });
      if (words.some((entry) => !entry.word) || new Set(words.map((entry) => entry.word.toLocaleLowerCase())).size !== words.length) return null;
      const wordNames = new Set(words.map((entry) => entry.word));

      const logicLinks = Array.isArray(branch.logicLinks) ? branch.logicLinks.map((rawLink) => {
        const link = rawLink && typeof rawLink === "object" ? rawLink as Record<string, unknown> : {};
        return {
          from: cleanText(link.from, 80),
          to: cleanText(link.to, 80),
          label: cleanText(link.label, 20) as MindMapLogicLink["label"],
          detail: cleanText(link.detail, 240) || undefined,
        };
      }) : [];
      const targets = new Set<string>();
      for (const link of logicLinks) {
        if (!wordNames.has(link.from) || !wordNames.has(link.to) || link.from === link.to || !LINK_LABELS.has(link.label) || targets.has(link.to)) return null;
        targets.add(link.to);
      }
      const safeLogicLinks = acyclicMindMapLogicLinks(logicLinks);
      if (requireComplete && safeLogicLinks.length !== logicLinks.length) return null;

      const contrastGroups = Array.isArray(branch.contrastGroups) ? branch.contrastGroups.map((rawGroup) => {
        const group = rawGroup && typeof rawGroup === "object" ? rawGroup as Record<string, unknown> : {};
        return {
          label: cleanText(group.label, 60),
          tone: group.tone === "pink" ? "pink" as const : "blue" as const,
          words: Array.isArray(group.words) ? group.words.map((word) => cleanText(word, 80)).filter((word) => wordNames.has(word)) : [],
        };
      }).filter((group) => group.label && group.words.length) : undefined;

      branches.push({
        title,
        count,
        kind,
        words,
        note: cleanText(branch.note, 360) || undefined,
        relation: cleanText(branch.relation, 240) || undefined,
        logicLinks: safeLogicLinks.length ? safeLogicLinks : undefined,
        contrastGroups: contrastGroups?.length ? contrastGroups : undefined,
      });
    }
    maps.push({ id, list, part, branches });
  }
  return requireComplete && seenIds.size !== expectedIds.size ? null : maps;
}

function validateTables(value: unknown, requireComplete = true): GleeTableList[] | null {
  if (!Array.isArray(value) || value.length > GLEE_TABLE_LISTS.length || (requireComplete && value.length !== GLEE_TABLE_LISTS.length)) return null;
  const expectedIds = new Set(GLEE_TABLE_LISTS.map((table) => table.id));
  const seenIds = new Set<string>();
  const tables: GleeTableList[] = [];

  for (const rawTable of value) {
    if (!rawTable || typeof rawTable !== "object") return null;
    const candidate = rawTable as Record<string, unknown>;
    const id = cleanText(candidate.id, 30);
    const list = Number(candidate.list);
    const source = GLEE_TABLE_LISTS.find((table) => table.id === id);
    if (!source || !expectedIds.has(id) || seenIds.has(id) || list !== source.list || !Array.isArray(candidate.words)) return null;
    seenIds.add(id);
    const words = candidate.words.slice(0, 100).map((rawWord) => {
      const entry = rawWord && typeof rawWord === "object" ? rawWord as Record<string, unknown> : {};
      return {
        id: cleanText(entry.id, 80),
        word: cleanText(entry.word, 80),
        gloss: cleanText(entry.gloss, 240),
        synonyms: cleanText(entry.synonyms, 360) || undefined,
        relatedWords: cleanText(entry.relatedWords, 360) || undefined,
        example: cleanText(entry.example, 800) || undefined,
        memory: typeof entry.memory === "string" ? cleanText(entry.memory, 800) : undefined,
      };
    });
    if (!words.length || words.some((entry) => !entry.id || !entry.word || !entry.gloss)) return null;
    if (new Set(words.map((entry) => entry.id)).size !== words.length || new Set(words.map((entry) => entry.word.toLocaleLowerCase())).size !== words.length) return null;
    tables.push({ id, list, words });
  }
  return requireComplete && seenIds.size !== expectedIds.size ? null : tables;
}

function validateRecall(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, marked]) => marked === true && key.length <= 180)
    .slice(0, 10_000);
  return Object.fromEntries(entries) as Record<string, true>;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function preferSaved(saved: string | undefined, fallback: string | undefined) {
  return saved?.trim() || fallback;
}

function withoutRedundantMemorySections(value: string | undefined) {
  return value
    ?.replace(/\s*(?:英文义路|组内辨析)：[^。]*(?:。|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim() || undefined;
}

function isObsoleteGeneratedMemory(value: string | undefined) {
  const memory = value?.trim() ?? "";
  return /^课程思维导图：这个词归入「[^」]+」组(?:；[^。]*)?。$/.test(memory)
    || /^课程「[^」]+」重点：.+在 GRE 语境中记作“[^”]+”(?:（[^）]+）)?。$/.test(memory);
}

function preferSavedMemory(saved: string | undefined, source: string | undefined) {
  if (saved === "") return ""; // Explicitly clearing a shared method must not restore the source fallback.
  const cleanedSaved = withoutRedundantMemorySections(saved);
  const cleanedSource = withoutRedundantMemorySections(source);
  // Earlier releases generated these two templates automatically. They are
  // not learner-authored notes, so let the newer word-specific source replace
  // them while continuing to preserve every genuinely edited memory field.
  return isObsoleteGeneratedMemory(cleanedSaved) ? cleanedSource : preferSaved(cleanedSaved, cleanedSource);
}

const OBSOLETE_GENERATED_RELATED_WORDS = new Set([
  "前三个表示狭隘；cosmopolitan 表示见过世面",
  "plethora 再联结 ple = fill",
  "complement 是补足；compliment 是赞美",
  "panacea 表示万灵药；malady 表示疾病",
  "malodorous 是难闻、恶臭的",
  "scrutinize、fathom 用来联结词形和反向含义",
  "elude → elusive；evade → evasive",
  "circumscribe 与 confine 都可表示限制",
  "cred = believe；credulous 联结 discredit",
  "前两个无害；后五个有害",
  "cursory / perfunctory / hasty 表示草率；transgress / violate 表示违反",
  "enduring 与 obdurate 形近但不同义",
  "ingenious 是有创造力；ingenuous 是天真；disingenuous 是不真诚",
  "discrete 是分离；discreet 是谨慎；compulsory 与 discretionary 对照",
  "incisive / trenchant 表示犀利；trenchant 与 entrenched 形近不同义",
  "deplorable / reprehensible 表示应受谴责；exhaustive / encyclopedic 表示全面详尽",
]);

function preferSavedRelatedWords(saved: string | undefined, source: string | undefined) {
  const cleanedSaved = saved?.trim();
  // These exact phrases were copied automatically from old group headings into
  // every word card.  They were never learner-authored word notes, so migrate
  // them to the verified per-word course content while preserving all other
  // saved edits.
  return cleanedSaved && OBSOLETE_GENERATED_RELATED_WORDS.has(cleanedSaved)
    ? source
    : preferSaved(cleanedSaved, source);
}

function mergeWords(sourceWords: MindMapWord[], savedWords: MindMapWord[]) {
  const savedByWord = new Map(savedWords.map((entry) => [normalized(entry.word), entry]));
  const sourceNames = new Set(sourceWords.map((entry) => normalized(entry.word)));
  const merged = sourceWords.map((source) => {
    const saved = savedByWord.get(normalized(source.word));
    if (!saved) return source;
    return {
      word: saved.word || source.word,
      gloss: preferSaved(saved.gloss, source.gloss),
      synonyms: preferSaved(saved.synonyms, source.synonyms),
      relatedWords: preferSavedRelatedWords(saved.relatedWords, source.relatedWords),
      example: preferSaved(saved.example, source.example),
      memory: preferSavedMemory(saved.memory, source.memory),
    };
  });
  return [...merged, ...savedWords.filter((entry) => !sourceNames.has(normalized(entry.word)))];
}

function mergeMapsWithSource(savedMaps: GleeMindMap[]) {
  const savedById = new Map(savedMaps.map((map) => [map.id, map]));
  return GLEE_MIND_MAPS.map((sourceMap) => {
    const savedMap = savedById.get(sourceMap.id);
    if (!savedMap) return sourceMap;
    const usedSavedBranches = new Set<number>();
    const branches = sourceMap.branches.map((sourceBranch) => {
      const sourceWordNames = new Set(sourceBranch.words.map((entry) => normalized(entry.word)));
      const savedMatch = savedMap.branches
        .map((branch, index) => ({
          branch,
          index,
          overlap: branch.words.reduce((count, entry) => count + Number(sourceWordNames.has(normalized(entry.word))), 0),
        }))
        .filter(({ branch, index }) => !usedSavedBranches.has(index) && normalized(branch.title) === normalized(sourceBranch.title))
        .sort((left, right) => right.overlap - left.overlap)[0];
      if (!savedMatch) return sourceBranch;
      usedSavedBranches.add(savedMatch.index);
      const savedBranch = savedMatch.branch;

      const savedLinksByTarget = new Map((savedBranch.logicLinks ?? []).map((link) => [normalized(link.to), link]));
      const sourceLinkTargets = new Set((sourceBranch.logicLinks ?? []).map((link) => normalized(link.to)));
      const logicLinks = acyclicMindMapLogicLinks([
        ...(sourceBranch.logicLinks ?? []).map((link) => savedLinksByTarget.get(normalized(link.to)) ?? link),
        ...(savedBranch.logicLinks ?? []).filter((link) => !sourceLinkTargets.has(normalized(link.to))),
      ]);

      const savedContrastsByLabel = new Map((savedBranch.contrastGroups ?? []).map((group) => [normalized(group.label), group]));
      const sourceContrastLabels = new Set((sourceBranch.contrastGroups ?? []).map((group) => normalized(group.label)));
      const contrastGroups = [
        ...(sourceBranch.contrastGroups ?? []).map((group) => savedContrastsByLabel.get(normalized(group.label)) ?? group),
        ...(savedBranch.contrastGroups ?? []).filter((group) => !sourceContrastLabels.has(normalized(group.label))),
      ];

      return {
        ...sourceBranch,
        title: savedBranch.title || sourceBranch.title,
        count: savedBranch.count || sourceBranch.count,
        kind: savedBranch.kind || sourceBranch.kind,
        words: mergeWords(sourceBranch.words, savedBranch.words),
        note: preferSaved(savedBranch.note, sourceBranch.note),
        relation: preferSaved(savedBranch.relation, sourceBranch.relation),
        logicLinks: logicLinks.length ? logicLinks : undefined,
        contrastGroups: contrastGroups.length ? contrastGroups : undefined,
      };
    });

    return {
      ...sourceMap,
      branches: [
        ...branches,
        ...savedMap.branches.filter((_, index) => !usedSavedBranches.has(index)),
      ],
    };
  });
}

function mergeTablesWithSource(savedTables: GleeTableList[]) {
  const savedById = new Map(savedTables.map((table) => [table.id, table]));
  return GLEE_TABLE_LISTS.map((sourceTable) => {
    const savedTable = savedById.get(sourceTable.id);
    if (!savedTable) return sourceTable;
    const savedByWord = new Map(savedTable.words.map((entry) => [normalized(entry.word), entry]));
    const sourceNames = new Set(sourceTable.words.map((entry) => normalized(entry.word)));
    const words = sourceTable.words.map((source) => {
      const saved = savedByWord.get(normalized(source.word));
      if (!saved) return source;
      return {
        id: saved.id || source.id,
        word: saved.word || source.word,
        gloss: saved.gloss || source.gloss,
        synonyms: preferSaved(saved.synonyms, source.synonyms),
        relatedWords: preferSavedRelatedWords(saved.relatedWords, source.relatedWords),
        example: preferSaved(saved.example, source.example),
        memory: preferSavedMemory(saved.memory, source.memory),
      };
    });
    return {
      ...sourceTable,
      words: [...words, ...savedTable.words.filter((entry) => !sourceNames.has(normalized(entry.word)))],
    };
  });
}

export async function GET() {
  try {
    const [mapsState, tablesState, recallState] = await Promise.all([
      readMindMapState(MAPS_KEY),
      readMindMapState(TABLES_KEY),
      readMindMapState(RECALL_KEY),
    ]);
    // Older snapshots can legitimately contain fewer maps.  Validate the maps
    // they do contain, then merge in every new map, branch and word from the
    // current course source without discarding the learner's saved additions.
    const savedMaps = mapsState ? validateMaps(JSON.parse(mapsState.value), false) : null;
    // A previous deployment may contain only the original List 1–6 tables.
    // Accept that valid subset, then merge the newly added optional table views
    // without discarding any learner-authored fields.
    const savedTables = tablesState ? validateTables(JSON.parse(tablesState.value), false) : null;
    return Response.json({
      maps: savedMaps ? mergeMapsWithSource(savedMaps) : GLEE_MIND_MAPS,
      mapsRevision: mapsState?.revision ?? 0,
      tables: savedTables ? mergeTablesWithSource(savedTables) : GLEE_TABLE_LISTS,
      tablesRevision: tablesState?.revision ?? 0,
      unmastered: recallState ? JSON.parse(recallState.value) : {},
      recallRevision: recallState?.revision ?? 0,
      updatedAt: mapsState?.updatedAt ?? null,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取云端导图失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as { scope?: unknown; value?: unknown };
    if (payload.scope === "maps") {
      const maps = validateMaps(payload.value);
      if (!maps) return Response.json({ error: "导图数据不完整，未保存。请检查空单词、重复单词或重复连接。" }, { status: 400 });
      const saved = await writeMindMapState(MAPS_KEY, JSON.stringify(maps));
      return Response.json({ maps, revision: saved.revision, updatedAt: saved.updatedAt });
    }
    if (payload.scope === "tables") {
      const tables = validateTables(payload.value);
      if (!tables) return Response.json({ error: "词汇表格数据不完整，未保存。" }, { status: 400 });
      const saved = await writeMindMapState(TABLES_KEY, JSON.stringify(tables));
      return Response.json({ tables, revision: saved.revision, updatedAt: saved.updatedAt });
    }
    if (payload.scope === "recall") {
      const recall = validateRecall(payload.value);
      if (!recall) return Response.json({ error: "未掌握记录格式不正确。" }, { status: 400 });
      const saved = await writeMindMapState(RECALL_KEY, JSON.stringify(recall));
      return Response.json({ unmastered: recall, revision: saved.revision, updatedAt: saved.updatedAt });
    }
    return Response.json({ error: "未知的保存类型。" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}
