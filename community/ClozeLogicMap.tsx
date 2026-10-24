import {useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {CourseMapAccessError, readAdminCourseMap, readAdminCourseImage, saveAdminCourseMap} from './adminCourseMapAccess';
import {countLogicNodes, expandableNodeIds, initialExpandedIds, isExpandable, toggleExpandedId, questionsForNode, updateLogicNode, type AdminCourseMap, type ClozeLogicNode} from './clozeLogicMapModel';
import {layoutClozeMap, fitMapCamera, subtreeBounds, zoomMapAt, type MapCamera} from './clozeMapLayout';
import './clozeLogicMap.css';

type LoadState = {key: string; status: 'loading' | 'ready' | 'error'; map?: AdminCourseMap; message?: string};
type Props = {session: Session | null; onClose: () => void};
type NodeDraft = {key: string; nodeId: string; label: string; details: string};
type Point = {x: number; y: number};
type PanStart = {point: Point; camera: MapCamera};
type PinchStart = {distance: number; center: Point; camera: MapCamera};
type CourseImage = {id: string; mimeType: string; data: string; width: number; height: number};
type ImageLoad = {key: string; status: 'idle' | 'loading' | 'ready' | 'error'; image?: CourseImage; message?: string};
type FullscreenHost = HTMLDivElement & {webkitRequestFullscreen?: () => void | Promise<void>};
type FullscreenDocument = Document & {webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void | Promise<void>};
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
 const [fullscreen, setFullscreen] = useState(false), [fullscreenMessage, setFullscreenMessage] = useState('');
 const [questionDisplay, setQuestionDisplay] = useState<{key: string; mode: 'image' | 'text'; imageId?: string}>({key: '', mode: 'image'});
 const [imageLoad, setImageLoad] = useState<ImageLoad>({key: '', status: 'idle'}), [imageAttempt, setImageAttempt] = useState(0);
 const [imageView, setImageView] = useState({key: '', expanded: false, scale: 0});
 const request = useRef<AbortController | null>(null), saveRequest = useRef<AbortController | null>(null), sequence = useRef(0), saveSequence = useRef(0);
 const imageRequest = useRef<AbortController | null>(null), imageSequence = useRef(0);
 const activeAccount = useRef(accountKey), cameraRef = useRef(camera), mounted = useRef(true);
 const closeButton = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), viewport = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null), imageViewport = useRef<HTMLDivElement>(null);
 const pointers = useRef(new Map<number, Point>()), panStart = useRef<PanStart | null>(null), pinchStart = useRef<PinchStart | null>(null), suppressClickUntil = useRef(0);
 const gestureMoved = useRef(false);
 const lastPointerType = useRef('mouse'), pendingNodeClick = useRef<{timer: ReturnType<typeof setTimeout>; key: string} | null>(null);
 activeAccount.current = accountKey; cameraRef.current = camera;
 const current = load.key === accountKey;
 const map = current && accountKey && load.status === 'ready' ? load.map : undefined;
 const loading = !!accountKey && (!current || load.status === 'loading');
 const message = !accountKey ? '请先登录管理员账号。' : current ? load.message : undefined;
 const layout = map ? layoutClozeMap(map.content.root, expanded) : null;
 const selected = map ? findNode(map.content.root, selectedId) ?? map.content.root : undefined;
 const questions = map && selected ? questionsForNode(map.content, selected) : [];
 const question = questions.find(item => item.id === questionId) ?? questions[0];
 const questionKey = map && pane === 'questions' && question ? `${accountKey}:${question.id}` : '';
 const imageReferences = question?.images ?? [];
 const display = questionDisplay.key === questionKey ? questionDisplay.mode : 'image';
 const imageReference = imageReferences.find(item => questionDisplay.key === questionKey && item.id === questionDisplay.imageId) ?? imageReferences[0];
 const imageScope = questionKey && display === 'image' && imageReference ? `${questionKey}:${imageReference.id}` : '';
 const image = imageScope && imageLoad.key === imageScope && imageLoad.status === 'ready' ? imageLoad.image : undefined;
 const imageExpanded = !!imageScope && imageView.key === imageScope && imageView.expanded;
 const imageScale = imageView.key === imageScope ? imageView.scale : 0;
 const editing = !!draft && draft.key === accountKey && !!map;
 const draftNode = map && draft ? findNode(map.content.root, draft.nodeId) : undefined;

 function changeCamera(next: MapCamera | ((previous: MapCamera) => MapCamera)) {
  const value = typeof next === 'function' ? next(cameraRef.current) : next;
  cameraRef.current = value; setCamera(value);
 }
 function cancelPendingNodeClick() {
  if (pendingNodeClick.current) clearTimeout(pendingNodeClick.current.timer);
  pendingNodeClick.current = null;
 }
 function close() {
  if (editing && !saveBusy && typeof window !== 'undefined' && !window.confirm('放弃未保存的节点修改并关闭导图？')) return;
  cancelPendingNodeClick(); request.current?.abort(); saveRequest.current?.abort(); imageRequest.current?.abort(); onClose();
 }
 useEffect(() => {
  const controller = new AbortController(), ticket = ++sequence.current;
  cancelPendingNodeClick(); request.current?.abort(); saveRequest.current?.abort(); imageRequest.current?.abort(); request.current = controller;
  setLoad({key: accountKey, status: 'loading'}); setExpanded(new Set()); setSelectedId(''); setMode('overview');
  setPane(null); setDraft(null); setSaveBusy(false); setEditMessage(''); setConflict(false); setAnswerOpen(false);
  setQuestionDisplay({key: '', mode: 'image'}); setImageLoad({key: '', status: 'idle'}); setImageView({key: '', expanded: false, scale: 0});
  pointers.current.clear(); panStart.current = null; pinchStart.current = null;
  void readAdminCourseMap(session, controller.signal).then(next => {
   if (controller.signal.aborted || ticket !== sequence.current) return;
   setExpanded(initialExpandedIds(next.content.root, 2)); setSelectedId(next.content.root.id);
   setLoad({key: accountKey, status: 'ready', map: next});
  }).catch(error => {
   if (controller.signal.aborted || ticket !== sequence.current) return;
   setLoad({key: accountKey, status: 'error', message: error instanceof CourseMapAccessError ? error.message : '导图暂时读取失败，请重试。'});
  });
  return () => {cancelPendingNodeClick(); controller.abort(); saveRequest.current?.abort(); imageRequest.current?.abort(); if (request.current === controller) request.current = null;};
 }, [accountKey, attempt]);
 useEffect(() => {
  mounted.current = true;
  if (typeof document === 'undefined') return () => {mounted.current = false; cancelPendingNodeClick(); saveRequest.current?.abort(); imageRequest.current?.abort();};
  const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden'; closeButton.current?.focus();
  return () => {mounted.current = false; cancelPendingNodeClick(); saveRequest.current?.abort(); imageRequest.current?.abort(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus?.();};
 }, []);
 useEffect(() => {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument, host = overlay.current;
  const update = () => setFullscreen(!!host && (doc.fullscreenElement === host || doc.webkitFullscreenElement === host));
  doc.addEventListener('fullscreenchange', update); doc.addEventListener('webkitfullscreenchange', update); update();
  return () => {
   doc.removeEventListener('fullscreenchange', update); doc.removeEventListener('webkitfullscreenchange', update);
   if (host && (doc.fullscreenElement === host || doc.webkitFullscreenElement === host)) {
    try {void Promise.resolve(doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.()).catch(() => {});} catch { /* Closing the panel still releases its full viewport. */ }
   }
  };
 }, []);
 useEffect(() => {
  const controller = new AbortController(), ticket = ++imageSequence.current, owner = accountKey;
  imageRequest.current?.abort(); imageRequest.current = controller;
  if (!imageScope || !imageReference) {setImageLoad({key: '', status: 'idle'}); return () => controller.abort();}
  setImageLoad({key: imageScope, status: 'loading'});
  void readAdminCourseImage(session, imageReference.id, controller.signal).then(next => {
   if (!mounted.current || controller.signal.aborted || ticket !== imageSequence.current || activeAccount.current !== owner) return;
   setImageLoad({key: imageScope, status: 'ready', image: next});
  }).catch(error => {
   if (!mounted.current || controller.signal.aborted || ticket !== imageSequence.current || activeAccount.current !== owner) return;
   setImageLoad({key: imageScope, status: 'error', message: error instanceof Error ? error.message : '课堂截图暂时读取失败，请重试。'});
  });
  return () => {controller.abort(); if (imageRequest.current === controller) imageRequest.current = null;};
 }, [imageScope, imageAttempt]);
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
 }, [mode, selected?.id, size.width, size.height, layout?.bounds.width, layout?.bounds.height, map?.version, expanded]);
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
  lastPointerType.current = event.pointerType || 'mouse';
  if (!pointers.current.size) suppressClickUntil.current = 0;
  const interactive = (event.target as Element).closest('button,a,input,textarea,select');
  if (interactive?.matches('input,textarea,select')) return;
  if (interactive && event.pointerType !== 'touch') return;
  const point = localPoint(event.clientX, event.clientY); pointers.current.set(event.pointerId, point);
  if (pointers.current.size === 1) {gestureMoved.current = false; panStart.current = {point, camera: cameraRef.current};}
  if (pointers.current.size === 2) {
   gestureMoved.current = true;
   const [a, b] = [...pointers.current.values()];
   pinchStart.current = {distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, camera: cameraRef.current};
  }
  // Touch buttons keep their native click target until a drag is established.
  // Background mouse capture also receives releases outside the viewport.
  if (!interactive && event.pointerType === 'mouse') event.currentTarget.setPointerCapture(event.pointerId);
 }
 function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
  if (event.pointerType === 'mouse' && event.buttons === 0) {pointerUp(event); return;}
  if (!pointers.current.has(event.pointerId)) return;
  const point = localPoint(event.clientX, event.clientY); pointers.current.set(event.pointerId, point);
  if (pointers.current.size >= 2 && pinchStart.current) {
   const [a, b] = [...pointers.current.values()], start = pinchStart.current;
   const center = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
   const zoomed = zoomMapAt(start.camera, start.camera.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.distance, start.center);
   gestureMoved.current = true;
   setMode('free'); changeCamera({...zoomed, x: zoomed.x + center.x - start.center.x, y: zoomed.y + center.y - start.center.y});
   suppressClickUntil.current = Date.now() + 250; event.currentTarget.setPointerCapture(event.pointerId); return;
  }
  const start = panStart.current;
  if (!start || Math.hypot(point.x - start.point.x, point.y - start.point.y) < 8) return;
  gestureMoved.current = true;
  setMode('free'); changeCamera({...start.camera, x: start.camera.x + point.x - start.point.x, y: start.camera.y + point.y - start.point.y});
  suppressClickUntil.current = Date.now() + 250; event.currentTarget.setPointerCapture(event.pointerId);
 }
 function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
  if (pointers.current.has(event.pointerId) && gestureMoved.current) suppressClickUntil.current = Date.now() + 500;
  pointers.current.delete(event.pointerId); pinchStart.current = null;
  const remaining = [...pointers.current.values()][0]; panStart.current = remaining ? {point: remaining, camera: cameraRef.current} : null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
 }
 function zoomBy(factor: number) {setMode('free'); changeCamera(previous => zoomMapAt(previous, previous.scale * factor, {x: size.width / 2, y: size.height / 2}));}
 async function toggleFullscreen() {
  const host = overlay.current as FullscreenHost | null;
  if (!host || typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  setFullscreenMessage('');
  try {
   if (doc.fullscreenElement === host || doc.webkitFullscreenElement === host) await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
   else if (host.requestFullscreen) await host.requestFullscreen();
   else if (host.webkitRequestFullscreen) await host.webkitRequestFullscreen();
   else setFullscreenMessage('已铺满当前浏览器窗口。');
  } catch {setFullscreenMessage('已铺满当前浏览器窗口。');}
 }
 function zoomImageBy(factor: number) {
  if (!image || !imageScope) return;
  const fitted = Math.min(1, Math.max(1, (imageViewport.current?.clientWidth ?? image.width) - 32) / image.width);
  setImageView(previous => ({key: imageScope, expanded: previous.key === imageScope && previous.expanded, scale: Math.max(.1, Math.min(3, (previous.key === imageScope && previous.scale ? previous.scale : fitted) * factor))}));
 }
 function activateNode(node: ClozeLogicNode) {
  setSelectedId(node.id);
  const related = map ? questionsForNode(map.content, node) : [];
  if (!node.children?.length && related.length && !editing) {setQuestionId(related[0].id); setPane('questions'); setAnswerOpen(false); return;}
  if (isExpandable(node)) setExpanded(previous => toggleExpandedId(previous, node.id));
 }
 function clickNode(node: ClozeLogicNode, event: ReactMouseEvent<HTMLButtonElement>) {
  const pointerType = (event?.nativeEvent as PointerEvent | undefined)?.pointerType || lastPointerType.current;
  const detail = event?.detail ?? 0;
  cancelPendingNodeClick();
  if (detail === 0 || pointerType !== 'mouse') {activateNode(node); return;}
  if (detail > 1) return;
  // Keep every node and its hit target still between the two physical clicks.
  // Touch, pen and keyboard activation do not wait for mouse double-clicks.
  const owner = accountKey;
  const timer = setTimeout(() => {
   if (!mounted.current || activeAccount.current !== owner || pendingNodeClick.current?.timer !== timer) return;
   pendingNodeClick.current = null; activateNode(node);
  }, 260);
  pendingNodeClick.current = {timer, key: owner};
 }
 function doubleClickNode(node: ClozeLogicNode, event: ReactMouseEvent<HTMLButtonElement>) {
  if (lastPointerType.current !== 'mouse') return;
  event.preventDefault(); cancelPendingNodeClick(); setSelectedId(node.id);
  if (isExpandable(node)) setExpanded(previous => new Set([...previous, node.id]));
  setMode('focus');
 }
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

 return <div className="clozeMapOverlay" ref={overlay}><section className="clozeLogicMap" ref={panel} role="dialog" aria-modal="true" aria-labelledby="cloze-map-title" onKeyDown={modalKeys} onPointerDownCapture={event => {lastPointerType.current = event.pointerType || 'mouse'; if (!(event.target as Element).closest('.clozeMapNodeToggle')) cancelPendingNodeClick();}}>
  <header className="clozeMapHeader"><div><p className="clozeMapEyebrow">LEMNOTA · 填空逻辑</p><h1 id="cloze-map-title">{map?.title ?? '填空标志词导图'}</h1><p className="clozeMapIntro" id="cloze-map-instructions">点击节点展开，拖动平移，滚轮或双指缩放；小题标记可打开课堂原题。</p>{fullscreenMessage && <p className="clozeMapFullscreenStatus" role="status">{fullscreenMessage}</p>}</div><div className="clozeMapHeaderActions"><button type="button" className="clozeMapFullscreen" aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? '退出全屏' : '全屏'}</button><button type="button" className="clozeMapClose" ref={closeButton} onClick={close} aria-label="关闭填空标志词导图">关闭 <span aria-hidden="true">×</span></button></div></header>
  {map && <div className="clozeMapToolbar" aria-label="导图操作"><div className="clozeMapActions">
   <button type="button" className={mode === 'overview' ? 'isActive' : ''} onClick={panorama}>全景</button><button type="button" onClick={focusSelected}>聚焦知识点</button>
   <button type="button" onClick={() => {setExpanded(new Set(expandableNodeIds(map.content.root))); setMode('overview');}}>全部展开</button><button type="button" onClick={() => {setExpanded(new Set()); setSelectedId(map.content.root.id); if (pane === 'questions') setPane(null); setMode('overview');}}>全部收起</button>
   <button type="button" onClick={editSelected} disabled={saveBusy || editing}>编辑节点</button>
  </div><div className="clozeMapZoom" role="group" aria-label="缩放导图"><button type="button" aria-label="缩小导图" disabled={camera.scale <= .04} onClick={() => zoomBy(.8)}>−</button><button type="button" className="clozeMapZoomReset" aria-label="恢复百分之百缩放" onClick={() => {setMode('free'); changeCamera(previous => zoomMapAt(previous, 1, {x: size.width / 2, y: size.height / 2}));}}>{Math.round(camera.scale * 100)}%</button><button type="button" aria-label="放大导图" disabled={camera.scale >= 2.4} onClick={() => zoomBy(1.25)}>+</button><button type="button" onClick={panorama}>适应屏幕</button></div></div>}
  {loading ? <div className="clozeMapState" role="status"><span className="clozeMapLoadingDot" aria-hidden="true"/><h2>正在打开导图</h2><p>正在确认管理员权限并读取内容…</p></div> : !map || !layout ? <div className="clozeMapState"><span className="clozeMapStateIcon" aria-hidden="true">↳</span><h2>暂时无法打开导图</h2><p role="alert">{message ?? '导图暂时读取失败，请重试。'}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重新读取</button></div> : <>
   <div className={`clozeMapWorkspace ${pane ? 'hasPane' : ''} ${imageExpanded ? 'isReadingImage' : ''}`}><div className="clozeMapViewport" ref={viewport} tabIndex={0} role="region" aria-label="可平移缩放的填空标志词导图" aria-describedby="cloze-map-instructions"
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
    onClickCapture={event => {if (event.detail !== 0 && Date.now() < suppressClickUntil.current) {suppressClickUntil.current = 0; event.preventDefault(); event.stopPropagation();}}}
    onKeyDown={event => {if (event.target !== event.currentTarget || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); setMode('free'); const dx = event.key === 'ArrowLeft' ? 50 : event.key === 'ArrowRight' ? -50 : 0, dy = event.key === 'ArrowUp' ? 50 : event.key === 'ArrowDown' ? -50 : 0; changeCamera(previous => ({...previous, x: previous.x + dx, y: previous.y + dy}));}}>
    <div className="clozeMapStage" style={{width: layout.bounds.width, height: layout.bounds.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`}}>
    <svg className="clozeMapScene" aria-hidden="true" width={layout.bounds.width} height={layout.bounds.height}>
     {layout.racks.map(rack => <rect key={rack.parentId} className={`clozeMapLeafRack tone-${rack.tone}`} x={rack.x} y={rack.y} width={rack.width} height={rack.height} rx={22}/>)}
     {layout.edges.map(edge => <path key={`${edge.from}:${edge.to}`} className={`clozeMapCurve tone-${edge.tone}`} d={edge.path} fill="none"/>)}
    </svg><div className="clozeMapNodes" role="group" aria-label="填空逻辑关系">
     {layout.nodes.map(item => {
      const node = item.node, open = expanded.has(node.id), related = questionsForNode(map.content, node), expandable = isExpandable(node);
      return <div key={node.id} className={`clozeMapHtmlNode tone-${item.tone} ${item.leaf ? 'isLeaf' : ''} ${node.id === map.content.root.id ? 'isRoot' : ''} ${selected?.id === node.id ? 'isSelected' : ''}`} style={{left: item.x, top: item.y, width: item.width, height: item.height}}>
       <button type="button" className="clozeMapNodeToggle" aria-expanded={expandable ? open : undefined} aria-pressed={selected?.id === node.id} onDoubleClick={event => doubleClickNode(node, event)} onClick={event => clickNode(node, event)}>
        <span>{node.label}</span>{expandable && <i aria-hidden="true">{open ? '−' : '+'}</i>}
       </button>
       {!!related.length && <button type="button" className="clozeMapQuestionMark" disabled={saveBusy} aria-label={`${node.label}关联${related.length}道课堂题目`} title={`查看${related.length}道课堂原题`} onClick={event => {event.stopPropagation(); if (editing && !window.confirm('放弃未保存的节点修改并查看原题？')) return; setDraft(null); setSelectedId(node.id); setQuestionId(related[0].id); setPane('questions'); setAnswerOpen(false);}}><span aria-hidden="true">▤</span><small>{related.length}</small></button>}
       {open && !!node.details?.length && <ul className="clozeMapDetails">{node.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
      </div>;
     })}
    </div></div>
    <div className="clozeMapSelection" aria-live="polite"><span>{selected?.label}</span><small>{layout.nodes.length} / {countLogicNodes(map.content.root)} 个节点</small></div>
   </div>
   {pane && <aside className={`clozeMapSidePane ${imageExpanded ? 'isImageExpanded' : ''}`} aria-label={pane === 'edit' ? '编辑节点' : '课堂原题'}><header><div><p>{pane === 'edit' ? '编辑节点' : '课堂原题'}</p><h2>{pane === 'edit' && draft ? draft.label : selected?.label}</h2></div><button type="button" aria-label="关闭侧栏" disabled={saveBusy} onClick={() => {setPane(null); setDraft(null); setEditMessage('');}}>×</button></header>
    <div className={`clozeMapPaneBody ${pane === 'questions' && !!imageReferences.length && display === 'image' ? 'hasImageReader' : ''}`}>{pane === 'questions' ? question ? <>
     {questions.length > 1 && <nav className="clozeMapQuestionNav" aria-label="选择课堂题目">{questions.map((item, index) => <button key={item.id} className={item.id === question.id ? 'isActive' : ''} onClick={() => setQuestionId(item.id)}>题 {index + 1}</button>)}</nav>}
     <p className="clozeMapQuestionSource">{question.source.course} · p.{question.source.page}{question.source.exercise ? ` · ${question.source.exercise}` : ''}</p>
     {!!imageReferences.length && <div className="clozeMapQuestionView" role="group" aria-label="原题阅读方式"><button type="button" aria-pressed={display === 'image'} onClick={() => setQuestionDisplay({key: questionKey, mode: 'image', imageId: imageReference?.id})}>课堂截图</button><button type="button" aria-pressed={display === 'text'} onClick={() => setQuestionDisplay({key: questionKey, mode: 'text'})}>文字版</button></div>}
     {!!imageReferences.length && display === 'image' ? <>
      {imageReferences.length > 1 && <nav className="clozeMapImageNav" aria-label="选择课堂截图">{imageReferences.map((item, index) => <button type="button" key={item.id} aria-pressed={item.id === imageReference?.id} onClick={() => setQuestionDisplay({key: questionKey, mode: 'image', imageId: item.id})}>截图 {index + 1}</button>)}</nav>}
      {image ? <><div className="clozeMapImageToolbar" role="group" aria-label="截图缩放"><button type="button" onClick={() => setImageView(previous => ({key: imageScope, scale: previous.key === imageScope ? previous.scale : 0, expanded: !imageExpanded}))}>{imageExpanded ? '返回导图' : '展开截图'}</button><button type="button" aria-label="缩小课堂截图" disabled={!!imageScale && imageScale <= .1} onClick={() => zoomImageBy(.8)}>−</button><button type="button" onClick={() => setImageView({key: imageScope, expanded: imageExpanded, scale: 0})}>适宽</button><button type="button" onClick={() => setImageView({key: imageScope, expanded: imageExpanded, scale: 1})}>原尺寸</button><button type="button" aria-label="放大课堂截图" disabled={imageScale >= 3} onClick={() => zoomImageBy(1.25)}>+</button>{!!imageScale && <span>{Math.round(imageScale * 100)}%</span>}</div><div className="clozeMapImageViewport" ref={imageViewport}><button type="button" className="clozeMapImageOpen" aria-label={imageExpanded ? '课堂截图' : '展开课堂截图'} onClick={() => setImageView({key: imageScope, expanded: true, scale: imageScale})} style={{width: imageScale ? image.width * imageScale : '100%'}}><img className="clozeMapQuestionImage" src={`data:${image.mimeType};base64,${image.data}`} width={image.width} height={image.height} draggable={false} alt={imageReference?.caption ?? `${question.source.course}第${question.source.page}页课堂截图`}/></button></div>{imageReference?.caption && <p className="clozeMapImageCaption">{imageReference.caption}</p>}</> : imageLoad.key === imageScope && imageLoad.status === 'error' ? <div className="clozeMapImageState"><p role="alert">{imageLoad.message}</p><button type="button" onClick={() => setImageAttempt(value => value + 1)}>重新读取截图</button><button type="button" onClick={() => setQuestionDisplay({key: questionKey, mode: 'text'})}>看文字版</button></div> : <div className="clozeMapImageState" role="status">正在读取课堂截图…</div>}
     </> : <>
     <p className="clozeMapQuestionStem">{question.stem}</p>
     {!!question.options?.length && <ol className="clozeMapQuestionOptions">{question.options.map((option, index) => <li key={`${option.label}-${index}`}><strong>{option.label}</strong><span>{option.text}</span></li>)}</ol>}
     {!!question.notes?.length && <div className="clozeMapQuestionNotes"><h3>课堂笔记</h3>{question.notes.map((note, index) => <p key={index}>{note}</p>)}</div>}
     {question.answer && <div className="clozeMapAnswer"><button type="button" aria-expanded={answerOpen} onClick={() => setAnswerOpen(value => !value)}>{answerOpen ? '收起答案' : '查看答案'}</button>{answerOpen && <p>{question.answer}</p>}</div>}
     </>}
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
