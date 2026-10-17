import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
export function loadTs(file,cache=new Map()){
 const full=path.resolve(file);if(cache.has(full))return cache.get(full);
 const out={};cache.set(full,out);
 const source=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(name=>{if(!name.startsWith('.'))throw Error('Unexpected dependency '+name);return loadTs(path.resolve(path.dirname(full),name+'.ts'),cache);},out);return out;
}
