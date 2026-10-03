import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {evaluate} from '../core.js';
import {pageCommand} from '../page.js';
const {JSDOM}=createRequire(import.meta.url)(process.env.JEV_TEST_DEPS||'jsdom');
const yes=(q,choice)=>({type:'choice',choice,confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(key=>[key,key===choice?1:0]))});

test('scoped text, explicit blanks and exact quoted values reach the form while unprovided shipping fields survive',async()=>{
  const source='Middle name は空欄。Callback URL も空欄。\n請求担当者の氏名は `Toru Sagara`。Email は `billing+oct@example.test`。\n請求先の市区町村は `札幌市中央区`。配送先は全項目不明。';
  const dom=new JSDOM(`<form><section><h2>Participant</h2><label>Middle name<input name=middle value=OLD></label></section><section><h2>Billing</h2><label>Full name<input name=name></label><label>Email<input name=email type=email></label><label>City<input name=city></label></section><section><h2>Shipping</h2><label>Full name<input name=shipping value=KEEP></label><label>Email<input name=shippingemail value=keep@example.test></label></section><section><h2>Integrations</h2><label>Callback URL<input name=callback type=url value=https://old.example.test></label></section></form>`,{url:'https://example.test/form',runScripts:'outside-only'});
  dom.window.HTMLElement.prototype.getClientRects=function(){return [{width:10,height:10}];};
  const command=dom.window.eval(`(${pageCommand.toString()})`),scan=command({op:'scan'});
  const expected={'Middle name':'','Callback URL':'','Full name':'Toru Sagara',Email:'billing+oct@example.test',City:'札幌市中央区'};
  let submissions=0;dom.window.document.querySelector('form').addEventListener('submit',()=>submissions++);
  try{
    const rows=await evaluate(source,scan.fields,async body=>({answers:Object.fromEntries(Object.entries(body.questions).map(([id,q])=>{
      if(q.type==='noul')return [id,{type:'noul',noul:1}];
      const field=q.instructions.field;let choice='skip';
      if(!field.context.includes('Shipping')) {
        if(q.instructions.passage)choice=expected[field.label]===''?'clear':Object.entries(q.criteria).find(([,value])=>value===expected[field.label])[0];
        else choice=['Middle name','Callback URL'].includes(field.label)?'p0':field.label==='City'?'p2':'p1';
      }
      return [id,yes(q,choice)];
    }))}));
    assert.equal(rows.filter(x=>x.status==='ready').length,5);
    assert.equal(rows.filter(x=>x.status==='skip').length,2);
    const result=await command({op:'apply',token:scan.token,rows:rows.filter(x=>x.status==='ready').map(x=>({id:x.id,value:x.value}))});
    assert.equal(result.filter(x=>x.status==='filled').length,5);
    const actual=Object.fromEntries([...dom.window.document.querySelectorAll('input')].map(x=>[x.name,x.value]));
    assert.deepEqual(actual,{middle:'',name:'Toru Sagara',email:'billing+oct@example.test',city:'札幌市中央区',shipping:'KEEP',shippingemail:'keep@example.test',callback:''});
    assert.equal(submissions,0);
  }finally{dom.window.close();}
});
