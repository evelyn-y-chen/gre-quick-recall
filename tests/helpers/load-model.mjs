import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Local TS/JSON models, including their real relative dependencies. */
export function loadModel(file, cache = new Map()) {
  let full = path.resolve(file);
  if (!path.extname(full)) full += fs.existsSync(full + '.ts') ? '.ts' : '.tsx';
  if (cache.has(full)) return cache.get(full);
  if (full.endsWith('.json')) {
    const value = { default: JSON.parse(fs.readFileSync(full, 'utf8')) };
    cache.set(full, value); return value;
  }
  const exports = {}; cache.set(full, exports);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code)(name => {
    // JSX is present only in a receipt view; its pure helpers are also exercised
    // by scheduling tests that provide their own component host.
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (!name.startsWith('.')) throw Error('Unexpected model dependency: ' + name);
    return loadModel(path.resolve(path.dirname(full), name), cache);
  }, exports);
  return exports;
}
