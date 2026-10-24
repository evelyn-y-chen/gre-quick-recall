import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {CourseMapAccessError, readAdminCourseMap, saveAdminCourseMap} from './adminCourseMapAccess';
import {countLogicNodes, expandableNodeIds, initialExpandedIds, isExpandable, toggleExpandedId, questionsForNode, updateLogicNode, type AdminCourseMap, type ClozeLogicNode} from './clozeLogicMapModel';
import {layoutClozeMap, fitMapCamera, subtreeBounds, zoomMapAt, type MapCamera} from './clozeMapLayout';
import './clozeLogicMap.css';

type LoadState = {key: string; status: 'loading' | 'ready' | 'error'; map?: AdminCourseMap; message?: string};
type Props = {session: Session | null; onClose: () => void};
type NodeDraft = {key: string; nodeId: string; label: string; details: string};
type Point = {x: number; y: number};
type PanStart = {point: Point; camera: MapCamera};
type PinchStart = {distance: number; center: Point; camera: MapCamera};
function findNode(root: ClozeLogicNode, id: string): ClozeLogicNode | undefined {
 if (root.id === id) return root;
 for (const child of root.children ?? []) {const found = findNode(child, id); if (found) return found;}
}

export default function ClozeLogicMap({session, onClose}: Props) {
 const accountKey = session?.user?.id && session.access_token ? `${session.user.id}:${session.access_token}` : '';
 const [load, setLoad] = useState<LoadState>({key: '', status: 'loading'});
 const [attempt, setAttempt] = useState(0), [expanded, setExpanded] = useState<Set<string>>(new Set());
 const [selectedId, setSelectedId] = useState(''), [mode, setMode] = useState<'overview' | 'focus' | 'free'>('overview');
 const [camera, setCamera] = useState<MapCamera>({x: 0, y: 0, scale: 1}), [size, setSize] = useState({width: 0, height: 0});
 const [pane, setPane] = useState<'questions' | 'edit' | null>(null), [questionId, setQuestionId] = useState(''), [answerOpen, setAnswerOpen] = useState(false);
 const [draft, setDraft] = useState<NodeDraft | null>(null), [saveBusy, setSaveBusy] = useState(false), [editMessage, setEditMessage] = useState(''), [conflict, setConflict] = useState(false);
 const request = useRef<AbortController | null>(null), saveRequest = useRef<AbortController | null>(null), sequence = useRef(0), saveSequence = useRef(0);
 const activeAccount = useRef(accountKey), cameraRef = useRef(camera), mounted = useRef(true);
 const closeButton = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), viewport = useRef<HTMLDivElement>(null);
 const pointers = useRef(new Map<number, Point>()), panStart = useRef<PanStart | null>(null), pinchStart = useRef<PinchStart | null>(null), suppressClickUntil = useRef(0);
 activeAccount.current = accountKey; cameraRef.current = camera;
 const current = load.key === accountKey;
 const map = current && accountKey && load.status === 'ready' ? load.map : undefined;
 const loading = !!accountKey && (!current || load.status === 'loading');
 const message = !accountKey ? '请先登录管理员账号。' : current ? load.message : undefined;
 const layout = map ? layoutClozeMap(map.content.root, expanded) : null;
 const selected = map ? findNode(map.content.root, selectedId) ?? map.content.root : undefined;
 const questions = map && selected ? questionsForNode(map.content, selected) : [];
 const question = questions.find(item => item.id === questionId) ?? questions[0];
 const editing = !!draft && draft.key === accountKey && !!map;
 const draftNode = map && draft ? findNode(map.content.root, draft.nodeId) : undefined;

 function changeCamera(next: MapCamera | ((previous: MapCamera) => MapCamera)) {
  const value = typeof next === 'function' ? next(cameraRef.current) : next;
  cameraRef.current = value; setCamera(value);
 }
 function close() {
  if (editing && !saveBusy && typeof window !== 'undefined' && !window.confirm('放弃未保存的节点修改并关闭导图？')) return;
  request.current?.abort(); saveRequest.current?.abort(); onClose();
 }
 useEffect(() => {
  const controller = new AbortController(), ticket = ++sequence.current;
  request.current?.abort(); saveRequest.current?.abort(); request.current = controller;
  setLoad({key: accountKey, status: 'loading'}); setExpanded(new Set()); setSelectedId(''); setMode('overview');
  setPane(null); setDraft(null); setSaveBusy(false); setEditMessage(''); setConflict(false); setAnswerOpen(false);
  pointers.current.clear(); panStart.current = null; pinchStart.current = null;
  void readAdminCourseMap(session, controller.signal).then(next => {
   if (controller.signal.aborted || ticket !== sequence.current) return;
   setExpanded(initialExpandedIds(next.content.root, 2)); setSelectedId(next.content.root.id);
   setLoad({key: accountKey, status: 'ready', map: next});
  }).catch(error => {
   if (controller.signal.aborted || ticket !== sequence.current) return;
   setLoad({key: accountKey, status: 'error', message: error instanceof CourseMapAccessError ? error.message : '导图暂时读取失败，请重试。'});
  });
  return () => {controller.abort(); saveRequest.current?.abort(); if (request.current === controller) request.current = null;};
 }, [accountKey, attempt]);
 useEffect(() => {
  mounted.current = true;
  if (typeof document === 'undefined') return () => {mounted.current = false; saveRequest.current?.abort();};
  const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden'; closeButton.current?.focus();
  return () => {mounted.current = false; saveRequest.current?.abort(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus?.();};
 }, []);
 useEffect(() => {
  const element = viewport.current;
  if (!element) return;
  const measure = () => setSize({width: element.clientWidth, height: element.clientHeight});
  measure();
  const wheel = (event: WheelEvent) => {
   event.preventDefault(); const rect = element.getBoundingClientRect();
   setMode('free'); changeCamera(previous => zoomMapAt(previous, previous.scale * Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * .002), {x: event.clientX - rect.left, y: event.clientY - rect.top}));
  };
  element.addEventListener('wheel', wheel, {passive: false});
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure); observer?.observe(element);
  return () => {observer?.disconnect(); element.removeEventListener('wheel', wheel);};
 }, [!!map]);
 useEffect(() => {
  if (!layout || !size.width || !size.height || mode === 'free') return;
  changeCamera(fitMapCamera(mode === 'focus' && selected ? subtreeBounds(layout, selected.id) : layout.bounds, size, 32, mode === 'focus' ? 1.15 : 1));
 }, [mode, selected?.id, size.width, size.height, layout?.bounds.width, layout?.bounds.height, map?.version]);
 useEffect(() => {setAnswerOpen(false);}, [question?.id, pane]);

 function modalKeys(event: KeyboardEvent<HTMLElement>) {
  event.stopPropagation();
  if (event.key === 'Escape') {
   event.preventDefault();
   if (pane && !saveBusy) {setPane(null); setDraft(null); setEditMessage('');} else close();
   return;
  }
  if (event.key !== 'Tab' || !panel.current) return;
  const controls = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(element => element.getClientRects().length > 0);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
  else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
 }
 function localPoint(clientX: number, clientY: number): Point {
  const rect = viewport.current?.getBoundingClientRect(); return {x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0)};
 }
 function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
  if (event.button !== 0) return;
  const interactive = (event.target as Element).closest('button,a,input,textarea,select');
  if (interactive && event.pointerType !== 'touch') return;
  const point = localPoint(event.clientX, event.clientY); pointers.current.set(event.pointerId, point);
  if (pointers.current.size === 1) panStart.current = {point, camera: cameraRef.current};
  if (pointers.current.size === 2) {
   const [a, b] = [...pointers.current.values()];
   pinchStart.current = {distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, camera: cameraRef.current};
  }
  if (!interactive) event.currentTarget.setPointerCapture(event.pointerId);
 }
 function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
  if (!pointers.current.has(event.pointerId)) return;
  const point = localPoint(event.clientX, event.clientY); pointers.current.set(event.pointerId, point);
  if (pointers.current.size >= 2 && pinchStart.current) {
   const [a, b] = [...pointers.current.values()], start = pinchStart.current;
   const center = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
   const zoomed = zoomMapAt(start.camera, start.camera.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.distance, start.center);
   setMode('free'); changeCamera({...zoomed, x: zoomed.x + center.x - start.center.x, y: zoomed.y + center.y - start.center.y});
   suppressClickUntil.current = Date.now() + 250; event.currentTarget.setPointerCapture(event.pointerId); return;
  }
  const start = panStart.current;
  if (!start || Math.hypot(point.x - start.point.x, point.y - start.point.y) < 5) return;
  setMode('free'); changeCamera({...start.camera, x: start.camera.x + point.x - start.point.x, y: start.camera.y + point.y - start.point.y});
  suppressClickUntil.current = Date.now() + 250; event.currentTarget.setPointerCapture(event.pointerId);
 }
 function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
  pointers.current.delete(event.pointerId); pinchStart.current = null;
  const remaining = [...pointers.current.values()][0]; panStart.current = remaining ? {point: remaining, camera: cameraRef.current} : null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
 }
 function zoomBy(factor: number) {setMode('free'); changeCamera(previous => zoomMapAt(previous, previous.scale * factor, {x: size.width / 2, y: size.height / 2}));}
 function panorama() {setMode('overview'); if (layout) changeCamera(fitMapCamera(layout.bounds, size));}
 function focusSelected() {if (layout && selected) {setMode('focus'); changeCamera(fitMapCamera(subtreeBounds(layout, selected.id), size, 32, 1.15));}}
 function editSelected() {
  if (!selected || editing) return;
  setDraft({key: accountKey, nodeId: selected.id, label: selected.label, details: selected.details?.join('\n') ?? ''});
  setEditMessage(''); setConflict(false); setPane('edit');
 }
 async function saveNode(event: FormEvent) {
  event.preventDefault();
  if (!map || !draft || draft.key !== accountKey || saveBusy) return;
  const label = draft.label.trim(), details = draft.details.split('\n').filter(line => line.trim());
  if (!label) {setEditMessage('请填写节点名称。'); return;}
  if (details.length > 40 || details.some(line => line.length > 2400)) {setEditMessage('每行内容请控制在2400字以内，最多40行。'); return;}
  const controller = new AbortController(), owner = accountKey, ticket = ++saveSequence.current;
  saveRequest.current?.abort(); saveRequest.current = controller; setSaveBusy(true); setEditMessage(''); setConflict(false);
  try {
   const root = updateLogicNode(map.content.root, draft.nodeId, {label, details});
   if (!root) throw new Error('这个节点已经变更，请读取最新版本后核对。');
   const next = {...map, content: {...map.content, root}};
   const saved = await saveAdminCourseMap(session, next, controller.signal);
   if (!mounted.current || controller.signal.aborted || activeAccount.current !== owner || ticket !== saveSequence.current) return;
   setLoad({key: owner, status: 'ready', map: saved}); setDraft(null); setPane(null);
  } catch (error) {
   if (!mounted.current || controller.signal.aborted || activeAccount.current !== owner || ticket !== saveSequence.current) return;
   setConflict(error instanceof CourseMapAccessError && error.code === 'conflict');
   setEditMessage(error instanceof Error ? error.message : '保存失败，修改已保留，请重试。');
  } finally {
   if (mounted.current && activeAccount.current === owner && ticket === saveSequence.current) setSaveBusy(false);
  }
 }
 async function readLatestForEdit() {
  if (!editing || saveBusy) return;
  const controller = new AbortController(), owner = accountKey, ticket = ++saveSequence.current;
  saveRequest.current?.abort(); saveRequest.current = controller; setSaveBusy(true);
  try {
   const latest = await readAdminCourseMap(session, controller.signal);
   if (!mounted.current || controller.signal.aborted || activeAccount.current !== owner || ticket !== saveSequence.current) return;
   setLoad({key: owner, status: 'ready', map: latest}); setConflict(false); setEditMessage('已读取最新版本。请核对下方已保存内容，再决定是否保存你的修改。');
  } catch (error) {if (mounted.current && !controller.signal.aborted && activeAccount.current === owner && ticket === saveSequence.current) setEditMessage(error instanceof Error ? error.message : '读取失败，修改仍保留。');}
  finally {if (mounted.current && activeAccount.current === owner && ticket === saveSequence.current) setSaveBusy(false);}
 }

 return <div className="clozeMapOverlay"><section className="clozeLogicMap" ref={panel} role="dialog" aria-modal="true" aria-labelledby="cloze-map-title" onKeyDown={modalKeys}>
  <header className="clozeMapHeader"><div><p className="clozeMapEyebrow">LEMNOTA · 填空逻辑</p><h1 id="cloze-map-title">{map?.title ?? '填空标志词导图'}</h1><p className="clozeMapIntro" id="cloze-map-instructions">点击节点展开，拖动平移，滚轮或双指缩放；小题标记可打开课堂原题。</p></div><button type="button" className="clozeMapClose" ref={closeButton} onClick={close} aria-label="关闭填空标志词导图">关闭 <span aria-hidden="true">×</span></button></header>
  {map && <div className="clozeMapToolbar" aria-label="导图操作"><div className="clozeMapActions">
   <button type="button" className={mode === 'overview' ? 'isActive' : ''} onClick={panorama}>全景</button><button type="button" onClick={focusSelected}>聚焦知识点</button>
   <button type="button" onClick={() => {setExpanded(new Set(expandableNodeIds(map.content.root))); setMode('overview');}}>全部展开</button><button type="button" onClick={() => {setExpanded(new Set()); setSelectedId(map.content.root.id); if (pane === 'questions') setPane(null); setMode('overview');}}>全部收起</button>
   <button type="button" onClick={editSelected} disabled={saveBusy || editing}>编辑节点</button>
  </div><div className="clozeMapZoom" role="group" aria-label="缩放导图"><button type="button" aria-label="缩小导图" disabled={camera.scale <= .04} onClick={() => zoomBy(.8)}>−</button><button type="button" className="clozeMapZoomReset" aria-label="恢复百分之百缩放" onClick={() => {setMode('free'); changeCamera(previous => zoomMapAt(previous, 1, {x: size.width / 2, y: size.height / 2}));}}>{Math.round(camera.scale * 100)}%</button><button type="button" aria-label="放大导图" disabled={camera.scale >= 2.4} onClick={() => zoomBy(1.25)}>+</button><button type="button" onClick={panorama}>适应屏幕</button></div></div>}
  {loading ? <div className="clozeMapState" role="status"><span className="clozeMapLoadingDot" aria-hidden="true"/><h2>正在打开导图</h2><p>正在确认管理员权限并读取内容…</p></div> : !map || !layout ? <div className="clozeMapState"><span className="clozeMapStateIcon" aria-hidden="true">↳</span><h2>暂时无法打开导图</h2><p role="alert">{message ?? '导图暂时读取失败，请重试。'}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重新读取</button></div> : <>
   <div className={`clozeMapWorkspace ${pane ? 'hasPane' : ''}`}><div className="clozeMapViewport" ref={viewport} tabIndex={0} role="region" aria-label="可平移缩放的填空标志词导图" aria-describedby="cloze-map-instructions"
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
    onClickCapture={event => {if (Date.now() < suppressClickUntil.current) {event.preventDefault(); event.stopPropagation();}}}
    onKeyDown={event => {if (event.target !== event.currentTarget || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); setMode('free'); const dx = event.key === 'ArrowLeft' ? 50 : event.key === 'ArrowRight' ? -50 : 0, dy = event.key === 'ArrowUp' ? 50 : event.key === 'ArrowDown' ? -50 : 0; changeCamera(previous => ({...previous, x: previous.x + dx, y: previous.y + dy}));}}>
    <svg className="clozeMapScene" role="group" aria-label="填空逻辑关系" width="100%" height="100%"><g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
     {layout.racks.map(rack => <rect key={rack.parentId} className={`clozeMapLeafRack tone-${rack.tone}`} x={rack.x} y={rack.y} width={rack.width} height={rack.height} rx={22}/>)}
     {layout.edges.map(edge => <path key={`${edge.from}:${edge.to}`} className={`clozeMapCurve tone-${edge.tone}`} d={edge.path} fill="none"/>)}
     {layout.nodes.map(item => {
      const node = item.node, open = expanded.has(node.id), related = questionsForNode(map.content, node), expandable = isExpandable(node);
      return <foreignObject key={node.id} x={item.x} y={item.y} width={item.width} height={item.height} overflow="visible"><div className={`clozeMapHtmlNode tone-${item.tone} ${item.leaf ? 'isLeaf' : ''} ${node.id === map.content.root.id ? 'isRoot' : ''} ${selected?.id === node.id ? 'isSelected' : ''}`}>
       <button type="button" className="clozeMapNodeToggle" aria-expanded={expandable ? open : undefined} aria-pressed={selected?.id === node.id} onDoubleClick={() => {setSelectedId(node.id); setMode('focus');}} onClick={() => {
        setSelectedId(node.id);
        if (!node.children?.length && related.length && !editing) {setQuestionId(related[0].id); setPane('questions'); setAnswerOpen(false); return;}
        if (expandable) setExpanded(previous => toggleExpandedId(previous, node.id));
       }}>
        <span>{node.label}</span>{expandable && <i aria-hidden="true">{open ? '−' : '+'}</i>}
       </button>
       {!!related.length && <button type="button" className="clozeMapQuestionMark" disabled={saveBusy} aria-label={`${node.label}关联${related.length}道课堂题目`} title={`查看${related.length}道课堂原题`} onClick={event => {event.stopPropagation(); if (editing && !window.confirm('放弃未保存的节点修改并查看原题？')) return; setDraft(null); setSelectedId(node.id); setQuestionId(related[0].id); setPane('questions'); setAnswerOpen(false);}}><span aria-hidden="true">▤</span><small>{related.length}</small></button>}
       {open && !!node.details?.length && <ul className="clozeMapDetails">{node.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
      </div></foreignObject>;
     })}
    </g></svg>
    <div className="clozeMapSelection" aria-live="polite"><span>{selected?.label}</span><small>{layout.nodes.length} / {countLogicNodes(map.content.root)} 个节点</small></div>
   </div>
   {pane && <aside className="clozeMapSidePane" aria-label={pane === 'edit' ? '编辑节点' : '课堂原题'}><header><div><p>{pane === 'edit' ? '编辑节点' : '课堂原题'}</p><h2>{pane === 'edit' && draft ? draft.label : selected?.label}</h2></div><button type="button" aria-label="关闭侧栏" disabled={saveBusy} onClick={() => {setPane(null); setDraft(null); setEditMessage('');}}>×</button></header>
    <div className="clozeMapPaneBody">{pane === 'questions' ? question ? <>
     {questions.length > 1 && <nav className="clozeMapQuestionNav" aria-label="选择课堂题目">{questions.map((item, index) => <button key={item.id} className={item.id === question.id ? 'isActive' : ''} onClick={() => setQuestionId(item.id)}>题 {index + 1}</button>)}</nav>}
     <p className="clozeMapQuestionSource">{question.source.course} · p.{question.source.page}{question.source.exercise ? ` · ${question.source.exercise}` : ''}</p>
     <p className="clozeMapQuestionStem">{question.stem}</p>
     {!!question.options?.length && <ol className="clozeMapQuestionOptions">{question.options.map((option, index) => <li key={`${option.label}-${index}`}><strong>{option.label}</strong><span>{option.text}</span></li>)}</ol>}
     {!!question.notes?.length && <div className="clozeMapQuestionNotes"><h3>课堂笔记</h3>{question.notes.map((note, index) => <p key={index}>{note}</p>)}</div>}
     {question.answer && <div className="clozeMapAnswer"><button type="button" aria-expanded={answerOpen} onClick={() => setAnswerOpen(value => !value)}>{answerOpen ? '收起答案' : '查看答案'}</button>{answerOpen && <p>{question.answer}</p>}</div>}
    </> : <p className="clozeMapPaneHint">这个知识点还没有关联原题。</p> : editing && draft ? <form onSubmit={saveNode} className="clozeMapEditForm">
     <p className="clozeMapPaneHint">修改只会在点击“保存修改”后提交。</p><label>节点名称<input autoFocus maxLength={600} value={draft.label} disabled={saveBusy} onChange={event => setDraft(previous => previous ? {...previous, label: event.target.value} : null)}/></label>
     <label>节点内容<textarea rows={8} value={draft.details} disabled={saveBusy} placeholder="每行一条，留空可清除节点内容" onChange={event => setDraft(previous => previous ? {...previous, details: event.target.value} : null)}/></label>
     {editMessage && <p className="clozeMapEditMessage" role="alert">{editMessage}</p>}
     {conflict && <button type="button" disabled={saveBusy} onClick={() => void readLatestForEdit()}>读取最新版本并核对</button>}
     <div className="clozeMapEditActions"><button type="submit" className="primary" disabled={saveBusy}>{saveBusy ? '正在保存…' : '保存修改'}</button><button type="button" disabled={saveBusy} onClick={() => {setDraft(null); setPane(null); setEditMessage('');}}>取消</button></div>
     {draftNode && <details className="clozeMapSavedPreview"><summary>查看当前已保存内容 · v{map.version}</summary><strong>{draftNode.label}</strong>{draftNode.details?.map((detail, index) => <p key={index}>{detail}</p>)}</details>}
    </form> : null}</div>
   </aside>}
   </div><footer className="clozeMapFooter"><div className="clozeMapLegend"><span><i className="opposite"/>反义类</span><span><i className="same"/>同义类</span></div><span>双击节点聚焦 · 标志词与逻辑节点</span></footer>
  </>}
 </section></div>;
}
