import {useTestAutosave,TestAudio} from './testExperience';
import TestQuestionHistory,{readTestLookback,appendTestLookback,captureTestNotes,type TestQuestionSnapshot} from "../app/TestQuestionHistory";
import NotebookFrequencyBadge from "../app/NotebookFrequency";
import SelectionChips from './SelectionChips';
import {readSavedRatings} from '../app/ratingStorage';
import {testColors,matchesTestColors,ratingKeys,type TestColor} from './testRatingFilter';
import {recordCompletedPractice,recordPracticeWord,recordPracticeWords} from './practiceCompletions';
import {trackUsage} from './analytics';
import {useEffect,useRef,useState} from 'react';
import vocabulary from '../app/vocabulary.json';
import aplus from '../app/aPlusEquivalents.json';
import bb from '../app/bbEquivalents.json';
import pairs from '../app/equivalents.json';
import SharedWordMemory,{useWordMemory} from '../app/SharedWordMemory';
import {studyStorage} from './storage';
import {getWorkspaceGeneration} from './api';
import {persistLearningWorkspace} from './workspacePersistence';
import {recordLearningPlanWords} from './learningPlanStore';
import {grade,optionsFor,shuffle,answerStep,refreshPracticeOptions,type Term,type Choice,type Direction,type Result} from './practiceModel';
import {REVIEW_INTERVALS,reviewDay,readPracticeReviewHistory,recordPracticeReview,duePracticeIds,type ReviewHistory} from './practiceReviewModel';
import {zhangDecks,zhangSynonyms,type ZhangDeck} from '../app/zhangCatalog';
export type Deck=ZhangDeck|'words'|'a-plus'|'bb'|'notebook';
export type NotebookPracticeTerm=Term&{rating?:'unknown'|'fuzzy'|'familiar';origin?:string;note?:string};
export type NotebookPractice={id:string;source:string;terms:NotebookPracticeTerm[]};
const decks:Record<Exclude<Deck,'notebook'>,Term[]>={'zhang-jijing':zhangDecks['zhang-jijing'].entries.map(e=>({...e,synonyms:zhangSynonyms(e)})),'zhang-words':zhangDecks['zhang-words'].entries.map(e=>({...e,synonyms:zhangSynonyms(e)})),'zhang-pairs':zhangDecks['zhang-pairs'].entries.map(e=>({...e,synonyms:zhangSynonyms(e)})),words:vocabulary.map(t=>({...t,list:t.list??1})), 'a-plus':aplus.map(t=>({...t,synonyms:t.equivalents})),bb:bb.flatMap(t=>t.words.map((w,i)=>({id:t.id+':'+i,word:w.word,meaning:w.meaning,list:t.list,volume:t.volume,synonyms:t.words.filter((_,j)=>i!==j).map(w=>w.word)})))};
const links=[...Object.values(zhangDecks).flatMap(d=>d.entries.map(e=>[e.word,...zhangSynonyms(e)])),...aplus.map(t=>[t.word,...t.equivalents]),...bb.map(t=>t.words.map(w=>w.word)),...pairs.map(t=>[t.left,t.right])];
const deckIds:Record<Exclude<Deck,'notebook'>,ReadonlySet<string>>={'zhang-jijing':new Set(decks['zhang-jijing'].map(t=>t.id)),'zhang-words':new Set(decks['zhang-words'].map(t=>t.id)),'zhang-pairs':new Set(decks['zhang-pairs'].map(t=>t.id)),words:new Set(decks.words.map(t=>t.id)),'a-plus':new Set(decks['a-plus'].map(t=>t.id)),bb:new Set(decks.bb.map(t=>t.id))};
type Run={sessionId?:string;queue:string[];direction:Direction;pair:boolean;review?:boolean;results:Record<string,Result>;phase:'meaning'|'synonym'|'feedback';options:Choice[];selected:number|null;meaningOK:boolean;feedbackStep?:'meaning'|'synonym';turn:number;lookback?:TestQuestionSnapshot[];meaningSelection?:Choice|null;uncertain?:boolean;attemptCounts?:Record<string,number|null>};
export default function Practice({deck,onClose,initialLists,initialVolume,notebook}:{deck:Deck;onClose:()=>void;initialLists?:number[];initialVolume?:string;notebook?:NotebookPractice}){
 const equivalenceOnly=deck==='bb'||deck==='zhang-pairs';
 const groupLabel=(n:number)=>deck.startsWith('zhang-')?zhangDecks[deck as ZhangDeck].entries.find(e=>e.list===n)?.group??`List ${n}`:`List ${n}`;
 const [exitSaving,setExitSaving]=useState(false),[saveStatus,setSaveStatus]=useState('');
 const exitBusy=useRef(false),workspaceGeneration=useRef(getWorkspaceGeneration()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const isNotebook=deck==='notebook';
 const pool:NotebookPracticeTerm[]=isNotebook?(notebook?.terms??[]):decks[deck],practiceScope=isNotebook?'notebook-'+(notebook?.id??'empty'):deck,key='lemnota-practice-'+practiceScope,reviewKey='lemnota-practice-review-'+practiceScope+'-v1';
 const validIds=isNotebook?new Set(pool.map(term=>term.id)):deckIds[deck];
 const [lookbackAt,setLookbackAt]=useState<number|null>(null),memory=useWordMemory();
 const [chosenLists,setChosenLists]=useState<number[]|null>(initialLists??null),[colors,setColors]=useState<TestColor[]>(testColors.map(c=>c.id)),[volume,setVolume]=useState(initialVolume??'全部');
 const savedRatings=isNotebook?{}:readSavedRatings(studyStorage,ratingKeys[deck])??{};
 const matchesColor=(id:string)=>isNotebook?colors.includes(pool.find(term=>term.id===id)?.rating??"unrated"):matchesTestColors(deck,id,savedRatings,colors);
 const [from,setFrom]=useState(initialLists?.[0]??1),[to,setTo]=useState(initialLists?.at(-1)??1),[direction,setDirection]=useState<Direction>('en-zh'),[random,setRandom]=useState(true),[pair,setPair]=useState(deck==='bb'),[setup,setSetup]=useState(true);
 const [run,setRun]=useState<Run|null>(()=>{try{const r=JSON.parse(studyStorage.getItem(key)??'null');return r&&Array.isArray(r.queue)&&r.queue.every((id:string)=>pool.some(t=>t.id===id))&&Array.isArray(r.options)&&r.results?(()=>{const restored={...r,sessionId:r.sessionId??crypto.randomUUID()};if(equivalenceOnly&&r.phase!=='feedback'&&r.queue.length){const term=pool.find(t=>t.id===r.queue[0]);return {...restored,pair:true,phase:'synonym',meaningOK:true,selected:null,options:term?optionsFor(term,pool,'en-zh',links,true):[]};}if(r.phase==='synonym'&&!r.meaningOK&&r.queue.length){const term=pool.find(t=>t.id===r.queue[0]);return {...restored,phase:'feedback',feedbackStep:'meaning',selected:null,options:term?optionsFor(term,pool,r.direction,links):[],results:{...r.results,[r.queue[0]]:grade(r.results[r.queue[0]],false)}};}return refreshPracticeOptions(restored,pool,links);})():null;}catch{return null;}});
 const [today,setToday]=useState(reviewDay),[history,setHistory]=useState<ReviewHistory>(()=>readPracticeReviewHistory(studyStorage.getItem(reviewKey),run?.results,validIds));
 const actionLocked=useRef(false),current=pool.find(t=>t.id===run?.queue[0]);
 const lookback=readTestLookback(run?.lookback);
 const attemptStatus=current&&run?.phase==='feedback'?`${typeof run.attemptCounts?.[current.id]==='number'?`本轮第 ${run.attemptCounts[current.id]} 次作答`:'旧测试未记录总作答次数'} · ${run.results[current.id].done?'这一词已完成':`还需连续答对 ${Math.max(0,2-run.results[current.id].streak)} 次`}`:'';
 const due=duePracticeIds(history,today).filter(id=>matchesColor(id)),upcoming=Object.values(history).filter(r=>r.due>today).sort((a,b)=>a.due.localeCompare(b.due));
 useEffect(()=>{if(run&&getWorkspaceGeneration()===workspaceGeneration.current)studyStorage.setItem(key,JSON.stringify(run));},[run]);
 useEffect(()=>{if(getWorkspaceGeneration()===workspaceGeneration.current)studyStorage.setItem(reviewKey,JSON.stringify(history));},[history,reviewKey]);
 const autoSave=useTestAutosave(run,!!run&&!setup,workspaceGeneration.current);
 useEffect(()=>{const update=()=>setToday(reviewDay()),timer=setInterval(update,60000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[]);
 useEffect(()=>{actionLocked.current=false;},[run?.sessionId,run?.phase,run?.turn,run?.queue[0]]);
 const max=Math.max(1,...pool.map(t=>t.list)),lists=chosenLists??Array.from({length:Math.max(0,to-from+1)},(_,i)=>from+i);
 const inScope=(t:Term)=>(isNotebook||lists.includes(t.list))&&(deck!=='bb'||volume==='全部'||(t as Term&{volume?:string}).volume===volume)&&matchesColor(t.id);
 const listOptions=[...new Set(pool.filter(t=>deck!=='bb'||volume==='全部'||(t as Term&{volume?:string}).volume===volume).map(t=>t.list))];
 const count=pool.filter(inScope).length;
 const enoughNotebookChoices=!isNotebook||new Set(pool.map(term=>(direction==='en-zh'?term.meaning:term.word).trim().toLowerCase()).filter(Boolean)).size>=2;
 const usageModule=deck==='words'?'all_words':deck==='bb'?'bb':isNotebook?'notebook':deck.startsWith('zhang-')?'other':'a_plus';
 async function saveAndClose(){
  if(exitBusy.current)return;
  exitBusy.current=true;setExitSaving(true);setSaveStatus('正在核对本机与账号保存…');
  try{
   if(getWorkspaceGeneration()!==workspaceGeneration.current)throw Error('学习空间已切换，请在当前账号重新保存。');
   // Effects normally mirror these values. Write the current render explicitly
   // before flushing, so leaving can never outrun the latest React commit.
   if(run)studyStorage.setItem(key,JSON.stringify(run));
   studyStorage.setItem(reviewKey,JSON.stringify(history));
   const result=await persistLearningWorkspace(workspaceGeneration.current);
   if(!mounted.current)return;
   if(getWorkspaceGeneration()!==workspaceGeneration.current)throw Error('学习空间已切换，未关闭本页，请在当前账号核对保存。');
   if(!result.synced){setSaveStatus(result.message||'已保存到本机，账号同步尚未完成。请保留本页，稍后重试「保存并返回」。');return;}
   onClose();
  }catch(error){if(mounted.current)setSaveStatus((error instanceof Error?error.message:'保存未完成。')+' 本页进度仍保留，暂未退出；请重试保存或先导出便笺。');}
  finally{exitBusy.current=false;if(mounted.current)setExitSaving(false);}
 }
 function start(review=false){if(getWorkspaceGeneration()!==workspaceGeneration.current||exitBusy.current||actionLocked.current||lookbackAt!==null||!enoughNotebookChoices)return;const day=reviewDay(),ids=new Set(duePracticeIds(history,day));const scoped=pool.filter(t=>review?ids.has(t.id)&&matchesColor(t.id):inScope(t));if(!scoped.length)return;actionLocked.current=true;setToday(day);if(run)recordPracticeWords(Object.keys(run.results).map(id=>pool.find(t=>t.id===id)?.word).filter((w):w is string=>!!w),deck);if(run&&run.turn>0&&!run.queue.length&&Object.values(run.results).every(r=>r.done))recordCompletedPractice(run.sessionId!,deck);trackUsage('module_open',usageModule);const terms=random?shuffle(scoped):review?[...scoped].sort((a,b)=>history[a.id].due.localeCompare(history[b.id].due)||pool.indexOf(a)-pool.indexOf(b)):scoped;setRun({sessionId:crypto.randomUUID(),queue:terms.map(t=>t.id),direction,pair:equivalenceOnly||pair,review,results:{},phase:equivalenceOnly?'synonym':'meaning',options:optionsFor(terms[0],pool,direction,links,equivalenceOnly),selected:null,meaningOK:equivalenceOnly,turn:0,attemptCounts:{}});setSetup(false);}
 function submit(uncertain=false){if(getWorkspaceGeneration()!==workspaceGeneration.current||exitBusy.current||lookbackAt!==null||actionLocked.current||!run||!current||run.phase==='feedback'||run.options.length<2||(!uncertain&&run.selected===null))return;actionLocked.current=true;recordPracticeWord(current.word,deck);const ok=!uncertain&&!!run.options[run.selected!]?.correct;
 const outcome=answerStep(run.phase==='synonym'?'synonym':'meaning',run.pair,ok,run.meaningOK);
 if(outcome.phase==='synonym'){setRun({...run,meaningOK:ok,phase:'synonym',meaningSelection:run.options[run.selected!],uncertain:false,options:optionsFor(current,pool,run.direction,links,true),selected:null});return;}
 recordLearningPlanWords([current.word],outcome.correct?'green':'red');
 const result=grade(run.results[current.id],outcome.correct),day=reviewDay(),nextHistory=recordPracticeReview(history,current.id,outcome.correct,result.done,day);studyStorage.setItem(reviewKey,JSON.stringify(nextHistory));setHistory(nextHistory);setToday(day);
 const previousAttempts=run.attemptCounts?.[current.id]??(run.results[current.id]?null:0),attempts=previousAttempts===null?null:previousAttempts+1;
 setRun({...run,attemptCounts:{...run.attemptCounts,[current.id]:attempts},meaningOK:outcome.meaningOK,phase:'feedback',feedbackStep:outcome.feedbackStep,uncertain,results:{...run.results,[current.id]:result}});}
 function next(){if(getWorkspaceGeneration()!==workspaceGeneration.current||exitBusy.current||lookbackAt!==null||actionLocked.current||!run||!current||run.phase!=='feedback')return;actionLocked.current=true;const queue=run.queue.slice(1);if(!run.results[current.id].done)queue.splice(Math.min(5,queue.length),0,current.id);const term=pool.find(t=>t.id===queue[0]);if(!term){recordCompletedPractice(run.sessionId??`legacy-${deck}-${run.turn+1}-${Object.keys(run.results).sort().join(',')}`,deck);trackUsage('practice_complete',usageModule);}const textFor=(option:Choice)=>option.word+' · '+option.meaning;
 const receipt:TestQuestionSnapshot={id:(run.sessionId??'legacy')+':'+run.turn,word:current.word,meaning:current.meaning,status:attemptStatus,steps:[
 ...(run.feedbackStep==='synonym'&&run.meaningSelection?[{label:'释义',chosen:[textFor(run.meaningSelection)],correct:[current.word+' · '+current.meaning],options:[]}]:[]),
 {label:run.feedbackStep==='synonym'?'同义词':'释义',chosen:run.uncertain?['不确定']:run.selected===null?[]:[textFor(run.options[run.selected])],correct:run.options.filter(option=>option.correct).map(textFor),options:run.options.map((option,index)=>({text:textFor(option),chosen:!run.uncertain&&index===run.selected,correct:option.correct}))}
 ],notes:[...captureTestNotes([current.word,...(run.pair?current.synonyms?.slice(0,1)??[]:[])],memory),...(current.note?[{word:'收集笔记'+(current.origin?' · '+current.origin:''),text:current.note.slice(0,3000)}]:[])]};
 setRun({...run,queue,turn:run.turn+1,lookback:appendTestLookback(run.lookback,receipt),phase:equivalenceOnly?'synonym':'meaning',selected:null,meaningOK:equivalenceOnly,meaningSelection:null,uncertain:false,options:term?optionsFor(term,pool,run.direction,links,equivalenceOnly):[]});}
 function selectOption(index:number){if(getWorkspaceGeneration()!==workspaceGeneration.current||exitBusy.current||setup||lookbackAt!==null||actionLocked.current||!run||!current||run.phase==='feedback'||!run.options[index])return;setRun({...run,selected:index});}
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{
  if(exitBusy.current||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();void saveAndClose();return;}
  if(getWorkspaceGeneration()!==workspaceGeneration.current||lookbackAt!==null||setup||!current)return;
  const letter=e.key.toLowerCase();
  if(run?.phase!=='feedback'&&(letter==='u'||/^[a-f]$/.test(letter))){e.preventDefault();e.stopImmediatePropagation();letter==='u'?submit(true):selectOption(letter.charCodeAt(0)-97);return;}
  if(e.key==='Enter'&&(!(e.target as HTMLElement)?.closest('button')||!!(e.target as HTMLElement)?.closest('.practiceOptions'))){e.preventDefault();e.stopImmediatePropagation();run?.phase==='feedback'?next():submit();}
 };window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);});

 const answering=!setup&&(!!current||lookbackAt!==null),feedback=run?.phase==='feedback';
 useEffect(()=>{if(!answering)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[answering]);
 const reviewPanel=<section className="practiceReviewPlan" aria-labelledby="practiceReviewTitle">
  <div className="practiceReviewSummary"><div><span className="eyebrow">到期复习 · 北京时间</span><h3 id="practiceReviewTitle">今天待复习 <strong>{due.length}</strong> 个词条</h3><p>已纳入 {Object.keys(history).length} 词条 · 逾期 {due.filter(id=>history[id].due<today).length} 词条{upcoming.length?' · 下次 '+upcoming[0].due:''}</p></div><button className="primary" disabled={!due.length} onClick={()=>start(true)}>{due.length?'开始到期复习':'今天暂无到期词'}</button></div>
  <p>复习间隔：{REVIEW_INTERVALS.join('、')} 天，之后每 30 天。答错或不确定，第二天重新复习；同日反复答对不连续升级。</p>
  <p>采用下方的测试方向、题型和顺序，复习本模块到期词，可使用下方红绿灯筛选；不受新测试的 List 范围限制。开始会替换当前一轮测试，长期计划保留。</p>
  {due.length>0&&<details><summary>查看到期词</summary><div className="practiceDueWords">{due.map(id=>{const term=pool.find(t=>t.id===id)!;return <span key={id}><strong>{term.word}</strong><small>{isNotebook?term.origin??"生词本":groupLabel(term.list)} · {history[id].due}</small></span>;})}</div></details>}
  {!Object.keys(history).length?<p className="practiceReviewHint">完成测试作答后，词条会自动加入计划。旧版仍保存的已测词，会先列为今天到期。</p>:<p className="practiceReviewHint">计划随当前学习空间保存，可通过账号同步或便笺带到其他设备。</p>}
 </section>;
 return <div className={`practiceOverlay${answering?' practiceFocus':''}`} role="dialog" aria-modal="true" aria-label="词汇测试"><section className="practicePanel" onKeyDown={event=>event.stopPropagation()}><header><h2>{deck.startsWith('zhang-')?zhangDecks[deck as ZhangDeck].title:isNotebook?'生词本':deck==='bb'?'BB 六选二':deck==='a-plus'?'A+ 等价词':'全能词'}测试</h2><button disabled={exitSaving||!lookback.length} onClick={()=>setLookbackAt(lookback.length-1)}>上一词回看</button><button disabled={exitSaving} onClick={()=>void saveAndClose()}>{exitSaving?'正在保存…':'保存并返回'}</button></header>
 <div className="testToolbar">{autoSave.status&&<div className="testSaveStatus"><small role="status">{autoSave.status}</small><button onClick={autoSave.retry}>重试同步</button></div>}{!setup&&current&&lookbackAt===null&&<TestAudio word={run!.direction==='zh-en'&&run!.phase!=='feedback'&&!equivalenceOnly?'':current.word} questionKey={run!.sessionId+':'+run!.turn}/>}</div>
 {saveStatus&&<p role="status" aria-live="polite" style={{fontSize:14,margin:'8px 0'}}>{saveStatus}</p>}
 {lookbackAt!==null?<TestQuestionHistory snapshots={lookback} index={lookbackAt} onIndex={setLookbackAt} onReturn={()=>setLookbackAt(null)}/>:setup?<div className="practiceSetupBody">{!equivalenceOnly&&reviewPanel}
 {run&&run.queue.length>0&&<div className="practiceResume"><span>上次{run.review?'到期复习':'测试'}：待过关 {run.queue.length} 个词条</span><button onClick={()=>setSetup(false)}>继续上次测试</button></div>}
 <h3>测试设置</h3>{isNotebook&&<p>选中的收集：{notebook?.source} · {pool.length} 个词</p>}<p>{equivalenceOnly?'看单词，从六个选项中选择同义词。答后显示正确词、释义与记忆笔记；答错的词稍后再见。':'首次全对直接过关，出错后隔 5 题返场，连续两次全对才过关。'}</p>
 <div className="practiceSettings">{!isNotebook&&<><label>起始 List <input type="number" min={1} max={max} value={from} onChange={e=>{setFrom(+e.target.value);setChosenLists(null);}}/></label><label>结束 List <input type="number" min={1} max={max} value={to} onChange={e=>{setTo(+e.target.value);setChosenLists(null);}}/></label></>}{!equivalenceOnly&&<label>测试方向<select aria-label="测试方向" value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="en-zh">看英文选中文</option><option value="zh-en">看中文选英文</option></select></label>}<label>出题顺序<select aria-label="出题顺序" value={String(random)} onChange={e=>setRandom(e.target.value==='true')}><option value="true">乱序</option><option value="false">顺序</option></select></label>{deck==='a-plus'&&<label>测试内容<select aria-label="测试内容" value={String(pair)} onChange={e=>setPair(e.target.value==='true')}><option value="false">释义测试</option><option value="true">释义 + 六选一同义词</option></select></label>}</div>{deck==='bb'&&<label>BB 分册<select aria-label="测试BB分册" value={volume} onChange={e=>setVolume(e.target.value)}><option>全部</option>{['上','中','下'].map(v=><option key={v}>{v}</option>)}</select></label>}{!isNotebook&&<SelectionChips label="测试 List" options={listOptions.map(n=>({id:String(n),label:groupLabel(n)}))} selected={lists.filter(n=>listOptions.includes(n)).map(String)} onChange={ids=>setChosenLists(ids.map(Number))}/>}<div className="testColorFilter"><p>联动红绿灯：可同时选多个颜色；全不选时不安排测试。</p><SelectionChips label="测试红绿灯范围" options={[...testColors]} selected={colors} onChange={ids=>setColors(ids as TestColor[])}/></div><p>新测试范围内 {count} 个词条</p>{!enoughNotebookChoices&&<p role="status">需要至少两条不同的释义／单词才能测试，请选择更多收集；这里不会编造干扰项。</p>}<button className="primary" disabled={!count||!enoughNotebookChoices} onClick={()=>start()}>开始新测试</button></div>:!current?<><h3>本轮完成</h3><p>已完成 {run?.turn??0} 次作答。测试与到期复习计划已保存到当前学习空间，也会包含在便笺中。</p><button onClick={()=>setSetup(true)}>{equivalenceOnly?'选择新范围':'查看复习计划／选择新范围'}</button></>:<>
 <div className="practiceQuestionHeader"><p>{run!.review?'到期复习 · ':''}已答 {run!.turn} 次 · 待过关 {run!.queue.length} 个{isNotebook?" · 生词本":` · ${groupLabel(current.list)}`}</p><h3 className={`practicePrompt${run!.phase==='synonym'||run!.direction==='en-zh'?' enWord':''}`}>{run!.phase==='synonym'||run!.direction==='en-zh'?current.word:current.meaning}</h3>{(run!.phase==='synonym'||run!.direction==='en-zh')&&<NotebookFrequencyBadge word={current.word}/>}</div>
 {!feedback&&<p className="practiceShortcutHint"><kbd>A–F</kbd> 选择选项 · <kbd>U</kbd> 不确定 · <kbd>Enter</kbd> 提交</p>}{run!.options.length<2&&<p role="status">当前词缺少不同释义的干扰项，请返回测试设置并增加收集范围。</p>}<div className={`practiceQuestionContent${feedback?' hasFeedback':''}`}><section className="practiceAnswerArea"><p className="practiceStepLabel">{run!.phase==='synonym'?(equivalenceOnly?(deck==='zhang-pairs'?'选择原表中的等价词':'从六个词中选一个同义词'):'02 · 从六个词中选一个同义词'):feedback?'本题解析':'01 · 选择对应的释义或单词'}</p><div className="practiceOptions">{run!.options.map((o,i)=><button key={i} disabled={feedback||exitSaving} aria-pressed={run!.selected===i} className={feedback?(o.correct?'isCorrect':run!.selected===i?'isWrong':''):run!.selected===i?'isSelected':''} onClick={()=>selectOption(i)} aria-keyshortcuts={String.fromCharCode(65+i)}><span className={run!.phase==='synonym'||run!.pair&&feedback&&run!.feedbackStep!=='meaning'||run!.direction==='zh-en'?'practiceEnglish':undefined}>{String.fromCharCode(65+i)} · {run!.phase==='synonym'||run!.pair&&feedback&&run!.feedbackStep!=='meaning'||run!.direction==='zh-en'?o.word:o.meaning}</span>{feedback&&<small>{o.word} · {o.meaning}{o.correct?' · 正确答案':''}</small>}</button>)}</div>
 {feedback&&<div className="practiceFeedback"><p className="testAttemptStatus">{attemptStatus}</p><strong>{run!.results[current.id].streak>0?'本轮全对':'本轮有误，稍后再复习'}</strong><p>{current.word} · {current.meaning}</p>{run!.pair&&<p>对应等价词：{current.synonyms?.join(' · ')}{!run!.meaningOK&&run!.feedbackStep==='meaning'?' · 释义未答对，本轮已跳过选同义词':''}</p>}{history[current.id]&&<p className="practiceNextReview">下次到期复习：{history[current.id].due}</p>}</div>}</section>
 {feedback&&<aside className="practiceMemoryPanel" aria-label="记忆方法"><div className="practiceInlineNotes">{current.origin&&<p className="practiceNotebookSource">释义来源：{current.origin}</p>}{current.note&&<section className="practiceNotebookNote"><strong>收集笔记</strong><p style={{whiteSpace:"pre-wrap"}}>{current.note}</p></section>}<SharedWordMemory word={current.word}/>{run!.pair&&current.synonyms?.slice(0,1).map(w=><SharedWordMemory key={w} word={w} hideWord={false}/>)}</div></aside>}</div>
 <footer className="practiceFooter"><button disabled={exitSaving} onClick={()=>setSetup(true)}>测试设置</button><div>{feedback?<button className="primary" disabled={exitSaving} onClick={next}>下一题 ↵</button>:<><button disabled={exitSaving||run!.options.length<2} onClick={()=>submit(true)} aria-keyshortcuts="U">不确定 · U</button><button className="primary" disabled={exitSaving||run!.selected===null||run!.options.length<2} onClick={()=>submit()}>提交答案 ↵</button></>}</div></footer>
 </>}
 </section></div>;
}
