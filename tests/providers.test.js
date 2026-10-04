import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providers} from '../providers.js';
import {callJev} from '../client.js';
import {PROFILE} from '../core.js';
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
const accountId='0123456789abcdefABCDEF0123456789';
const json=value=>async()=>value;
test('manifest host permissions and connect-src list exactly the provider hosts',()=>{
  const hosts=Object.values(providers).map(x=>x.host).sort();
  assert.deepEqual([...manifest.host_permissions].sort(),hosts.map(x=>`${x}/*`));
  const connect=manifest.content_security_policy.extension_pages.split(';').map(x=>x.trim().split(/\s+/)).find(x=>x[0]==='connect-src').slice(1);
  assert.deepEqual(connect.sort(),hosts);
  for(const provider of Object.values(providers)) assert.equal(new URL(provider.url({accountId})).origin,provider.host);
});
test('cloudflare thresholds start equal to the Jev profile',()=>{
  assert.deepEqual({...providers.cloudflare.thresholds},{...PROFILE.thresholds});
  assert.equal(providers.typesafe.model,'jev-latest');
});
test('cloudflare requests use the account URL, clef-flash model and the same fetch hardening',async()=>{
  let seen;
  const result=await callJev({model:'jev-latest',state:{source:'Name: Alice'},questions:{}},' cf-token ',{provider:providers.cloudflare,accountId,fetcher:async(url,options)=>{
    seen={url,options};
    return {ok:true,json:json({result:{model:'clef-flash',answers:{f0:{type:'noul',noul:0.95}},usage:{}},success:true,errors:[],messages:[]})};
  }});
  assert.equal(seen.url,`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`);
  assert.equal(seen.options.redirect,'error');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.cache,'no-store');
  assert.equal(seen.options.headers.Authorization,'Bearer cf-token');assert.ok(seen.options.signal);
  assert.equal(JSON.parse(seen.options.body).model,'clef-flash');
  assert.deepEqual(result.answers,{f0:{type:'noul',noul:0.95}});
});
test('typesafe requests always carry the typesafe model',async()=>{
  let body;
  await callJev({model:'clef-flash',questions:{}},'k',{fetcher:async(url,options)=>{body=JSON.parse(options.body);return {ok:true,json:json({answers:{}})};}});
  assert.equal(body.model,'jev-latest');
});
test('cloudflare accepts bare answers and rejects success:false or missing answers',async()=>{
  const call=value=>callJev({},'t',{provider:providers.cloudflare,accountId,fetcher:async()=>({ok:true,json:json(value)})});
  assert.deepEqual((await call({answers:{}})).answers,{});
  await assert.rejects(call({success:false,errors:[{code:3040,message:'secret upstream detail'}],result:null}),error=>error.message==='APIが混雑しています。しばらく待ってやり直してください。');
  await assert.rejects(call({success:false,errors:[{code:9999,message:'secret upstream detail'}]}),error=>error.message==='APIエラー (200)');
  await assert.rejects(call({success:true,result:{answers:null}}),/有効な回答/);
  await assert.rejects(call({success:true}),/有効な回答/);
});
test('cloudflare HTTP failures map to fixed messages and never surface the upstream body',async()=>{
  const fail=(status,body)=>callJev({},'t',{provider:providers.cloudflare,accountId,fetcher:async()=>({ok:false,status,json:async()=>{if(body===undefined) throw new SyntaxError('not json');return body;}})});
  const cases=[[401,undefined,'APIキーが無効です。'],[403,{errors:[{code:5035,message:'secret upstream detail'}]},'APIを利用する権限がありません。'],[429,{errors:[{code:3036}]},'APIの利用上限に達しました。しばらく待ってやり直してください。'],[429,{errors:[{code:3040}]},'APIが混雑しています。しばらく待ってやり直してください。'],[500,{errors:[{message:'secret upstream detail'}]},'APIエラー (500)'],[404,undefined,'APIエラー (404)']];
  for(const [status,body,message] of cases) await assert.rejects(fail(status,body),error=>error.message===message);
});
test('cloudflare settings are validated before any request; the account id is URL-encoded',async()=>{
  for(const [key,id,pattern] of [['','x'.repeat(32),/APIトークン/],['t','',/Account ID/],['t','../'+'a'.repeat(29),/Account ID/],['t','a'.repeat(31),/Account ID/],['t','a'.repeat(33),/Account ID/]]) {
    let count=0;
    await assert.rejects(callJev({},key,{provider:providers.cloudflare,accountId:id,fetcher:async()=>{count++;return {ok:true,json:json({answers:{}})};}}),pattern);
    assert.equal(count,0);
  }
  assert.match(providers.cloudflare.url({accountId:'a/b?c'}),/accounts\/a%2Fb%3Fc\/ai/);
});
