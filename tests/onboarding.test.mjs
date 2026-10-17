import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function loadModel(){const exports={};new Function('exports',ts.transpileModule(fs.readFileSync('community/onboardingModel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);return exports;}
const model=loadModel();
test('first-visit preference is per-browser, dismissible, and does not depend on learning data',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 assert.equal(model.needsWelcomeTour(storage),true);model.rememberWelcomeTour(storage);assert.equal(model.needsWelcomeTour(storage),false);
 assert.deepEqual([...data],[[model.TOUR_SEEN_KEY,'seen']]);
 assert.equal(model.needsWelcomeTour({getItem(){throw Error('blocked storage');}}),true);
 assert.doesNotThrow(()=>model.rememberWelcomeTour({setItem(){throw Error('blocked storage');}}));
});
test('swipes require a deliberate horizontal gesture and never wrap the first or last card',()=>{
 assert.equal(model.swipeTour(2,-60,8),3);assert.equal(model.swipeTour(2,60,8),1);
 assert.equal(model.swipeTour(2,-30,0),2);assert.equal(model.swipeTour(2,-60,80),2);
 assert.equal(model.swipeTour(0,70,0),0);assert.equal(model.swipeTour(8,-70,0),8);
 assert.equal(model.tourIndex(NaN),0);assert.equal(model.tourIndex(99),8);
});
test('all core features have both language versions and installation remains a separate reachable card',()=>{
 assert.equal(model.TOUR_SLIDES.length,9);assert.equal(new Set(model.TOUR_SLIDES.map(s=>s.id)).size,9);
 for(const slide of model.TOUR_SLIDES)for(const language of ['zh','en']){const copy=slide[language];assert.ok(copy.label&&copy.title&&copy.body&&copy.tip);assert.equal(copy.steps.length,2);}
 assert.equal(model.TOUR_SLIDES[model.INSTALL_TOUR_INDEX].id,'install');
 const notes=model.TOUR_SLIDES.find(s=>s.id==='connections');assert.match(notes.zh.tip,/不.*分享给别人/);assert.match(notes.en.tip,/not shared with other people/);
 const plan=model.TOUR_SLIDES.find(s=>s.id==='plan');assert.match(plan.zh.tip,/新词＋复习/);assert.match(plan.en.tip,/new words and reviews/);
});

function tour(initial=0){
 const slots=[],effects=[];let cursor=0,tree,closed=0;
 const document={body:{style:{overflow:'auto'}},activeElement:null};
 const react={useState(value){const slot=cursor++;if(!(slot in slots))slots[slot]=typeof value==='function'?value():value;return [slots[slot],next=>{slots[slot]=typeof next==='function'?next(slots[slot]):next;}];},useRef(value){const slot=cursor++;return slots[slot]??(slots[slot]={current:value});},useEffect(effect,deps){const slot=cursor++;if(!slots[slot]||deps.some((v,i)=>v!==slots[slot][i])){effects.push(effect);slots[slot]=deps;}}};
 const jsx=(type,props)=>({type,props:props??{}}),exports={};
 const source=fs.readFileSync('community/Onboarding.tsx','utf8').replaceAll('import.meta.env.BASE_URL',"'/'");
 const require=name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='./onboardingModel'?model:{};
 new Function('exports','require','document',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,require,document);
 const render=()=>{cursor=0;tree=exports.default({initial,onClose(){closed++;}});while(effects.length)effects.shift()();return tree;};
 const nodes=node=>node==null||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
 const text=node=>node==null?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
 const find=label=>nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label));
 render();return {get tree(){return tree;},get closed(){return closed;},get title(){return nodes(tree).find(n=>n.type==='h1')?.props.children;},get language(){return tree.props.lang;},click(label){const node=find(label);assert.ok(node,'Missing button '+label);assert.ok(!node.props.disabled);node.props.onClick();render();},key(key){let stopped=false,prevented=false;tree.props.onKeyDown({key,stopPropagation(){stopped=true;},preventDefault(){prevented=true;}});render();return {stopped,prevented};},swipe(dx,dy){const node=nodes(tree).find(n=>n.props.className==='tourSlide');node.props.onTouchStart({touches:[{clientX:100,clientY:100}]});node.props.onTouchEnd({changedTouches:[{clientX:100+dx,clientY:100+dy}]});render();}};
}
test('actual introduction supports direct pages, arrows, language switch, and closing from any card',()=>{
 const view=tour();assert.equal(view.title,model.TOUR_SLIDES[0].zh.title);
 assert.deepEqual(view.key('ArrowRight'),{stopped:true,prevented:true});assert.equal(view.title,model.TOUR_SLIDES[1].zh.title);
 view.click('第 7 页：保存与换设备');assert.equal(view.title,model.TOUR_SLIDES[6].zh.title);
 view.click('切换为英文');assert.equal(view.language,'en');assert.equal(view.title,model.TOUR_SLIDES[6].en.title);
 view.click('Close introduction');assert.equal(view.closed,1);
});
test('actual touch handlers preserve vertical scrolling and safely snapshot swipe coordinates',()=>{
 const view=tour(2);view.swipe(-70,90);assert.equal(view.title,model.TOUR_SLIDES[2].zh.title);
 view.swipe(-70,4);assert.equal(view.title,model.TOUR_SLIDES[3].zh.title);
 view.swipe(70,4);assert.equal(view.title,model.TOUR_SLIDES[2].zh.title);
 assert.deepEqual(view.key('Escape'),{stopped:true,prevented:true});assert.equal(view.closed,1);
});
test('install entry opens its own card and the final action closes the introduction',()=>{
 const view=tour(model.INSTALL_TOUR_INDEX);assert.equal(view.title,model.TOUR_SLIDES.at(-1).zh.title);
 view.key('ArrowRight');assert.equal(view.title,model.TOUR_SLIDES.at(-1).zh.title);
 view.click('开始使用');assert.equal(view.closed,1);
});
