const $=id=>document.getElementById(id);
const events=[];
const runId=crypto.randomUUID();
document.addEventListener('input',recordEvent);document.addEventListener('change',recordEvent);
function recordEvent(event){if(event.target.name&&events.length<300)events.push({field:event.target.name,type:event.type,time:Math.round(performance.now())});}
fetch('/source.txt').then(r=>{if(!r.ok)throw new Error('source');return r.text();}).then(text=>{$('source').textContent=text;}).catch(()=>{$('source').textContent='文章を読み込めませんでした。再読み込みしてください。';});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('source').textContent);$('copy-status').textContent='コピーしました。拡張機能で「クリップボードから読む」を押してください。';}catch{$('source').closest('details').open=true;$('copy-status').textContent='コピーできませんでした。元情報を開いたので手動でコピーしてください。';}});
$('reset').addEventListener('click',()=>location.reload());
document.querySelector('[name=a17]').addEventListener('change',event=>{
  if(event.target.value==='M2'&&!document.querySelector('[name=s11]')){
    const label=document.createElement('label');label.textContent='Dietary details';const input=document.createElement('input');input.name='s11';label.append(input);$('dietary-slot').append(label);
  }
});
const managed=document.querySelector('[name=s12]');managed.addEventListener('input',()=>{managed.value='MANAGED-BY-SITE';});
const delayed=document.querySelector('[name=s13]');let delayedTimer;
delayed.addEventListener('input',()=>{clearTimeout(delayedTimer);delayedTimer=setTimeout(()=>{delayed.value='DELAYED-BY-SITE';delayedTimer=undefined;},600);});
async function waitForDelayedRestore(){while(delayedTimer!==undefined)await new Promise(resolve=>setTimeout(resolve,50));}
$('custom-theme').addEventListener('click',()=>{const open=$('theme-menu').hidden;$('theme-menu').hidden=!open;$('custom-theme').setAttribute('aria-expanded',String(open));});
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{$('custom-theme').textContent=button.dataset.theme;$('theme-menu').hidden=true;$('custom-theme').setAttribute('aria-expanded','false');}));
const shadow=$('shadow-host').attachShadow({mode:'open'});
const shadowLabel=document.createElement('label');shadowLabel.textContent='Shadow nickname';const shadowInput=document.createElement('input');shadowInput.name='s18';shadowInput.value='SHADOW-KEEP';shadowInput.style.cssText='display:block;padding:10px;border:1px solid #bdcdd5;border-radius:7px;margin:7px 0;width:100%;font:inherit';shadowLabel.append(shadowInput);shadow.append(shadowLabel);
function snapshot(){
  const fields={};
  for(const form of document.querySelectorAll('form[data-test-form]')) for(const input of form.querySelectorAll('input[name],select[name],textarea[name]')){
    if(input.type==='radio'){if(!Object.hasOwn(fields,input.name))fields[input.name]=null;if(input.checked)fields[input.name]=input.value;}
    else if(input.type==='checkbox')fields[input.name]=input.checked;
    else if(input.multiple)fields[input.name]=Array.from(input.selectedOptions).map(option=>option.value);
    else fields[input.name]=input.value;
  }
  fields.s14=$('custom-theme').textContent;
  fields.s18=shadowInput.value;
  const frame=document.querySelector('iframe').contentDocument;
  fields.s17=frame?.querySelector('[name=s17]')?.value ?? null;
  return fields;
}
function textCell(row,value,className=''){const cell=document.createElement('td');cell.textContent=typeof value==='string'?value:JSON.stringify(value);if(className)cell.className=className;row.append(cell);}
function renderResult(result){
  const section=$('result');section.replaceChildren();section.hidden=false;
  const title=document.createElement('h2');title.textContent='受信・採点しました';section.append(title);
  const receipt=document.createElement('p');receipt.className='note';receipt.textContent=`受信ID: ${result.id} · ${new Date(result.receivedAt).toLocaleString('ja-JP')}`;section.append(receipt);
  const scores=document.createElement('div');scores.className='scores';
  for(const [key,label] of [['baseline','通常入力'],['protection','変更しない項目の保護'],['stress','追加の負荷試験']]){const box=document.createElement('div');box.className='score';const strong=document.createElement('strong');strong.textContent=`${result.grade[key].passed} / ${result.grade[key].total}`;const span=document.createElement('span');span.textContent=label;box.append(strong,span);scores.append(box);}section.append(scores);
  const note=document.createElement('p');note.className='note';note.textContent='負荷試験には未対応UIも含みます。フォームの値を採点しており、拡張が出した警告の正しさや、誰が値を入力したかまでは判定しません。';section.append(note);
  const table=document.createElement('table');const head=document.createElement('tr');for(const title of ['判定','項目','期待値','受信値']){const th=document.createElement('th');th.textContent=title;head.append(th);}table.append(head);
  for(const item of result.grade.rows){const row=document.createElement('tr');textCell(row,item.ok?'✓ 一致':'× 不一致',item.ok?'ok':'bad');textCell(row,item.label);textCell(row,item.value,'value');textCell(row,item.present?item.actual:'（項目なし）','value');table.append(row);}section.append(table);
  section.scrollIntoView({behavior:'smooth',block:'start'});
}
$('test-form').addEventListener('submit',async event=>{
  event.preventDefault();$('submit').disabled=true;$('submit').textContent='入力値の保持を確認しています…';
  try{
    await waitForDelayedRestore();$('submit').textContent='受信を確認しています…';
    const fields=snapshot();const submitted=Array.from(new FormData($('test-form')).entries()).map(([name,value])=>[name,typeof value==='string'?value:'[file omitted]']);
    const response=await fetch('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,fields,submitted,events})});
    if(!response.ok)throw new Error(`受信エラー ${response.status}`);
    renderResult(await response.json());
  }catch(error){$('result').hidden=false;$('result').textContent=`送信に失敗しました: ${error.message}`;}
  finally{$('submit').disabled=false;$('submit').textContent='結果を送信して採点';}
});
