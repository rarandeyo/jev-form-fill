// Opens popup.html in a tab whose chrome.tabs.query({active,currentWindow}) answers with the fixture tab.
// Test-only: in a tab, the popup would otherwise target itself. Production code is unchanged.
// Usage: node dev/e2e/open-popup.mjs <port> <extension id> <fixture URL prefix>
const [port,extensionId,targetPrefix]=process.argv.slice(2);
const {webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws=new WebSocket(webSocketDebuggerUrl);await new Promise(resolve=>{ws.onopen=resolve;});
let id=0;const pending=new Map();
ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}};
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,m=>m.error?reject(new Error(`${method}: ${m.error.message}`)):resolve(m.result));ws.send(JSON.stringify({id:i,method,params,sessionId}));});
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
await send('Page.enable',{},sessionId);
const override=`(()=>{if(!globalThis.chrome?.tabs?.query)return;const query=chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query=async info=>info&&info.active&&info.currentWindow?(await query({})).filter(tab=>(tab.url||'').startsWith(${JSON.stringify(targetPrefix)})).slice(-1):query(info);})();`;
await send('Page.addScriptToEvaluateOnNewDocument',{source:override},sessionId);
await send('Page.navigate',{url:`chrome-extension://${extensionId}/popup.html`},sessionId);
let target='';
for(let i=0;i<50&&!/127\.0\.0\.1/.test(target);i++){await new Promise(resolve=>setTimeout(resolve,100));target=(await send('Runtime.evaluate',{expression:"document.getElementById('target')?.textContent||''",returnByValue:true},sessionId)).result.value;}
console.log(JSON.stringify({targetId,popupTarget:target,overrideWorks:/127\.0\.0\.1/.test(target)}));
ws.close();
process.exit(/127\.0\.0\.1/.test(target)?0:2);
