// Builds the test-only copy of the packaged extension: the release ZIP plus host access to the local fixtures.
// Usage: node dev/e2e/prepare.mjs <empty output dir>   (run `npm run package` first)
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||(await readdir(out).catch(()=>[])).length) throw new Error('Pass an empty output directory.');
execFileSync('unzip',['-q',new URL('../../dist/jev-form-fill.zip',import.meta.url).pathname,'-d',out]);
const manifestPath=path.join(out,'jev-form-fill/manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.host_permissions.push('http://127.0.0.1/*');
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
console.log(path.join(out,'jev-form-fill'));
