/** External lookups open only after a click; no notebook content is sent. */
export default function DictionaryLinks({word,onSelect}: {word: string;onSelect?:(source:'merriam'|'dictcn')=>void}) {
  const query = word.trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return <div className="dictionaryExternal">
    <div className="dictionaryExternalLinks" role="group" aria-label={`查阅 ${query} 的词典`}>
      <a href={`https://www.merriam-webster.com/dictionary/${encoded}`} target="_blank" rel="noopener noreferrer" onClick={()=>onSelect?.('merriam')} aria-label={`在韦氏词典查询 ${query}（新窗口）`}>韦氏词典 <span aria-hidden="true">↗</span></a>
      <a href={`https://dict.cn/${encoded}`} target="_blank" rel="noopener noreferrer" onClick={()=>onSelect?.('dictcn')} aria-label={`在海词词典查询 ${query}（新窗口）`}>海词词典 <span aria-hidden="true">↗</span></a>
    </div>
    <p className="dictionaryExternalHint">在新窗口查看官方释义与例句，返回后可继续编辑。</p>
  </div>;
}
