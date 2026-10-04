// Builds the test-only copy of the extension: a fresh release ZIP plus host access to the local fixtures.
// Usage: node dev/e2e/prepare.mjs <empty output dir>   -> prints the extension directory to load
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../..',import.meta.url));
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||(await readdir(out).catch(()=>[])).length) throw new Error('Pass an empty output directory.');
await mkdir(out,{recursive:true});
const zip=path.join(out,'jev-form-fill.zip');
execFileSync('python3',[path.join(root,'scripts/package.py'),'--output',zip],{stdio:['ignore','ignore','inherit']});
execFileSync('unzip',['-q',zip,'-d',out]);
const manifestPath=path.join(out,'jev-form-fill/manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.host_permissions.push('http://127.0.0.1/*');
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
console.log(path.join(out,'jev-form-fill'));
