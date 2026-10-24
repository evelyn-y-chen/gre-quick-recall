import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports = {};
new Function('exports', ts.transpileModule(readFileSync('community/clozeMapLayout.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText)(exports);
const {layoutClozeMap, fitMapCamera, zoomMapAt, subtreeBounds} = exports;
const tree = () => ({id: 'r', label: '测试根', children: [
 {id: 'a', label: '左翼', tone: 'opposite', children: Array.from({length: 28}, (_, i) => ({id: 'a-' + i, label: 'marker ' + i}))},
 {id: 'b', label: '右翼', tone: 'same', children: [{id: 'b-0', label: 'another marker'}]},
]});
function overlaps(a, b) {return a.x < b.x + b.width - .01 && a.x + a.width > b.x + .01 && a.y < b.y + b.height - .01 && a.y + a.height > b.y + .01;}
test('root separates the two wings and all visible nodes have disjoint bounds', () => {
 const layout = layoutClozeMap(tree(), new Set(['r', 'a', 'b']));
 const root = layout.nodes.find(x => x.node.id === 'r'), a = layout.nodes.find(x => x.node.id === 'a'), b = layout.nodes.find(x => x.node.id === 'b');
 assert.ok(a.x + a.width < root.x); assert.ok(b.x > root.x + root.width);
 assert.equal(layout.nodes.length, 32);
 for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) assert.equal(overlaps(layout.nodes[i], layout.nodes[j]), false, `${layout.nodes[i].node.id} overlaps ${layout.nodes[j].node.id}`);
 assert.ok(layout.edges.every(x => /^M .* C /.test(x.path)));
});
test('large terminal lists form horizontal racks rather than a single 150-row column', () => {
 const root = {id: 'r', label: '根', children: [{id: 'a', label: '分支', tone: 'opposite', children: Array.from({length: 150}, (_, i) => ({id: 'leaf-' + i, label: 'leaf ' + i}))}]};
 const layout = layoutClozeMap(root, new Set(['r', 'a']));
 const leaves = layout.nodes.filter(x => x.leaf);
 assert.equal(leaves.length, 150); assert.equal(new Set(leaves.map(x => x.x)).size, 4);
 assert.ok(layout.bounds.height < 4000); assert.equal(layout.racks.length, 1);
});
test('English notes reserve space for whole-word wrapping inside the card',()=>{
 const root={id:'r',label:'Root',children:[{id:'note',label:'Notes',details:['extraordinary extraordinary extraordinary extraordinary']}]};
 const layout=layoutClozeMap(root,new Set(['r','note']));
 assert.ok(layout.nodes.find(x=>x.node.id==='note').height>=160);
});
test('collapse removes descendants without changing the source data and a focused subtree excludes the other wing', () => {
 const root = tree(), before = JSON.stringify(root);
 assert.deepEqual(layoutClozeMap(root, new Set()).nodes.map(x => x.node.id), ['r']);
 const open = layoutClozeMap(root, new Set(['r', 'a', 'b']));
 const focused = subtreeBounds(open, 'a');
 const b = open.nodes.find(x => x.node.id === 'b');
 assert.ok(focused.x + focused.width < b.x); assert.equal(JSON.stringify(root), before);
});
test('fit uses both viewport dimensions, centers the whole scene and never enlarges above its supplied ceiling', () => {
 const bounds = {x: -100, y: 80, width: 1000, height: 2200}, viewport = {width: 1200, height: 640};
 const camera = fitMapCamera(bounds, viewport, 32);
 assert.ok(camera.scale * bounds.height <= viewport.height - 64 + .01);
 assert.ok(camera.scale * bounds.width <= viewport.width - 64 + .01);
 assert.ok(Math.abs((bounds.x + bounds.width / 2) * camera.scale + camera.x - viewport.width / 2) < .001);
 assert.ok(Math.abs((bounds.y + bounds.height / 2) * camera.scale + camera.y - viewport.height / 2) < .001);
 assert.equal(fitMapCamera({x: 0, y: 0, width: 100, height: 100}, viewport).scale, 1);
});
test('wheel/button zoom keeps the map point under the pointer fixed', () => {
 const current = {x: 70, y: -60, scale: .6}, anchor = {x: 310, y: 200};
 const next = zoomMapAt(current, 1.2, anchor);
 assert.ok(Math.abs((anchor.x - current.x) / current.scale - (anchor.x - next.x) / next.scale) < .001);
 assert.ok(Math.abs((anchor.y - current.y) / current.scale - (anchor.y - next.y) / next.scale) < .001);
});
