import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createLabServer} from '../server.js';
test('loopback server receives, persists and reads a result; grading data is not served before submission',async()=>{
  const dataDir=await mkdtemp(path.join(os.tmpdir(),'jev-form-lab-test-'));
  const server=await createLabServer({dataDir});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/grader.js')).status,404);
    assert.equal((await fetch(base+'/api/results')).status,200);
    const response=await fetch(base+'/submit',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({runId:'00000000-0000-4000-8000-000000000000',fields:{a31:false,a22:''}})});
    assert.equal(response.status,200);const result=await response.json();assert.equal(result.grade.rows.find(x=>x.name==='a31').ok,true);
    const received=await(await fetch(base+'/api/results')).json();assert.equal(received.count,1);assert.equal(received.results[0].id,result.id);
    const rejected=await fetch(base+'/submit',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.example.test'},body:'{}'});assert.equal(rejected.status,403);
    assert.equal((await(await fetch(base+'/api/results')).json()).count,1);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true});}
});
