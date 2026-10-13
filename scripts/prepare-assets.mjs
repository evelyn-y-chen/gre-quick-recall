import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
await mkdir('public/dictionary-v1',{recursive:true});
for(const name of await readdir('dictionary-data')) {
 if(name.endsWith('.json.gz')) await writeFile('public/dictionary-v1/'+name.slice(0,-3),gunzipSync(await readFile('dictionary-data/'+name)));
 else if(!name.endsWith('.json')) await cp('dictionary-data/'+name,'public/dictionary-v1/'+name);
}
