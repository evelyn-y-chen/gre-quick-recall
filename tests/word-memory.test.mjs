import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const compile=file=>ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const revisions=JSON.parse(fs.readFileSync(new URL('../app/wordMemoryEdits.json',import.meta.url),'utf8'));
const editorial={};new Function('exports','require',compile('../app/reviewedWordMemory.ts'))(editorial,()=>({default:revisions}));
const model={};new Function('exports',compile('../app/wordMemoryModel.ts'))(model);
test('identical words share memory, distinct forms stay separate, merged paragraphs deduplicate',()=>{
 assert.equal(model.wordMemoryKey('  CANDID  '),'candid');assert.equal(model.wordMemoryKey('standard   deviation'),'standard deviation');
 const index=Object.create(null);model.addMemorySeed(index,' Candid ','记法一','GLEE');model.addMemorySeed(index,'candid','记法二','A+');model.addMemorySeed(index,'CANDID','记法一','生词本');model.addMemorySeed(index,'candidly','不同单词','GLEE');
 assert.equal(index.candid.text,'记法一\n\n记法二');assert.equal(index.candidly.text,'不同单词');assert.equal(index.candid.sources.length,3);
});
test('shared API preserves legacy notes, saves one record, rejects stale edits and honors clearing',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE mind_map_state (key TEXT PRIMARY KEY,value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');
 const putLegacy=(key,value)=>db.prepare('INSERT INTO mind_map_state(key,value) VALUES (?,?)').run(key,JSON.stringify(value));
 putLegacy('a-plus-note:candid','A+旧笔记');putLegacy('a-plus-note:empty','');putLegacy('vocab-notebook:one',{source:'阅读',words:[{word:'CANDID',note:'生词本旧笔记',meaning:'坦率',rating:'familiar'}]});
 const legacySnapshot=db.prepare('SELECT * FROM mind_map_state ORDER BY key').all();
 const runtime={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)??null;},async run(){return db.prepare(sql).run(...args);}};}};
 const fakeGlee={GET:async()=>Response.json({maps:[{list:1,part:1,branches:[{words:[{word:'candid',memory:'GLEE记法'},{word:'candidly',memory:'副词记法'}]}]}],tables:[{list:2,words:[{word:'Candid',memory:'GLEE记法'}]}]})};
 const dependencies={'../../reviewedWordMemory':editorial,'../mind-map/route':fakeGlee,'../../aPlusLectureNotes.json':{default:{candid:{note:'被旧笔记替代'},empty:{note:'已清空不应回填'}}},'../../bbEquivalents.json':{default:[{volume:'上',number:1,words:[{word:'candid',memory:'BB记法'}]}]},'../../wordMemoryModel':model,'../../../db/runtime':{getRuntimeDatabase:()=>runtime},'../../../db/mindMapStore':{ensureMindMapSchema:async()=>{}}};
 const api={};new Function('exports','require',compile('../app/api/word-memory/route.ts'))(api,k=>{assert(k in dependencies,k);return dependencies[k];});
 const write=(word,text,revision)=>api.PUT(new Request('http://test/api/word-memory',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({word,text,revision})}));
 let data=await (await api.GET()).json();assert.equal(data.memories.candid.text,'GLEE记法\n\nA+旧笔记\n\nBB记法');assert(!data.memories.empty);assert(!data.memories.candid.sources.some(s=>s.includes('生词本')));
 assert.equal((await write(' CANDID ','统一新记法',0)).status,200);assert.equal((await write('candid','过期设备',0)).status,409);
 data=await (await api.GET()).json();assert.equal(data.memories.candid.text,'统一新记法');assert.equal(data.memories.candid.revision,1);assert.equal(data.memories.candidly.text,'副词记法');
 assert.equal((await write('candid','',1)).status,200);data=await (await api.GET()).json();assert.equal(data.memories.candid.text,'');assert.equal(data.memories.candid.revision,2);
 const conflict=await write('candid','旧页面又写',1);assert.equal(conflict.status,409);assert.equal((await conflict.json()).current.text,'');
 putLegacy('word-memory:legacy','保留自己写的');
 assert.equal((await (await api.GET()).json()).memories.legacy.text,'保留自己写的');
 assert.equal((await write('new word','新词记法',0)).status,200);assert.equal((await write('','无效',0)).status,400);assert.equal((await write('word','x'.repeat(40001),0)).status,400);
 assert.deepEqual(db.prepare("SELECT * FROM mind_map_state WHERE key NOT LIKE 'word-memory:%' AND key NOT LIKE 'word-memory-backup:%' ORDER BY key").all(),legacySnapshot);db.close();
});

test('compaction retains different roots and stories',()=>{
 assert.equal(model.compactMemoryText('normal → 正常；异常。\n\nnormal → 正常,异常。'),'normal → 正常；异常。');
 assert.equal(model.compactMemoryText('a = not + normal\n记忆故事第一种\n\na = not + normal\n记忆故事第二种'),'a = not + normal\n记忆故事第一种\n\n记忆故事第二种');
 const distinct='a part 与 apart 不同\n\napart 与 a part 不同\n\n记得不是同义词\n\n记得是同义词\n\na-b 是拆词\n\na+b 是相加';
 assert.equal(model.compactMemoryText(distinct),distinct);
 assert.equal(model.compactMemoryText(model.compactMemoryText(distinct)),distinct);
});

test('reviewed revisions preserve added notes and never overwrite changed meaning',()=>{
 for(const [word,rule] of Object.entries(revisions)){
  const revised=editorial.simplifyReviewedMemory(word,rule.original);
  assert.equal(revised,rule.text,word);
  assert.equal(editorial.simplifyReviewedMemory(word,revised),revised,word+' idempotent');
  assert.equal(editorial.simplifyReviewedMemory(word,rule.original+'\n\n我的新笔记：不是反义词；记住 123。'),rule.text+'\n\n我的新笔记：不是反义词；记住 123。');
  assert.equal(editorial.simplifyReviewedMemory(word,'自己重新写的，不要覆盖'), '自己重新写的，不要覆盖');
 }
 const rule=revisions.dearth;
 assert.equal(editorial.simplifyReviewedMemory('dearth',rule.original.replace('缺乏','不缺乏')),rule.original.replace('缺乏','不缺乏'));
 assert.equal(editorial.simplifyReviewedMemory('dearth',''),'');
 assert.equal(editorial.simplifyReviewedMemory('unreviewed',rule.original),rule.original);
 assert.match(editorial.simplifyReviewedMemory('dearth',rule.original),/dear/);
 assert.match(editorial.simplifyReviewedMemory('dearth',rule.original),/death/);
});
