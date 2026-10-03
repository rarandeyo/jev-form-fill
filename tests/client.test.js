import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callJev} from '../client.js';
test('requests go only to the TypeSafe endpoint, exclude cookies and disallow redirects',async()=>{
  let count=0;
  await callJev({model:'jev-latest',state:{source:'Name: Alice'},questions:{}},'test-key',{fetcher:async(url,options)=>{
    count++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer test-key');assert.ok(options.signal);
    return {ok:true,json:async()=>({answers:{}})};
  }});
  assert.equal(count,1);
});
test('authentication, quota and malformed responses fail visibly without a fallback or retry',async()=>{
  for(const status of [401,429,422,529]) {
    let count=0;
    await assert.rejects(callJev({},'test-key',{fetcher:async()=>{count++;return {ok:false,status};}}));
    assert.equal(count,1);
  }
  await assert.rejects(callJev({},'test-key',{fetcher:async()=>({ok:true,json:async()=>({answers:null})})}),/有効な回答/);
});
