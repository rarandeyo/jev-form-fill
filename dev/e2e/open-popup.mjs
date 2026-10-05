// Opens popup.html in a tab whose chrome.tabs.query({active,currentWindow}) answers with the fixture tab,
// then fills the connection settings and the fixture's source text over CDP.
// Test-only: in a tab, the popup would otherwise target itself. Production code is unchanged.
// Credentials come from CF_ACCOUNT_ID / CF_API_TOKEN and travel only inside the CDP connection, never in argv.
// Usage: node dev/e2e/open-popup.mjs <port> <extension id> <fixture name> <fixture URL>
import {load} from './fixture.mjs';
const [port,extensionId,name,targetUrl]=process.argv.slice(2);
const {CF_ACCOUNT_ID:accountId,CF_API_TOKEN:token}=process.env;
if(!accountId||!token) throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN.');
const {source}=await load(name);
const {webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws=new WebSocket(webSocketDebuggerUrl);await new Promise(resolve=>{ws.onopen=resolve;});
let id=0;const pending=new Map();
ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}};
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,m=>m.error?reject(new Error(`${method}: ${m.error.message}`)):resolve(m.result));ws.send(JSON.stringify({id:i,method,params,sessionId}));});
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
const evaluate=async expression=>{const {result,exceptionDetails}=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(exceptionDetails) throw new Error(exceptionDetails.exception?.description||exceptionDetails.text);return result.value;};
await send('Page.enable',{},sessionId);
const override=`(()=>{if(!globalThis.chrome?.tabs?.query)return;const query=chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query=async info=>info&&info.active&&info.currentWindow?(await query({})).filter(tab=>tab.url===${JSON.stringify(targetUrl)}).slice(-1):query(info);})();`;
await send('Page.addScriptToEvaluateOnNewDocument',{source:override},sessionId);
await send('Page.navigate',{url:`chrome-extension://${extensionId}/popup.html`},sessionId);
const wait=async (expression,what)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`Timed out: ${what}`);};
await wait("/127\\.0\\.0\\.1/.test(document.getElementById('target')?.textContent||'')",'the override did not take effect (popup target is not the fixture page)');
await evaluate(`(()=>{const $=id=>document.getElementById(id);$('provider').value='cloudflare';$('provider').dispatchEvent(new Event('change'));})()`);
await wait("!document.getElementById('provider').disabled&&!document.getElementById('account-field').hidden",'provider switch');
// The source is set byte for byte, including any trailing newline.
await evaluate(`(()=>{const $=id=>document.getElementById(id);const set=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('input'));};
  set('account-id',${JSON.stringify(accountId)});set('api-key',${JSON.stringify(token)});set('source',${JSON.stringify(source)});})()`);
console.log(targetId);
ws.close();
