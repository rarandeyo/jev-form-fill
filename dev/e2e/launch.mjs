// Starts headless Chrome with the unpacked extension in a throwaway profile and keeps it running until SIGTERM/SIGINT.
// Branded Chrome ignores --load-extension, so the extension is loaded through CDP Extensions.loadUnpacked over the pipe.
// The profile (which holds whatever is typed into the popup) is deleted whenever this process ends.
// The form tab sits in the background while the popup tab works; without these flags Chrome may throttle its timers to once a minute.
// Usage: node dev/e2e/launch.mjs <extension dir> [port]
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const [extension,port='9333']=process.argv.slice(2);
if(!extension) throw new Error('Usage: launch.mjs <extension dir> [port]');
const profile=mkdtempSync(path.join(tmpdir(),'jev-e2e-profile-'));
let ready=false,exitCode=null;
// Chrome keeps writing to the profile until it has exited, so the profile is removed only after the exit event.
const cleanUp=code=>{rmSync(profile,{recursive:true,force:true,maxRetries:5});process.exit(code);};
const finish=code=>{exitCode??=code;if(chrome.exitCode!==null||chrome.signalCode!==null)cleanUp(exitCode);else chrome.kill();};
const chrome=spawn(process.env.CHROME||'/opt/google/chrome/chrome',['--headless=new','--remote-debugging-pipe',`--remote-debugging-port=${port}`,'--enable-unsafe-extension-debugging',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--no-default-browser-check','--window-size=1280,900','about:blank'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
chrome.on('error',error=>{console.error(error.message);cleanUp(1);});
chrome.on('exit',()=>cleanUp(exitCode??(ready?0:1)));
process.on('SIGTERM',()=>finish(0));process.on('SIGINT',()=>finish(0));
const [,,,toChrome,fromChrome]=chrome.stdio;
let buffer='',id=0;const pending=new Map();
fromChrome.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\0'))>=0){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);pending.get(message.id)?.(message);pending.delete(message.id);}});
const send=(method,params={})=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);toChrome.write(JSON.stringify({id:i,method,params})+'\0');});
const loaded=await send('Extensions.loadUnpacked',{path:path.resolve(extension)});
if(!loaded.result?.id) {console.error(JSON.stringify(loaded));finish(1);}
else {
  ready=true;
  console.log(JSON.stringify({ready:true,port:Number(port),chromePid:chrome.pid,launcherPid:process.pid,extensionId:loaded.result.id}));
}
