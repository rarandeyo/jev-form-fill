import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,rm,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

test('standalone lab keeps its receipts and startup information inside its own checkout',async()=>{
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'jev-lab-checkout-')));
  const checkout=path.join(temp,'checkout');await mkdir(checkout);
  await cp(new URL('../',import.meta.url),path.join(checkout,'lab'),{recursive:true});
  const child=spawn(process.execPath,[path.join(checkout,'lab/server.js'),'--port','0'],{cwd:temp,stdio:['ignore','pipe','pipe']});
  let record;
  try {
    record=await new Promise((resolve,reject)=>{
      let stdout='',stderr='';const timer=setTimeout(()=>reject(new Error(`startup timeout: ${stderr}`)),5000);
      child.stderr.on('data',data=>{stderr+=data;});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`server exited ${code}: ${stderr}`));});
      child.stdout.on('data',data=>{
        stdout+=data;
        if(stdout.includes('\n')) {clearTimeout(timer);resolve(JSON.parse(stdout.split('\n')[0]));}
      });
    });
    assert.equal((await fetch(record.url)).status,200);
    const disk=JSON.parse(await readFile(path.join(checkout,'.local/form-fill-lab/server.json'),'utf8'));
    assert.equal(disk.url,record.url);
    const response=await fetch(record.url+'submit',{method:'POST',headers:{'Content-Type':'application/json',Origin:record.url.slice(0,-1)},body:JSON.stringify({runId:'00000000-0000-4000-8000-000000000000',fields:{}})});
    assert.equal(response.status,200);
    assert.equal((await(await fetch(record.url+'api/results')).json()).count,1);
  } finally {
    if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
    await rm(temp,{recursive:true,force:true});
  }
});
