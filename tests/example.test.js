import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {evaluate,passages} from '../core.js';
import {pageCommand} from '../page.js';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.JEV_TEST_DEPS || 'jsdom');
const source=await readFile(new URL('../examples/github-app-source.txt',import.meta.url),'utf8');
const html=await readFile(new URL('../examples/github-app-form.html',import.meta.url),'utf8');
const values={'GitHub App name':'example-maintenance-app',Description:"Creates maintenance pull requests for an example repository.",'Homepage URL':'https://example.com/maintenance-app'};
const answer=(q,choice)=>({type:'choice',choice,confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===choice?1:0]))});
test('the supplied GitHub example survives all planner stages and form application with mocked Jev choices',async()=>{
  const dom=new JSDOM(html,{url:'https://example.com/form',runScripts:'outside-only'});
  dom.window.HTMLElement.prototype.getClientRects=function(){return [{width:10,height:10}];};
  const command=dom.window.eval(`(${pageCommand.toString()})`);
  const scan=command({op:'scan'});
  const rows=await evaluate(source,scan.fields,async body=>{
    const answers={};
    for(const [id,q] of Object.entries(body.questions)) {
      if(q.type==='noul'){answers[id]={type:'noul',noul:1};continue;}
      const field=q.instructions.field;
      let choice='skip';
      if(q.instructions.passage) {
        if(['Callback URL','Setup URL'].includes(field.label))choice='clear';
        else choice=Object.entries(q.criteria).find(([,value])=>value===values[field.label])?.[0]||'extract';
      } else if(values[field.label]) choice=passages(source).find(p=>p.text.includes(`**${field.label}**`)).id;
      else if(['Callback URL','Setup URL'].includes(field.label)) choice=passages(source).find(p=>p.text.includes(field.label)).id;
      else if(field.kind==='checkbox') choice='off';
      else if(field.kind==='radio' && field.context.includes('Contents')) choice='o2';
      else if(field.label==='Pull requests') choice='o2';
      else if(['Workflows','Members','Email addresses'].includes(field.label) || field.label.includes('Where can')) choice='o0';
      answers[id]=answer(q,choice);
    }
    return {answers};
  });
  assert.equal(rows.find(x=>x.field.label==='元文章にない項目').status,'skip');
  const result=await command({op:'apply',token:scan.token,rows:rows.filter(x=>x.status==='ready').map(x=>({id:x.id,value:x.value}))});
  assert.equal(result.filter(x=>x.status==='failed'||x.status==='skip').length,0);
  const doc=dom.window.document;
  assert.equal(doc.querySelector('#app-name').value,values['GitHub App name']);
  assert.equal(doc.querySelector('#description').value,values.Description);
  assert.equal(doc.querySelector('#homepage').value,values['Homepage URL']);
  assert.equal(doc.querySelector('#expire').checked,false);
  assert.equal(doc.querySelector('#active').checked,false);
  assert.equal(doc.querySelector('input[name=contents]:checked').value,'write');
  assert.equal(doc.querySelector('#pull-requests').value,'write');
  assert.equal(doc.querySelector('#workflows').value,'none');
  assert.equal(doc.querySelector('#metadata').value,'read');
  assert.equal(doc.querySelector('#unspecified').value,'この値はそのまま');
});
