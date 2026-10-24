export type ClozeMapTone = 'opposite' | 'same' | 'neutral';
export type CourseQuestion = {
 id: string;
 stem: string;
 options?: {label: string; text: string}[];
 answer?: string;
 notes?: string[];
 images?: {id: string; caption?: string}[];
 source: {course: string; page: number; exercise?: string};
};
export type AdminCourseImage = {id:string;mimeType:'image/jpeg'|'image/png'|'image/webp';data:string;width:number;height:number};
export type ClozeLogicNode = {
 id: string;
 label: string;
 details?: string[];
 tone?: ClozeMapTone;
 questionIds?: string[];
 children?: ClozeLogicNode[];
};
export type ClozeLogicContent = {schemaVersion: 1; root: ClozeLogicNode; questions?: CourseQuestion[]};
export type AdminCourseMap = {
 id: 'gre-cloze-signals';
 title: string;
 content: ClozeLogicContent;
 version: number;
 updated_at: string;
};

const NODE_KEYS = new Set(['id', 'label', 'details', 'tone', 'questionIds', 'children']);
function object(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === 'object' && !Array.isArray(value);
}
function boundedText(value: unknown, maximum: number): value is string {
 return typeof value === 'string' && !!value.trim() && value.length <= maximum;
}

/** A closed, bounded tree schema. React renders all labels as text, never HTML. */
export function parseClozeLogicContent(value: unknown): ClozeLogicContent | null {
 if (!object(value) || value.schemaVersion !== 1 || Object.keys(value).some(key => !['schemaVersion', 'root', 'questions'].includes(key))) return null;
 const questions: CourseQuestion[] = [], questionIds = new Set<string>();
 if (value.questions !== undefined) {
  if (!Array.isArray(value.questions) || value.questions.length > 250) return null;
  for (const raw of value.questions) {
   if (!object(raw) || Object.keys(raw).some(key => !['id', 'stem', 'options', 'answer', 'notes', 'images', 'source'].includes(key)) || !boundedText(raw.id,160) || questionIds.has(raw.id) || !boundedText(raw.stem,12000)) return null;
   if (!object(raw.source) || Object.keys(raw.source).some(key => !['course','page','exercise'].includes(key)) || !boundedText(raw.source.course,160) || !Number.isSafeInteger(raw.source.page) || Number(raw.source.page)<1 || Number(raw.source.page)>2000 || (raw.source.exercise!==undefined && !boundedText(raw.source.exercise,60))) return null;
   if (raw.answer!==undefined && !boundedText(raw.answer,600)) return null;
   if (raw.notes!==undefined && (!Array.isArray(raw.notes) || raw.notes.length>20 || !raw.notes.every(line=>boundedText(line,3000)))) return null;
   const images:{id:string;caption?:string}[]=[];const imageIds=new Set<string>();
   if(raw.images!==undefined){
    if(!Array.isArray(raw.images)||raw.images.length>6)return null;
    for(const image of raw.images){
     if(!object(image)||Object.keys(image).some(key=>!['id','caption'].includes(key))||typeof image.id!=='string'||!/^[A-Za-z0-9._-]{1,160}$/.test(image.id)||imageIds.has(image.id)||(image.caption!==undefined&&!boundedText(image.caption,240)))return null;
     imageIds.add(image.id);images.push({id:image.id,...(image.caption!==undefined?{caption:image.caption as string}:{})});
    }
   }
   const options: {label:string;text:string}[] = [], labels=new Set<string>();
   if (raw.options!==undefined) {
    if (!Array.isArray(raw.options) || raw.options.length>18) return null;
    for (const option of raw.options) {
     if (!object(option) || Object.keys(option).some(key=>!['label','text'].includes(key)) || !boundedText(option.label,24) || !boundedText(option.text,1600) || labels.has(option.label)) return null;
     labels.add(option.label); options.push({label:option.label,text:option.text});
    }
   }
   questionIds.add(raw.id);
   questions.push({id:raw.id,stem:raw.stem,source:{course:raw.source.course,page:Number(raw.source.page),...(raw.source.exercise!==undefined?{exercise:raw.source.exercise as string}:{})},...(raw.options!==undefined?{options}:{}),...(raw.answer!==undefined?{answer:raw.answer as string}:{}),...(raw.notes!==undefined?{notes:[...raw.notes as string[]]}:{}),...(raw.images!==undefined?{images}:{})});
  }
 }
 const ids = new Set<string>(), ancestors = new Set<object>();
 let count = 0;
 function visit(raw: unknown, depth: number): ClozeLogicNode | null {
  if (!object(raw) || depth > 24 || ++count > 1500 || ancestors.has(raw)) return null;
  if (Object.keys(raw).some(key => !NODE_KEYS.has(key)) || !boundedText(raw.id, 160) || !boundedText(raw.label, 600) || ids.has(raw.id)) return null;
  if (raw.tone !== undefined && (typeof raw.tone !== 'string' || !['opposite', 'same', 'neutral'].includes(raw.tone))) return null;
  if (raw.details !== undefined && (!Array.isArray(raw.details) || raw.details.length > 40 || !raw.details.every(line => boundedText(line, 2400)))) return null;
  if (raw.questionIds !== undefined && (!Array.isArray(raw.questionIds) || raw.questionIds.length>250 || new Set(raw.questionIds).size!==raw.questionIds.length || !raw.questionIds.every(id=>typeof id==='string' && questionIds.has(id)))) return null;
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
   ...(raw.questionIds !== undefined ? {questionIds: [...raw.questionIds as string[]]} : {}),
   ...(raw.children !== undefined ? {children} : {}),
  };
 }
 const root = visit(value.root, 0);
 return root ? {schemaVersion: 1, root, ...(value.questions!==undefined?{questions}:{})} : null;
}

export function parseAdminCourseImage(raw:unknown):AdminCourseImage|null{
 if(!object(raw)||typeof raw.id!=='string'||!/^[A-Za-z0-9._-]{1,160}$/.test(raw.id)||!['image/jpeg','image/png','image/webp'].includes(String(raw.mime_type))||typeof raw.data_base64!=='string'||raw.data_base64.length<4||raw.data_base64.length>600000||raw.data_base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw.data_base64)||!Number.isSafeInteger(raw.width)||!Number.isSafeInteger(raw.height)||Number(raw.width)<1||Number(raw.width)>5000||Number(raw.height)<1||Number(raw.height)>12000)return null;
 return {id:raw.id,mimeType:raw.mime_type as AdminCourseImage['mimeType'],data:raw.data_base64,width:Number(raw.width),height:Number(raw.height)};
}

export function questionsForNode(content: ClozeLogicContent, node: ClozeLogicNode): CourseQuestion[] {
 const wanted=new Set(node.questionIds ?? []);
 return (content.questions ?? []).filter(question=>wanted.has(question.id));
}

export function updateLogicNode(root: ClozeLogicNode, nodeId: string, change: {label:string;details?:string[]}): ClozeLogicNode | null {
 if (!boundedText(change.label,600) || (change.details!==undefined && (change.details.length>40 || !change.details.every(line=>boundedText(line,2400))))) return null;
 let found=false;
 function visit(node:ClozeLogicNode):ClozeLogicNode {
  if(node.id===nodeId){found=true;return {...node,label:change.label.trim(),details:[...(change.details ?? [])]};}
  if(!node.children)return node;
  const children=node.children.map(visit);
  return children.some((child,index)=>child!==node.children![index])?{...node,children}:node;
 }
 const next=visit(root);
 return found?next:null;
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
