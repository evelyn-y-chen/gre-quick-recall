import type {ClozeLogicNode, ClozeMapTone} from './clozeLogicMapModel';

export type MapBounds = {x: number; y: number; width: number; height: number};
export type MapCamera = {x: number; y: number; scale: number};
export type PositionedLogicNode = MapBounds & {node: ClozeLogicNode; tone: ClozeMapTone; parentId?: string; ancestors: string[]; leaf: boolean};
export type LogicMapEdge = {from: string; to: string; path: string; tone: ClozeMapTone};
export type LogicMapRack = MapBounds & {parentId: string; tone: ClozeMapTone};
export type LogicMapLayout = {nodes: PositionedLogicNode[]; edges: LogicMapEdge[]; racks: LogicMapRack[]; bounds: MapBounds};
type PlanEdge = {from: string; to: string; x1: number; y1: number; x2: number; y2: number; tone: ClozeMapTone};
type Plan = {width: number; height: number; root: PositionedLogicNode; nodes: PositionedLogicNode[]; edges: PlanEdge[]; racks: LogicMapRack[]};
const GAP = 64, ROW_GAP = 28, RACK_GAP = 16, PAD = 18;

function textLines(text: string, width: number, fontSize: number): number {
 let lines = 1, used = 0;
 for (const char of text) {
  if (char === '\n') {lines++; used = 0; continue;}
  const unit = /[^\u0000-\u007f]/.test(char) ? fontSize : /[MW@%]/.test(char) ? fontSize * .9 : fontSize * .57;
  if (used + unit > width) {lines++; used = 0;}
  used += unit;
 }
 return lines;
}
function dimensions(node: ClozeLogicNode, open: boolean, leaf: boolean) {
 const width = leaf ? 182 : 218;
 const labelWidth = width - 52;
 const labelHeight = Math.max(1, textLines(node.label, labelWidth, 14)) * 22 + 24;
 const detailsHeight = open && node.details?.length ? node.details.reduce((sum, line) => sum + textLines(line, width - 38, 13) * 20 + 7, 7) + 15 : 0;
 return {width, height: Math.max(52, labelHeight + detailsHeight)};
}
function shift(plan: Plan, dx: number, dy: number) {
 const nodes = plan.nodes.map(node => ({...node, x: node.x + dx, y: node.y + dy}));
 return {
  nodes,
  root: nodes.find(node => node.node.id === plan.root.node.id)!,
  edges: plan.edges.map(edge => ({...edge, x1: edge.x1 + dx, x2: edge.x2 + dx, y1: edge.y1 + dy, y2: edge.y2 + dy})),
  racks: plan.racks.map(rack => ({...rack, x: rack.x + dx, y: rack.y + dy})),
 };
}
function branchPlan(node: ClozeLogicNode, expanded: ReadonlySet<string>, inherited: ClozeMapTone, ancestors: string[], parentId?: string): Plan {
 const tone = node.tone ?? inherited, open = expanded.has(node.id), children = open ? node.children ?? [] : [];
 const size = dimensions(node, open, !node.children?.length);
 const positioned: PositionedLogicNode = {...size, x: 0, y: 0, node, tone, parentId, ancestors, leaf: !node.children?.length};
 if (!children.length) return {width: size.width, height: size.height, root: positioned, nodes: [positioned], edges: [], racks: []};
 const childAncestors = [...ancestors, node.id];
 // Terminal lists share a compact rack. Their common enclosure conveys the
 // parent relationship without drawing lines through neighboring word chips.
 if (children.length >= 3 && children.every(child => !child.children?.length)) {
  const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(children.length))));
  const plans = children.map(child => branchPlan(child, expanded, tone, childAncestors, node.id));
  const columnWidths = Array.from({length: columns}, (_, column) => Math.max(...plans.filter((_, index) => index % columns === column).map(plan => plan.width)));
  const rows = Math.ceil(plans.length / columns);
  const rowHeights = Array.from({length: rows}, (_, row) => Math.max(...plans.slice(row * columns, (row + 1) * columns).map(plan => plan.height)));
  const rackWidth = columnWidths.reduce((a, b) => a + b, 0) + (columns - 1) * RACK_GAP + PAD * 2;
  const rackHeight = rowHeights.reduce((a, b) => a + b, 0) + (rows - 1) * RACK_GAP + PAD * 2;
  const height = Math.max(size.height, rackHeight), rackX = size.width + GAP, rackY = (height - rackHeight) / 2;
  positioned.y = (height - size.height) / 2;
  const nodes = [positioned];
  plans.forEach((plan, index) => {
   const column = index % columns, row = Math.floor(index / columns);
   const x = rackX + PAD + columnWidths.slice(0, column).reduce((a, b) => a + b + RACK_GAP, 0);
   const y = rackY + PAD + rowHeights.slice(0, row).reduce((a, b) => a + b + RACK_GAP, 0);
   nodes.push(...shift(plan, x, y).nodes);
  });
  return {width: rackX + rackWidth, height, root: positioned, nodes,
   edges: [{from: node.id, to: `${node.id}:rack`, x1: size.width, y1: height / 2, x2: rackX, y2: height / 2, tone}],
   racks: [{x: rackX, y: rackY, width: rackWidth, height: rackHeight, parentId: node.id, tone}]};
 }
 const plans = children.map(child => branchPlan(child, expanded, tone, childAncestors, node.id));
 const childrenHeight = plans.reduce((sum, child) => sum + child.height, 0) + (plans.length - 1) * ROW_GAP;
 const height = Math.max(size.height, childrenHeight); positioned.y = (height - size.height) / 2;
 const nodes = [positioned], edges: PlanEdge[] = [], racks: LogicMapRack[] = [];
 let y = (height - childrenHeight) / 2;
 for (const plan of plans) {
  const moved = shift(plan, size.width + GAP, y);
  nodes.push(...moved.nodes); edges.push(...moved.edges); racks.push(...moved.racks);
  edges.push({from: node.id, to: plan.root.node.id, x1: size.width, y1: height / 2, x2: moved.root.x, y2: moved.root.y + moved.root.height / 2, tone: moved.root.tone});
  y += plan.height + ROW_GAP;
 }
 return {width: size.width + GAP + Math.max(...plans.map(plan => plan.width)), height, root: positioned, nodes, edges, racks};
}

