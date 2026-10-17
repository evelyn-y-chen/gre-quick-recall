import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function component(file,props){
 const slots=[];let index=0,tree;const effects=[],document={body:{style:{overflow:'auto'}},activeElement:null};
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef(initial){const i=index++;return slots[i]??(slots[i]={current:initial});},useEffect(run,deps){const i=index++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=run();});}}};
 const jsx=(type,props)=>({type,props:props??{}}),exports={};
 const require=name=>{if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name.endsWith('.css'))return {};if(name==='./plannerKeys')return {planModalKeys:()=>{}};throw Error('Unexpected dependency: '+name);};
 const source=fs.readFileSync(file,'utf8').replaceAll('import.meta.env.BASE_URL',"'/'");new Function('exports','require','document',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,require,document);
 const nodes=node=>node==null||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];const text=node=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
 function render(){index=0;tree=exports.default(props);while(effects.length)effects.shift()();}
 const button=label=>nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label));
 render();return {render,document,button,get tree(){return tree;},get text(){return text(tree);},click(label){const n=button(label);assert.ok(n,'Missing '+label);assert.ok(!n.props.disabled);n.props.onClick();render();},change(type,value){const n=nodes(tree).find(n=>n.type===type);assert.ok(n,'Missing '+type);n.props.onChange({target:{value}});render();},node:type=>nodes(tree).find(n=>n.type===type)};
}
test('word highlight and group traffic light can be tried independently without storage dependencies',()=>{
 const v=component('community/TourDemo.tsx',{id:'ratings',english:false});v.click('双击单词，或点这里试试标亮');assert.equal(v.button('标亮 forthright').props['aria-pressed'],true);v.click('想起来了');assert.equal(v.button('想起来了').props['aria-pressed'],true);v.click('取消单词标亮');assert.equal(v.button('标亮 forthright').props['aria-pressed'],false);assert.equal(v.button('想起来了').props['aria-pressed'],true);
});
test('the sample note follows source switches but never imports the real memory store',()=>{
 const v=component('community/TourDemo.tsx',{id:'connections',english:false});v.change('textarea','我自己的联想');v.click('GLEE');assert.equal(v.node('textarea').props.value,'我自己的联想');v.click('BB');assert.equal(v.node('textarea').props.value,'我自己的联想');
});
test('A+ sample skips step two after a wrong meaning and shows notes immediately',()=>{
 const v=component('community/TourDemo.tsx',{id:'practice',english:false});v.click('严厉的');assert.match(v.text,/正确释义：坦率的/);assert.match(v.text,/对应等价词：frank/);assert.match(v.text,/记忆笔记/);assert.equal(v.button('frank'),undefined);v.click('再试一次');v.click('坦率的');assert.ok(v.button('frank'));v.click('frank');assert.match(v.text,/答对了/);
});
test('BB example opens six synonym choices directly, including after retry',()=>{
 const v=component('community/TourDemo.tsx',{id:'practice',english:false});v.click('BB');assert.equal(v.button('坦率的'),undefined);assert.ok(v.button('frank'));v.click('timid');assert.match(v.text,/正确等价词：frank/);assert.match(v.text,/记忆笔记/);v.click('再试一次');assert.ok(v.button('frank'));assert.equal(v.button('坦率的'),undefined);
});
test('the notebook demo reuses definitions and notes; the sample learning note round trip stays in the card',()=>{
 const n=component('community/TourDemo.tsx',{id:'notebook',english:false});n.change('select','lucid');n.click('选用释义与已有笔记');assert.match(n.text,/清晰的/);assert.match(n.text,/已放入示例生词本/);
 const s=component('community/TourDemo.tsx',{id:'save',english:false});assert.equal(s.button('读回示例便笺').props.disabled,true);s.click('生成示例便笺');s.click('读回示例便笺');assert.match(s.text,/标记、笔记和配色都在/);
});
test('mobile tools are grouped behind More while saving feedback stays outside it',()=>{
 const calls=[],props={ready:true,status:'已保存到本机',syncing:false,account:'learner',hasUsername:true,admin:false,theme:'cream',themes:[['cream','雪林晚霞']],swatch:()=>null,consent:true,undoAvailable:true,emptyCloud:false,hasConflict:false};for(const name of ['Home','Plan','Progress','Guide','About','Feedback','Admin','Account','SignOut','Theme','Consent','Sync','CheckSync','Export','Import','Undo','ImportGuest','ExportConflict','ReviewConflict'])props['on'+name]=()=>calls.push(name);
 const v=component('community/WorkspaceHeader.tsx',props);assert.match(v.text,/已保存到本机/);assert.equal(v.button('带走便笺'),undefined);v.click('更多学习工具');assert.ok(v.button('带走便笺'));assert.ok(v.button('撤销上次记录操作'));assert.equal(v.document.body.style.overflow,'hidden');v.click('带走便笺');assert.deepEqual(calls,['Export']);assert.equal(v.button('带走便笺'),undefined);assert.equal(v.document.body.style.overflow,'auto');
});
