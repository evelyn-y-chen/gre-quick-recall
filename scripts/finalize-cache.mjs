import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets=(await readdir('dist/assets')).filter(name=>/\.(js|css|wasm)$/.test(name)).sort().map(name=>'assets/'+name);
if(!assets.length)throw Error('No built assets; refusing to write an empty production cache.');
const revision=createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,16);
const worker=(await readFile('public/sw.js','utf8')).replace("const CACHE='gre-community-shell-development';",`const CACHE='gre-community-shell-${revision}';`).replace('const ASSETS=null;',`const ASSETS=${JSON.stringify(assets)};`);
await writeFile('dist/sw.js',worker);
console.log(`Current-build cache: ${assets.length} assets; older program caches removed on update.`);
