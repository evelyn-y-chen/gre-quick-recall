import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript'),module={exports:{}};
new Function('exports','module',ts.transpileModule(readFileSync('community/loginProviders.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports,module);
const {enabledLoginProviders,socialLoginOptions}=module.exports;
test('only explicitly enabled server providers can be used',()=>{
 assert.deepEqual(enabledLoginProviders({external:{github:true,google:false}}),{github:true,google:false});
 assert.deepEqual(enabledLoginProviders({external:{github:false,google:true}}),{github:false,google:true});
 for(const invalid of [undefined,null,{},'error',{external:{github:'true',google:1}}])assert.deepEqual(enabledLoginProviders(invalid),{github:false,google:false});
});
test('both login providers return to the renamed site and request only identity scopes',()=>{
 const target='https://evelyn-y-chen.github.io/gre-quick-recall/';
 const github=socialLoginOptions('github',target),google=socialLoginOptions('google',target);
 assert.equal(github.options.redirectTo,target);assert.equal(google.options.redirectTo,target);
 assert.equal(github.provider,'github');assert.equal(google.provider,'google');
 assert.equal(github.options.scopes,'read:user user:email');assert.equal(google.options.scopes,'openid email profile');
});
