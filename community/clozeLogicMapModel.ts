export type ClozeMapTone = 'opposite' | 'same' | 'neutral';
export type ClozeLogicNode = {
 id: string;
 label: string;
 details?: string[];
 tone?: ClozeMapTone;
 children?: ClozeLogicNode[];
};
export type ClozeLogicContent = {schemaVersion: 1; root: ClozeLogicNode};
export type AdminCourseMap = {
 id: 'gre-cloze-signals';
 title: string;
 content: ClozeLogicContent;
 version: number;
 updated_at: string;
};

const NODE_KEYS = new Set(['id', 'label', 'details', 'tone', 'children']);
function object(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === 'object' && !Array.isArray(value);
}
function boundedText(value: unknown, maximum: number): value is string {
 return typeof value === 'string' && !!value.trim() && value.length <= maximum;
}

/** A closed, bounded tree schema. React renders all labels as text, never HTML. */
export function parseClozeLogicContent(value: unknown): ClozeLogicContent | null {
 if (!object(value) || value.schemaVersion !== 1 || Object.keys(value).some(key => !['schemaVersion', 'root'].includes(key))) return null;
 const ids = new Set<string>(), ancestors = new Set<object>();
 let count = 0;
 function visit(raw: unknown, depth: number): ClozeLogicNode | null {
  if (!object(raw) || depth > 24 || ++count > 1500 || ancestors.has(raw)) return null;
  if (Object.keys(raw).some(key => !NODE_KEYS.has(key)) || !boundedText(raw.id, 160) || !boundedText(raw.label, 600) || ids.has(raw.id)) return null;
  if (raw.tone !== undefined && (typeof raw.tone !== 'string' || !['opposite', 'same', 'neutral'].includes(raw.tone))) return null;
  if (raw.details !== undefined && (!Array.isArray(raw.details) || raw.details.length > 40 || !raw.details.every(line => boundedText(line, 2400)))) return null;
  if (raw.children !== undefined && (!Array.isArray(raw.children) || raw.children.length > 300)) return null;
  ids.add(raw.id); ancestors.add(raw);
  const children: ClozeLogicNode[] = [];
  for (const child of (raw.children ?? []) as unknown[]) {
   const next = visit(child, depth + 1);
   if (!next) return null;
   children.push(next);
  }
  ancestors.delete(raw);
  return {
   id: raw.id,
   label: raw.label,
   ...(raw.tone !== undefined ? {tone: raw.tone as ClozeMapTone} : {}),
   ...(raw.details !== undefined ? {details: [...raw.details as string[]]} : {}),
   ...(raw.children !== undefined ? {children} : {}),
  };
 }
 const root = visit(value.root, 0);
 return root ? {schemaVersion: 1, root} : null;
}

export function parseAdminCourseMap(value: unknown): AdminCourseMap | null {
 if (!object(value) || value.id !== 'gre-cloze-signals' || !boundedText(value.title, 240) || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || !boundedText(value.updated_at, 100) || !Number.isFinite(Date.parse(value.updated_at))) return null;
 const content = parseClozeLogicContent(value.content);
 return content ? {id: 'gre-cloze-signals', title: value.title, content, version: Number(value.version), updated_at: value.updated_at} : null;
}

export function isExpandable(node: ClozeLogicNode): boolean {
 return !!(node.children?.length || node.details?.length);
}

export function expandableNodeIds(root: ClozeLogicNode): string[] {
 const result: string[] = [];
 function visit(node: ClozeLogicNode) {
  if (isExpandable(node)) result.push(node.id);
  node.children?.forEach(visit);
 }
 visit(root);
 return result;
}

/** Open the root and its first level; deeper branches stay available on demand. */
export function initialExpandedIds(root: ClozeLogicNode, levels = 2): Set<string> {
 const result = new Set<string>();
 function visit(node: ClozeLogicNode, depth: number) {
  if (depth >= levels) return;
  if (isExpandable(node)) result.add(node.id);
  node.children?.forEach(child => visit(child, depth + 1));
 }
 visit(root, 0);
 return result;
}

export function toggleExpandedId(current: ReadonlySet<string>, id: string): Set<string> {
 const next = new Set(current);
 if (next.has(id)) next.delete(id); else next.add(id);
 return next;
}

export function visibleNodeIds(root: ClozeLogicNode, expanded: ReadonlySet<string>): string[] {
 const result: string[] = [];
 function visit(node: ClozeLogicNode) {
  result.push(node.id);
  if (expanded.has(node.id)) node.children?.forEach(visit);
 }
 visit(root);
 return result;
}

export function countLogicNodes(root: ClozeLogicNode): number {
 return 1 + (root.children?.reduce((sum, child) => sum + countLogicNodes(child), 0) ?? 0);
}
