import glee1500Data from "./glee1500.json" with { type: "json" };
import { GLEE_MIND_MAPS } from "./gleeMindMaps.ts";
import { GLEE_STUDY_NOTES } from "./gleeStudyNotes.ts";

export type GleeTableWord = {
  id: string;
  word: string;
  gloss: string;
  synonyms?: string;
  relatedWords?: string;
  example?: string;
  memory?: string;
};

export type GleeTableList = {
  id: string;
  list: number;
  words: GleeTableWord[];
};

type SourceWord = {
  id: string;
  word: string;
  meaning: string;
  list: number;
};

const sourceWords = glee1500Data as SourceWord[];

export const GLEE_TABLE_LIST_NUMBERS = Array.from({ length: 30 }, (_, index) => index + 1);
export const GLEE_DUAL_VIEW_LISTS = Array.from({ length: 24 }, (_, index) => index + 7);

const mindMapNotes = new Map(
  GLEE_MIND_MAPS.flatMap((map) => map.branches.flatMap((branch) => branch.words.map((entry) => {
    const { word, gloss: _gloss, ...notes } = entry;
    return [`${map.list}:${word.toLocaleLowerCase()}`, notes] as const;
  }))),
);

export const GLEE_TABLE_LISTS: GleeTableList[] = GLEE_TABLE_LIST_NUMBERS.map((list) => {
  return {
    id: `table-${list}`,
    list,
    words: sourceWords
      .filter((item) => item.list === list)
      .map((item) => ({
        id: item.id,
        word: item.word,
        gloss: item.meaning,
        ...GLEE_STUDY_NOTES[item.word.toLocaleLowerCase()],
        ...mindMapNotes.get(`${list}:${item.word.toLocaleLowerCase()}`),
      })),
  };
});
