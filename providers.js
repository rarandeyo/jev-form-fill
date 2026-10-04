// Connection targets. manifest.json host_permissions and connect-src are checked against `host` by tests.
import {PROFILE} from './core.js';
const statusMessages={401:'APIキーが無効です。',403:'APIを利用する権限がありません。',422:'APIが要求形式を受け付けませんでした。',429:'APIの利用上限に達しました。しばらく待ってやり直してください。',529:'APIが混雑しています。しばらく待ってやり直してください。'};
const malformed='APIから有効な回答が返りませんでした。';
const answersOf=result=>result && typeof result.answers==='object' && result.answers!==null && !Array.isArray(result.answers) ? result : null;
export const ACCOUNT_ID=/^[A-Za-z0-9]{32}$/;
export const providers=Object.freeze({
  typesafe:Object.freeze({
    id:'typesafe',name:'TypeSafe',host:'https://api.typesafe.ai',model:PROFILE.model,thresholds:PROFILE.thresholds,
    keyLabel:'keyLabel',
    settingsError:({key})=>key?.trim()?null:'TypeSafeのAPIキーを設定してください。',
    url:()=>'https://api.typesafe.ai/v1/systemone',
    error:status=>statusMessages[status],
    unwrap:json=>{const result=answersOf(json);if(!result) throw new Error(malformed);return result;}
  }),
  cloudflare:Object.freeze({
    id:'cloudflare',name:'Cloudflare Workers AI',host:'https://api.cloudflare.com',model:'clef-flash',usesAccountId:true,thresholds:Object.freeze({...PROFILE.thresholds}),
    keyLabel:'tokenLabel',
    settingsError:({key,accountId})=>!key?.trim()?'Cloudflare Workers AIのAPIトークンを設定してください。':ACCOUNT_ID.test(accountId?.trim()||'')?null:'Account IDは32文字の英数字で入力してください。',
    url:({accountId})=>`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId.trim())}/ai/run/@cf/cloudflare/clef-flash`,
    // https://developers.cloudflare.com/workers-ai/platform/errors/
    error:(status,json)=>{const codes=(Array.isArray(json?.errors)?json.errors:[]).map(x=>x?.code);return codes.includes(3040)?statusMessages[529]:codes.includes(3036)?statusMessages[429]:statusMessages[status];},
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
export const providerOf=id=>Object.hasOwn(providers,id)?providers[id]:providers[DEFAULT_PROVIDER];
