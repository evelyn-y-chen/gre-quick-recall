import {useEffect,useState} from 'react';
import {exportWorkspace} from './database';
import {summarizeProgress,type Catalog} from './personalProgressModel';
import vocabulary from '../app/vocabulary.json';
import equivalents from '../app/equivalents.json';
import aplus from '../app/aPlusEquivalents.json';
import {equivalents as aPlusTerms} from '../app/aPlusTestModel';
import bb from '../app/bbEquivalents.json';
import glee from '../app/glee1500.json';
import fill from '../app/lcljFill.json';
import reading from '../app/lcljReading.json';
import mathIndex from '../app/lcljMath.json';
import {MATH_WORDS} from '../app/mathVocabulary';
const catalogs:Catalog[]=[
 {id:'words',name:'全能词速刷',module:'words',storageKey:'gre-quick-ratings-v1',entries:vocabulary.map(w=>({id:w.id,words:[w.word]}))},
 {id:'equivalents',name:'等价词速刷',module:'equivalents',storageKey:'gre-equivalent-quick-ratings-v1',entries:equivalents.map(w=>({id:w.id,words:[w.left,w.right]}))},
 {id:'a-plus',name:'A+ 等价词',module:'a-plus',storageKey:'gre-a-plus-equivalent-quick-ratings-v1',entries:aplus.map(w=>({id:w.id,words:[w.word,...aPlusTerms(w)]}))},
 {id:'bb',name:'BB 六选二',module:'bb',storageKey:'gre-bb-ratings-v1',entries:bb.map(w=>({id:w.id,words:w.words.map(x=>x.word)}))},
 {id:'glee',name:'GLEE 1500',module:'glee',storageKey:'gre-glee-1500-quick-ratings-v1',entries:glee.map(w=>({id:w.id,words:[w.word]}))},
 {id:'math',name:'数学词汇',module:'math',storageKey:'gre-math-vocabulary-quick-ratings-v1',entries:MATH_WORDS.map(w=>({id:w.id,words:[w.term]}))},
 ...([{id:'lclj-fill',name:'填空高频词',data:fill},{id:'lclj-reading',name:'阅读核心词',data:reading},{id:'lclj-math',name:'数学词汇索引',data:mathIndex}].map(d=>({id:d.id,name:d.name,module:'lclj',storageKey:'gre-lclj-quick-ratings-v1',entries:d.data.map(w=>({id:w.id,words:[w.word]}))}))),
 {id:'notebook',name:'生词本',module:'notebook',storageKey:'',entries:[]}
];
function read(){return summarizeProgress(exportWorkspace(),catalogs);}
export default function PersonalProgress({onClose}:{onClose?:()=>void}){
 const [report,setReport]=useState(read);useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')setReport(read());},5000);return()=>clearInterval(timer);},[]);
 const percent=report.studied?Math.round(report.familiar/report.studied*100):0;
 const content=<section className="personalProgress" aria-labelledby={onClose?'progressDialogTitle':'progressHomeTitle'}><header><div><p className="eyebrow">一点一滴，都算数</p><h2 id={onClose?'progressDialogTitle':'progressHomeTitle'}>我的进步 <span lang="en">My progress</span></h2></div>{onClose?<button onClick={onClose}>关闭</button>:<button onClick={()=>setReport(read())}>刷新</button>}</header><div className="personalProgressHero"><div className="personalProgressRing" style={{background:`conic-gradient(var(--progress-green) ${percent}%,var(--community-line) 0)`}} role="img" aria-label={`已练习的词中 ${percent}% 自测熟悉`}><div><strong>{report.familiar.toLocaleString()}</strong><span>个词已熟悉</span></div></div><div className="personalProgressMetrics"><p><strong>{report.studied.toLocaleString()}</strong><span>个词练习过</span></p><p><strong>{report.tests.toLocaleString()}</strong><span>轮测试已完成</span></p><small>练习与红绿灯自测，都在这里留下足迹。</small></div></div><div className="personalProgressDecks">{report.top.length?report.top.map(g=><article key={g.id}><div><h3>{g.name}</h3><span><strong>{g.familiar.toLocaleString()}</strong> / {g.total.toLocaleString()} 个词已熟悉</span></div><div className="personalProgressBar" role="img" aria-label={`${g.name}：熟悉 ${g.familiar}，模糊 ${g.fuzzy}，不认识 ${g.unknown}，未标记 ${g.unrated}`}><i className="known" style={{width:`${g.total?g.familiar/g.total*100:0}%`}}/><i className="unsure" style={{width:`${g.total?g.fuzzy/g.total*100:0}%`}}/><i className="unknown" style={{width:`${g.total?g.unknown/g.total*100:0}%`}}/></div><p><span className="greenText">● 熟悉 {g.familiar}</span><span>● 待巩固 {g.fuzzy+g.unknown}</span><span>○ 未标记 {g.unrated}</span></p></article>):<p className="personalProgressEmpty">先给几个词标上红黄绿，你的进步会从这里慢慢长出来。</p>}</div><details className="personalProgressMethod"><summary>这些数字怎么算？</summary><p>展示练习记录最多的三个板块。练习数包括红绿灯标记与测试作答；熟悉数取绿色自评，测试不会擅自替你标绿。同一词不分大小写去重；重复位置或不同模块的标记不一致时，按较不熟悉的状态计算。词组的标记用于组内单词。绿色表示红绿灯自测熟悉，不是考试验证的永久掌握。</p><p>完成测试数从此版本起累积，旧版仅计仍保留、可识别的完成轮次。个人数据随当前账号或便笺保存，不使用其他人的统计。</p></details></section>;
 return onClose?<div className="analyticsOverlay" role="dialog" aria-modal="true" aria-label="我的进步"><div className="personalProgressModal">{content}</div></div>:content;
}
