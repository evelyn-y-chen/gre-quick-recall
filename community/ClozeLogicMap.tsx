import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {CourseMapAccessError, readAdminCourseMap} from './adminCourseMapAccess';
import {countLogicNodes, expandableNodeIds, initialExpandedIds, isExpandable, toggleExpandedId, visibleNodeIds, type AdminCourseMap, type ClozeLogicNode, type ClozeMapTone} from './clozeLogicMapModel';
import './clozeLogicMap.css';

type LoadState = {key: string; status: 'loading' | 'ready' | 'error'; map?: AdminCourseMap; message?: string};
type Props = {session: Session | null; onClose: () => void};
const limitZoom = (value: number) => Math.max(.45, Math.min(1.6, Math.round(value * 100) / 100));

export default function ClozeLogicMap({session, onClose}: Props) {
 const accountKey = session?.user?.id && session.access_token ? `${session.user.id}:${session.access_token}` : '';
 const [load, setLoad] = useState<LoadState>({key: '', status: 'loading'});
 const [attempt, setAttempt] = useState(0), [expanded, setExpanded] = useState<Set<string>>(new Set());
 const [zoom, setZoom] = useState(1), [canvasSize, setCanvasSize] = useState({width: 0, height: 0});
 const request = useRef<AbortController | null>(null), sequence = useRef(0);
 const closeButton = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null);
 const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null);
 // Hide the old account's map immediately, before the new request effect runs.
 const current = load.key === accountKey;
 const map = current && accountKey && load.status === 'ready' ? load.map : undefined;
 const loading = !!accountKey && (!current || load.status === 'loading');
 const message = !accountKey ? '请先登录管理员账号。' : current ? load.message : undefined;

 function close() {request.current?.abort(); onClose();}
 useEffect(() => {
  const controller = new AbortController(), ticket = ++sequence.current;
  request.current?.abort(); request.current = controller;
  setLoad({key: accountKey, status: 'loading'}); setExpanded(new Set()); setZoom(1); setCanvasSize({width: 0, height: 0});
  void readAdminCourseMap(session, controller.signal).then(next => {
   if (controller.signal.aborted || ticket !== sequence.current) return;
   setExpanded(initialExpandedIds(next.content.root));
   setLoad({key: accountKey, status: 'ready', map: next});
  }).catch(error => {
   if (controller.signal.aborted || ticket !== sequence.current) return;
   setLoad({key: accountKey, status: 'error', message: error instanceof CourseMapAccessError ? error.message : '导图暂时读取失败，请重试。'});
  });
  return () => {controller.abort(); if (request.current === controller) request.current = null;};
 }, [accountKey, attempt]);

 useEffect(() => {
  if (typeof document === 'undefined') return;
  const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden'; closeButton.current?.focus();
  return () => {document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus?.();};
 }, []);
 useEffect(() => {
  const element = canvas.current;
  if (!element) return;
  const measure = () => setCanvasSize({width: element.offsetWidth, height: element.offsetHeight});
  measure();
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(measure); observer.observe(element);
  return () => observer.disconnect();
 }, [map, expanded]);

 function modalKeys(event: KeyboardEvent<HTMLElement>) {
  // Keep underlying study shortcuts from changing ratings or intercepting Enter.
  // Native button activation and viewport scrolling still use their defaults.
  event.stopPropagation();
  if (event.key === 'Escape') {event.preventDefault(); close(); return;}
  if (event.key !== 'Tab' || !panel.current) return;
  const controls = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]')).filter(element => element.getClientRects().length > 0);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
  else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
 }
 function fit() {
  if (viewport.current && canvasSize.width && canvasSize.height) setZoom(limitZoom(Math.min(
   (viewport.current.clientWidth - 32) / canvasSize.width,
   (viewport.current.clientHeight - 32) / canvasSize.height,
   1,
  )));
 }
 function renderNode(node: ClozeLogicNode, inherited: ClozeMapTone = 'neutral') {
  const tone = node.tone ?? inherited, expandable = isExpandable(node), open = expanded.has(node.id);
  const encodedId = `cloze-logic-${encodeURIComponent(node.id)}`;
  const controlledIds = [node.details?.length ? `${encodedId}-details` : '', node.children?.length ? `${encodedId}-children` : ''].filter(Boolean).join(' ');
  return <li className={`clozeMapNode tone-${tone}`} key={node.id}>
   <div className="clozeMapNodeRow">
    <div className={`clozeMapNodeCard ${open ? 'isOpen' : ''}`}>
     {expandable ? <button type="button" className="clozeMapNodeToggle" onClick={() => setExpanded(previous => toggleExpandedId(previous, node.id))} aria-expanded={open} aria-controls={controlledIds}>
      <span>{node.label}</span><i aria-hidden="true">{open ? '−' : '+'}</i>
     </button> : <div className="clozeMapNodeLabel">{node.label}</div>}
     {!!node.details?.length && <ul className="clozeMapDetails" id={`${encodedId}-details`} hidden={!open}>{open && node.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
     {expandable && !open && <span className="clozeMapCollapsedHint">{node.children?.length ? `${node.children.length} 个分支` : '点击查看'}</span>}
    </div>
    {!!node.children?.length && <ul className="clozeMapChildren" id={`${encodedId}-children`} hidden={!open}>{open && node.children.map(child => renderNode(child, tone))}</ul>}
   </div>
  </li>;
 }
 const measured = canvasSize.width > 0 && canvasSize.height > 0;
 const surfaceStyle: CSSProperties = measured ? {width: canvasSize.width * zoom, height: canvasSize.height * zoom} : {};
 const canvasStyle: CSSProperties = {transform: `scale(${zoom})`, ...(measured ? {position: 'absolute', left: 0, top: 0} : {})};
 return <div className="clozeMapOverlay">
  <section className="clozeLogicMap" ref={panel} role="dialog" aria-modal="true" aria-labelledby="cloze-map-title" onKeyDown={modalKeys}>
   <header className="clozeMapHeader"><div><p className="clozeMapEyebrow">LEMNOTA · 填空逻辑</p><h1 id="cloze-map-title">{map?.title ?? '填空标志词导图'}</h1><p className="clozeMapIntro">点击节点自由展开或收起，滑动或滚动查看其他分支。</p></div><button type="button" className="clozeMapClose" ref={closeButton} onClick={close} aria-label="关闭填空标志词导图">关闭 <span aria-hidden="true">×</span></button></header>
   {map && <div className="clozeMapToolbar" aria-label="导图操作">
    <div className="clozeMapActions"><button type="button" onClick={() => setExpanded(new Set(expandableNodeIds(map.content.root)))}>全部展开</button><button type="button" onClick={() => setExpanded(new Set())}>全部收起</button><span className="clozeMapCount" aria-live="polite">{visibleNodeIds(map.content.root, expanded).length} / {countLogicNodes(map.content.root)} 个节点</span></div>
    <div className="clozeMapZoom" role="group" aria-label="缩放导图"><button type="button" aria-label="缩小导图" disabled={zoom <= .45} onClick={() => setZoom(value => limitZoom(value - .1))}>−</button><button type="button" className="clozeMapZoomReset" aria-label="恢复百分之百缩放" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button type="button" aria-label="放大导图" disabled={zoom >= 1.6} onClick={() => setZoom(value => limitZoom(value + .1))}>+</button><button type="button" className="clozeMapFit" onClick={fit}>适应屏幕</button></div>
   </div>}
   {loading ? <div className="clozeMapState" role="status"><span className="clozeMapLoadingDot" aria-hidden="true"/><h2>正在打开导图</h2><p>正在确认管理员权限并读取内容…</p></div> : !map ? <div className="clozeMapState"><span className="clozeMapStateIcon" aria-hidden="true">↳</span><h2>暂时无法打开导图</h2><p role="alert">{message ?? '导图暂时读取失败，请重试。'}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重新读取</button></div> : <>
    <div className="clozeMapViewport" ref={viewport} tabIndex={0} role="region" aria-label="可滚动的填空标志词导图">
     <div className="clozeMapSurface" style={surfaceStyle}><div className="clozeMapCanvas" ref={canvas} style={canvasStyle}><ul className="clozeMapTree">{renderNode(map.content.root)}</ul></div></div>
    </div>
    <footer className="clozeMapFooter"><div className="clozeMapLegend"><span><i className="opposite"/>反义类</span><span><i className="same"/>同义类</span></div><span>管理员可见 · 标志词与逻辑节点</span></footer>
   </>}
  </section>
 </div>;
}
