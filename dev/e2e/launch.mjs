// Starts headless Chrome with the unpacked extension and keeps it running until SIGTERM.
// Branded Chrome ignores --load-extension, so the extension is loaded through CDP Extensions.loadUnpacked over the pipe.
// Usage: node dev/e2e/launch.mjs <extension dir> <profile dir> [port]
import {spawn} from 'node:child_process';
const [extension,profile,port='9333']=process.argv.slice(2);
if(!extension||!profile) throw new Error('Usage: launch.mjs <extension dir> <profile dir> [port]');
const chrome=spawn(process.env.CHROME||'/opt/google/chrome/chrome',['--headless=new','--remote-debugging-pipe',`--remote-debugging-port=${port}`,'--enable-unsafe-extension-debugging',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--window-size=1280,900','about:blank'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
const [,,,toChrome,fromChrome]=chrome.stdio;
let buffer='',id=0;const pending=new Map();
fromChrome.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\0'))>=0){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);pending.get(message.id)?.(message);pending.delete(message.id);}});
const send=(method,params={})=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);toChrome.write(JSON.stringify({id:i,method,params})+'\0');});
const loaded=await send('Extensions.loadUnpacked',{path:extension});
if(!loaded.result?.id) {console.error(JSON.stringify(loaded));chrome.kill();process.exit(1);}
console.log(JSON.stringify({ready:true,port:Number(port),chromePid:chrome.pid,launcherPid:process.pid,extensionId:loaded.result.id}));
const stop=()=>{chrome.kill();process.exit(0);};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
chrome.on('exit',()=>process.exit(0));
