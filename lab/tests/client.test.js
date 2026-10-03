import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {grade} from '../grader.js';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

test('submission observes a delayed page rejection before grading',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const script=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'http://127.0.0.1:12345/',runScripts:'outside-only'});
  const {window}=dom;
  window.HTMLElement.prototype.scrollIntoView=()=>{};
  let receipt;
  const received=new Promise(resolve=>{window.fetch=async(url,options)=>{
    if(url==='/source.txt')return {ok:true,text:async()=> 'Test source'};
    receipt=JSON.parse(options.body);resolve();
    return {ok:true,json:async()=>({id:'test',receivedAt:new Date().toISOString(),grade:grade(receipt.fields)})};
  };});
  try{
    window.eval(script);
    const alias=window.document.querySelector('[name=s13]');
    alias.value='REQUESTED-DELAYED';
    alias.dispatchEvent(new window.Event('input',{bubbles:true}));
    window.document.getElementById('test-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    await received;
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(receipt.fields.s13,'DELAYED-BY-SITE');
    assert.equal(grade(receipt.fields).rows.find(row=>row.name==='s13').ok,false);
    assert.equal(alias.value,receipt.fields.s13);
  }finally{window.close();}
});
