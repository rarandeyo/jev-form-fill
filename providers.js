// Connection targets and their models. manifest.json host_permissions and connect-src are checked against `host` by tests.
// A provider lists its models; profileOf() joins a provider with one model into what core.js and client.js use.
const statusMessages={401:'APIキーが無効です。',403:'APIを利用する権限がありません。',422:'APIが要求形式を受け付けませんでした。',429:'APIの利用上限に達しました。しばらく待ってやり直してください。',529:'APIが混雑しています。しばらく待ってやり直してください。'};
// Thresholds are application policy for each model's answers, not measured accuracy.
const jevThresholds=Object.freeze({confidence:0.75,p:0.85,margin:0.2,noul:0.9});
export const malformed='APIから有効な回答が返りませんでした。';
const answersOf=result=>result && typeof result.answers==='object' && result.answers!==null && !Array.isArray(result.answers) ? result : null;
const ACCOUNT_ID=/^[A-Za-z0-9]{32}$/;
export const providers=Object.freeze({
  typesafe:Object.freeze({
    id:'typesafe',name:'TypeSafe',host:'https://api.typesafe.ai',defaultModel:'jev-latest',
    models:Object.freeze({'jev-latest':Object.freeze({id:'jev-latest',name:'Jev',model:'jev-latest',thresholds:jevThresholds})}),
    keyLabel:'keyLabel',
    settingsError:({key})=>key?.trim()?null:'TypeSafeのAPIキーを設定してください。',
    url:()=>'https://api.typesafe.ai/v1/systemone',
    error:status=>statusMessages[status],
    unwrap:json=>{const result=answersOf(json);if(!result) throw new Error(malformed);return result;}
  }),
  cloudflare:Object.freeze({
    id:'cloudflare',name:'Cloudflare Workers AI',host:'https://api.cloudflare.com',usesAccountId:true,defaultModel:'clef',
    // Thresholds are fitted per model on the tuning fixtures in docs/validation.md (dev/measure-thresholds.mjs).
    models:Object.freeze({
      clef:Object.freeze({id:'clef',name:'Clef',model:'clef',path:'@cf/cloudflare/clef',thresholds:jevThresholds}),
      'clef-flash':Object.freeze({id:'clef-flash',name:'Clef Flash',model:'clef-flash',path:'@cf/cloudflare/clef-flash',thresholds:Object.freeze({...jevThresholds,confidence:0.7})})
    }),
    keyLabel:'tokenLabel',
    settingsError:({key,accountId})=>!key?.trim()?'Cloudflare Workers AIのAPIトークンを設定してください。':ACCOUNT_ID.test(accountId?.trim()||'')?null:'Account IDは32文字の英数字で入力してください。',
    url:({accountId},model)=>`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId.trim())}/ai/run/${model.path}`,
    // https://developers.cloudflare.com/workers-ai/platform/errors/
    error:(status,json)=>{const codes=(Array.isArray(json?.errors)?json.errors:[]).map(x=>x?.code);return codes.includes(3040)?statusMessages[529]:codes.includes(3036)?'APIの1日の利用枠を使い切りました。':statusMessages[status===400?422:status];},
    // The REST API wraps answers in {result,success,errors,messages}; documented examples show them bare, so both are accepted.
    unwrap:json=>{
      if(json && typeof json==='object' && 'success' in json) {
        if(json.success!==true) throw new Error(providers.cloudflare.error(200,json)||'APIエラー (200)');
        json=json.result;
      }
      const result=answersOf(json);if(!result) throw new Error(malformed);return result;
    }
  })
});
export const DEFAULT_PROVIDER='typesafe';
export const validAccountId=id=>ACCOUNT_ID.test(id);
export const providerOf=id=>Object.hasOwn(providers,id)?providers[id]:providers[DEFAULT_PROVIDER];
export const modelOf=(provider,id)=>Object.hasOwn(provider.models,id)?provider.models[id]:provider.models[provider.defaultModel];
// A provider with one of its models chosen (the default model when the id is unknown).
export function profileOf(providerId,modelId) {
  const provider=providerOf(providerId),model=modelOf(provider,modelId);
  return Object.freeze({...provider,modelId:model.id,modelName:model.name,model:model.model,thresholds:model.thresholds,url:settings=>provider.url(settings,model)});
}
