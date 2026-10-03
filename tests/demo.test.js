import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile(new URL('../examples/demo-form.html',import.meta.url),'utf8');
const script=await readFile(new URL('../examples/demo-form.js',import.meta.url),'utf8');
function demo(writeText) {
  const dom=new JSDOM(html,{url:'http://127.0.0.1/demo-form.html',runScripts:'outside-only'});
  Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText}});
  dom.window.eval(script);
  return dom.window;
}
test('screenshot demo copies only fictional source and prevents registration submission',async()=>{
  let copied;
  const win=demo(async text=>{copied=text;});
  win.document.getElementById('copy').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(copied,win.document.getElementById('source').textContent);
  assert.match(copied,/`004207`/);
  assert.match(copied,/telephone number is unknown/);
  assert.equal(win.document.getElementById('copy').textContent,'Copied');
  const event=new win.Event('submit',{cancelable:true});
  assert.equal(win.document.querySelector('form').dispatchEvent(event),false);
  assert.equal(win.document.getElementById('submitted').hidden,false);
  win.close();
});
test('screenshot demo reports clipboard failure without an unhandled rejection',async()=>{
  const win=demo(async()=>{throw new Error('permission denied');});
  win.document.getElementById('copy').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(win.document.getElementById('copy').textContent,'Copy failed — select the text above');
  win.close();
});
