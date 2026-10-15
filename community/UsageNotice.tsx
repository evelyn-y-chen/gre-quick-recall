export default function UsageNotice({accept,download,clear,login,ready,status}:{accept:()=>void;download:()=>void;clear:()=>void;login:()=>void;ready:boolean;status:string}){
 return <main className="consentPage"><section className="consentCard" aria-labelledby="consentTitle">
 <p>词笺 · Lemnota</p><h1 id="consentTitle">让每一次学习，帮助词笺成长</h1>
 <p>词笺是一个免费、公益分享的个人项目。为了了解它是否真正帮助了大家，并在项目介绍、作品集或研究中展示实际使用情况，使用前需要同意基本使用统计。</p>
 <h2>我们记录什么？</h2><p>使用日期、使用的功能，以及复习、保存笔记、完成测试、导入或导出便笺的次数。系统使用随机访客标识或处理后的账号标识识别重复访问，以计算活跃人数。</p>
 <h2>我们不记录什么？</h2><p>这些统计不包含笔记正文、便笺内容、密码或具体答题内容。账号登录与个人进度保存另行处理。</p>
 <h2>数据如何使用？</h2><p>用于改进功能，以及在项目介绍、作品集或研究中展示项目活跃度和使用成效。对外仅展示汇总数据，不出售统计数据，也不用于广告或其他商业用途。每次上报会清理 90 天以前的行为记录。</p>
 <p>你可以随时在「使用统计」中撤回同意；撤回后停止后续统计并返回此页，仍可导出或清空当前学习空间。</p><p>谢谢你，让词笺的成长有迹可循。</p>
 <div className="consentActions"><button className="primary" onClick={accept}>同意使用统计，进入词笺</button><button onClick={()=>{document.getElementById('consentExit')?.focus();}}>暂不同意，退出学习</button></div>
 <p id="consentExit" tabIndex={-1}>未同意时不会开启统计或进入学习。你可以直接关闭此页面，也可以在下方管理已有记录。</p>
 <details><summary>管理已有记录（无需同意统计）</summary><p>以下操作不会开启使用统计。清空只针对当前学习空间，不会删除账号或历史汇总统计。登录后可管理自己的账号记录。</p><div className="consentActions"><button disabled={!ready} onClick={download}>导出当前便笺</button><button disabled={!ready} onClick={clear}>清空当前学习空间</button><button onClick={login}>登录 / 切换账号</button></div><p role="status">{status}</p></details>
 </section></main>;
}
