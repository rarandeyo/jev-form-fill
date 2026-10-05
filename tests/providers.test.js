import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providers,profileOf} from '../providers.js';
const cloudflare=profileOf('cloudflare');
import {callJev} from '../client.js';
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
const accountId='0123456789abcdefABCDEF0123456789';
const json=value=>async()=>value;
test('manifest host permissions and connect-src list exactly the provider hosts',()=>{
  const hosts=Object.values(providers).map(x=>x.host).sort();
  assert.deepEqual([...manifest.host_permissions].sort(),hosts.map(x=>`${x}/*`));
  const connect=manifest.content_security_policy.extension_pages.split(';').map(x=>x.trim().split(/\s+/)).find(x=>x[0]==='connect-src').slice(1);
  assert.deepEqual(connect.sort(),hosts);
  for(const provider of Object.values(providers)) for(const model of Object.keys(provider.models)) assert.equal(new URL(profileOf(provider.id,model).url({accountId})).origin,provider.host);
});
test('Clef Flash relaxes only confidence; p, margin and the noul verification stay at the Jev values',()=>{
  const jev=profileOf('typesafe').thresholds;
  assert.deepEqual({...providers.cloudflare.models['clef-flash'].thresholds},{...jev,confidence:0.7});
  assert.equal(profileOf('typesafe').model,'jev-latest');
});
test('Cloudflare defaults to Clef, and each model has its own model name, endpoint and thresholds',()=>{
  assert.equal(cloudflare.modelId,'clef');assert.equal(cloudflare.model,'clef');
  assert.equal(cloudflare.url({accountId}),`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef`);
  const flash=profileOf('cloudflare','clef-flash');
  assert.equal(flash.model,'clef-flash');assert.equal(flash.url({accountId}),`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`);
  assert.equal(profileOf('cloudflare','unknown').modelId,'clef');
  assert.equal(cloudflare.thresholds,providers.cloudflare.models.clef.thresholds);
});
test('cloudflare requests use the account URL and the same fetch hardening',async()=>{
  let seen;
  const result=await callJev({model:'clef',state:{source:'Name: Alice'},questions:{}},' cf-token ',{provider:cloudflare,accountId,fetcher:async(url,options)=>{
    seen={url,options};
    return {ok:true,json:json({result:{model:'clef-flash',answers:{f0:{type:'noul',noul:0.95}},usage:{}},success:true,errors:[],messages:[]})};
  }});
  assert.equal(seen.url,`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef`);
  assert.equal(seen.options.redirect,'error');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.cache,'no-store');
  assert.equal(seen.options.headers.Authorization,'Bearer cf-token');assert.ok(seen.options.signal);
  assert.equal(JSON.parse(seen.options.body).model,'clef');
  assert.deepEqual(result.answers,{f0:{type:'noul',noul:0.95}});
});
test('the request body is sent as built by core, and unparsable bodies become a fixed message',async()=>{
  let body;
  await callJev({model:'jev-latest',questions:{}},'k',{fetcher:async(url,options)=>{body=JSON.parse(options.body);return {ok:true,json:json({answers:{}})};}});
  assert.deepEqual(body,{model:'jev-latest',questions:{}});
  for(const id of Object.keys(providers)) await assert.rejects(callJev({},'t',{provider:profileOf(id),accountId,fetcher:async()=>({ok:true,json:async()=>JSON.parse('upstream secret detail')})}),error=>error.message==='APIから有効な回答が返りませんでした。');
});
test('cloudflare accepts bare answers and rejects success:false or missing answers',async()=>{
  const call=value=>callJev({},'t',{provider:cloudflare,accountId,fetcher:async()=>({ok:true,json:json(value)})});
  assert.deepEqual((await call({answers:{}})).answers,{});
  await assert.rejects(call({success:false,errors:[{code:3040,message:'secret upstream detail'}],result:null}),error=>error.message==='APIが混雑しています。しばらく待ってやり直してください。');
  await assert.rejects(call({success:false,errors:[{code:9999,message:'secret upstream detail'}]}),error=>error.message==='APIエラー (200)');
  await assert.rejects(call({success:true,result:{answers:null}}),/有効な回答/);
  await assert.rejects(call({success:true}),/有効な回答/);
});
test('cloudflare HTTP failures map to fixed messages and never surface the upstream body',async()=>{
  const fail=(status,body)=>callJev({},'t',{provider:cloudflare,accountId,fetcher:async()=>({ok:false,status,json:async()=>{if(body===undefined) throw new SyntaxError('not json');return body;}})});
  const cases=[[401,undefined,'APIキーが無効です。'],[403,{errors:[{code:5035,message:'secret upstream detail'}]},'APIを利用する権限がありません。'],[429,{errors:[{code:3036}]},'APIの1日の利用枠を使い切りました。'],[429,undefined,'APIの利用上限に達しました。しばらく待ってやり直してください。'],[400,{errors:[{code:3003}]},'APIが要求形式を受け付けませんでした。'],[429,{errors:[{code:3040}]},'APIが混雑しています。しばらく待ってやり直してください。'],[500,{errors:[{message:'secret upstream detail'}]},'APIエラー (500)'],[404,undefined,'APIエラー (404)']];
  for(const [status,body,message] of cases) await assert.rejects(fail(status,body),error=>error.message===message);
});
test('abort and timeout while reading the body keep their error names',async()=>{
  for(const name of ['AbortError','TimeoutError']) await assert.rejects(callJev({},'t',{fetcher:async()=>({ok:true,json:async()=>{throw new DOMException('stopped',name);}})}),error=>error.name===name);
});
test('cloudflare settings are validated before any request; the account id is URL-encoded',async()=>{
  for(const [key,id,pattern] of [['','x'.repeat(32),/APIトークン/],['t','',/Account ID/],['t','../'+'a'.repeat(29),/Account ID/],['t','a'.repeat(31),/Account ID/],['t','a'.repeat(33),/Account ID/]]) {
    let count=0;
    await assert.rejects(callJev({},key,{provider:cloudflare,accountId:id,fetcher:async()=>{count++;return {ok:true,json:json({answers:{}})};}}),pattern);
    assert.equal(count,0);
  }
  assert.match(cloudflare.url({accountId:'a/b?c'}),/accounts\/a%2Fb%3Fc\/ai/);
});
test('abort and timeout while reading an error body keep their error names',async()=>{
  for(const name of ['AbortError','TimeoutError']) await assert.rejects(callJev({},'t',{fetcher:async()=>({ok:false,status:500,json:async()=>{throw new DOMException('stopped',name);}})}),error=>error.name===name);
});