export function layoutClozeMap(root: ClozeLogicNode, expanded: ReadonlySet<string>): LogicMapLayout {
 const rootDetails = expanded.has(root.id) && root.details?.length ? root.details.reduce((sum, line) => sum + textLines(line, 186, 13) * 20 + 7, 22) : 0;
 const rootSize = {width: 224, height: Math.max(72, textLines(root.label, 164, 18) * 26 + 40) + rootDetails};
 const rootPosition: PositionedLogicNode = {...rootSize, x: -rootSize.width / 2, y: -rootSize.height / 2, node: root, tone: root.tone ?? 'neutral', ancestors: [], leaf: !root.children?.length};
 const nodes = [rootPosition], edges: PlanEdge[] = [], racks: LogicMapRack[] = [];
 const wings: Record<'left' | 'right', ClozeLogicNode[]> = {left: [], right: []};
 if (expanded.has(root.id)) (root.children ?? []).forEach((child, index) => wings[child.tone === 'opposite' ? 'left' : child.tone === 'same' ? 'right' : index % 2 ? 'right' : 'left'].push(child));
 for (const side of ['left', 'right'] as const) {
  const plans = wings[side].map(child => branchPlan(child, expanded, child.tone ?? 'neutral', [root.id], root.id));
  const totalHeight = plans.reduce((sum, plan) => sum + plan.height, 0) + Math.max(0, plans.length - 1) * 64;
  let y = -totalHeight / 2;
  for (const plan of plans) {
   const moved = shift(plan, rootSize.width / 2 + 90, y);
   const mirror = side === 'left';
   nodes.push(...moved.nodes.map(node => mirror ? {...node, x: -node.x - node.width} : node));
   racks.push(...moved.racks.map(rack => mirror ? {...rack, x: -rack.x - rack.width} : rack));
   edges.push(...moved.edges.map(edge => mirror ? {...edge, x1: -edge.x1, x2: -edge.x2} : edge));
   edges.push({from: root.id, to: plan.root.node.id, x1: mirror ? -rootSize.width / 2 : rootSize.width / 2, y1: 0,
    x2: mirror ? -moved.root.x : moved.root.x, y2: moved.root.y + moved.root.height / 2, tone: moved.root.tone});
   y += plan.height + 64;
  }
 }
 const bounds = boundsOf(nodes);
 const padding = 48, dx = padding - bounds.x, dy = padding - bounds.y;
 const shiftedNodes = nodes.map(node => ({...node, x: node.x + dx, y: node.y + dy}));
 return {nodes: shiftedNodes,
  racks: racks.map(rack => ({...rack, x: rack.x + dx, y: rack.y + dy})),
  edges: edges.map(edge => {
   const x1 = edge.x1 + dx, x2 = edge.x2 + dx, y1 = edge.y1 + dy, y2 = edge.y2 + dy;
   const bend = Math.max(26, Math.abs(x2 - x1) * .5), direction = x2 >= x1 ? 1 : -1;
   return {from: edge.from, to: edge.to, tone: edge.tone, path: `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`};
  }), bounds: {x: 0, y: 0, width: bounds.width + padding * 2, height: bounds.height + padding * 2}};
}

export function boundsOf(nodes: MapBounds[]): MapBounds {
 if (!nodes.length) return {x: 0, y: 0, width: 1, height: 1};
 const x = Math.min(...nodes.map(node => node.x)), y = Math.min(...nodes.map(node => node.y));
 return {x, y, width: Math.max(...nodes.map(node => node.x + node.width)) - x, height: Math.max(...nodes.map(node => node.y + node.height)) - y};
}
export function subtreeBounds(layout: LogicMapLayout, id: string): MapBounds {
 return boundsOf(layout.nodes.filter(node => node.node.id === id || node.ancestors.includes(id)));
}
export function fitMapCamera(bounds: MapBounds, viewport: {width: number; height: number}, padding = 32, maximum = 1): MapCamera {
 const width = Math.max(1, viewport.width - padding * 2), height = Math.max(1, viewport.height - padding * 2);
 const scale = Math.max(.04, Math.min(maximum, width / Math.max(1, bounds.width), height / Math.max(1, bounds.height)));
 return {scale, x: (viewport.width - bounds.width * scale) / 2 - bounds.x * scale, y: (viewport.height - bounds.height * scale) / 2 - bounds.y * scale};
}
export function zoomMapAt(camera: MapCamera, nextScale: number, anchor: {x: number; y: number}): MapCamera {
 const scale = Math.max(.04, Math.min(2.4, nextScale)), factor = scale / camera.scale;
 return {scale, x: anchor.x - (anchor.x - camera.x) * factor, y: anchor.y - (anchor.y - camera.y) * factor};
}
