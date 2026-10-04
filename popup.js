import {evaluate} from './core.js';
import {pageCommand} from './page.js';
import {callJev} from './client.js';
import {providers,providerOf,DEFAULT_PROVIDER} from './providers.js';
import {resolveLanguage,translator,localizeMessage} from './i18n.js';
const $=id=>document.getElementById(id);
let tabId,plan=null,rows=[],controller=null,busy=false,sourceVersion=0,provider=providers[DEFAULT_PROVIDER],usedProvider=null,savedKeys={},drafts={};
const browserLanguage=chrome.i18n?.getUILanguage?.()||navigator.language||'en';
let language=resolveLanguage(undefined,browserLanguage),t=translator(language);
const status=(text,error=false)=>{$('status').textContent=localizeMessage(text,language);$('status').classList.toggle('error',error);};
function buttons(value) {busy=value;for(const id of ['analyze','apply','undo','clipboard','save-key','forget-key','clear','api-key','remember','language','provider','account-id']) $(id).disabled=value; $('source').readOnly=value;document.querySelectorAll('#rows input').forEach(x=>{x.disabled=value;});$('cancel').hidden=!value; $('apply').disabled=value || !plan || !rows.some(x=>x.status==='ready');}
function localizeUI() {
  document.documentElement.lang=language;
  document.querySelectorAll('[data-i18n]').forEach(element=>{element.textContent=t(element.dataset.i18n,{provider:provider.name});});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element=>{element.placeholder=t(element.dataset.i18nPlaceholder,{provider:provider.name});});
  document.querySelectorAll('[data-i18n-aria]').forEach(element=>{element.setAttribute('aria-label',t(element.dataset.i18nAria));});
  $('target').textContent=localizeMessage($('target').textContent,language);
  $('status').textContent=localizeMessage($('status').textContent,language);
}
function invalidate(){sourceVersion++;plan=null;rows=[];$('apply').disabled=true;$('results').hidden=true;$('diagnostics').value='';}
for(const item of Object.values(providers)){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;$('provider').append(option);}
function showProvider() {
  $('provider').value=provider.id;$('account-field').hidden=!provider.usesAccountId;$('key-label').dataset.i18n=provider.keyLabel;
  $('api-key').value=drafts[provider.id]||'';$('remember').checked=Boolean(savedKeys[provider.id]);localizeUI();
}
const validKeys=keys=>Object.fromEntries(Object.entries(keys&&typeof keys==='object'?keys:{}).filter(([id,key])=>Object.hasOwn(providers,id)&&typeof key==='string'&&key));
async function writeKeys(keys) {
  savedKeys=validKeys(keys);
  if(Object.keys(savedKeys).length) await chrome.storage.local.set({keys:savedKeys});
  else await chrome.storage.local.remove('keys');
}
async function command(request) {
  if (!tabId) throw new Error('対象ページを開いてから、拡張機能を開き直してください。');
  const result=await chrome.scripting.executeScript({target:{tabId},func:pageCommand,args:[request],world:'ISOLATED'});
  if(!result[0]?.result) throw new Error('このページではフォームにアクセスできません。');
  return result[0].result;
}
async function run(task) {
  if(busy) return;
  buttons(true);
  try{await task();}catch(error){status(error.name==='AbortError'?'中止しました。':error.name==='TimeoutError'?'APIの応答が時間内に返りませんでした。':error.message || '処理に失敗しました。',true);}
  finally{controller=null;buttons(false);}
}
function render(selectedIds=null) {
  const parent=$('rows');parent.replaceChildren();
  for(const row of rows) {
    const element=document.createElement(row.status==='ready'?'label':'div');element.className=`row ${['ready','filled','unchanged'].includes(row.status)?'':'skip'}`;
    const name=document.createElement('div');name.className='name';
    if(row.status==='ready') {const check=document.createElement('input');check.type='checkbox';check.checked=selectedIds===null||selectedIds.has(row.id);check.dataset.fieldId=row.id;name.append(check);}
    name.append(document.createTextNode(row.field.label));element.append(name);
    const context=document.createElement('div');context.className='context';context.textContent=row.field.context;element.append(context);
    const value=document.createElement('div');value.className='value';value.textContent=['ready','filled','unchanged'].includes(row.status)?(row.field.kind==='checkbox'?t(row.value?'on':'off'):row.value===''?t('blank'):row.display):t('unchanged');element.append(value);
    const reason=document.createElement('small');reason.textContent=localizeMessage(row.reason,language);element.append(reason);parent.append(element);
  }
  const ready=rows.filter(x=>x.status==='ready').length;
  $('count').textContent=t('count',{ready,total:rows.length});$('results').hidden=false;
  $('diagnostics').value=JSON.stringify({version:chrome.runtime?.getManifest?.().version||'0.2.0',language,provider:usedProvider?.id,thresholds:usedProvider?.thresholds,source:$('source').value,rows},null,2);
}
$('language').addEventListener('change',()=>run(async()=>{
  const selectedIds=new Set([...document.querySelectorAll('#rows input:checked')].map(x=>x.dataset.fieldId));
  const preference=$('language').value;
  await chrome.storage.local.set({uiLanguage:preference});
  language=resolveLanguage(preference,browserLanguage);t=translator(language);localizeUI();
  if(rows.length)render(selectedIds);
}));
$('source').addEventListener('input',invalidate);
$('clear').addEventListener('click',()=>{$('source').value='';invalidate();status('文章を消しました。');});
$('clipboard').addEventListener('click',async()=>{
  try{$('source').value=await navigator.clipboard.readText();invalidate();status('クリップボードを読みました。まだ送信していません。');}
  catch{status('クリップボードを読めませんでした。文章欄に貼り付けてください。',true);}
});
$('cancel').addEventListener('click',()=>controller?.abort());
$('provider').addEventListener('change',()=>run(async()=>{
  drafts[provider.id]=$('api-key').value;
  provider=providerOf($('provider').value);
  await chrome.storage.local.set({provider:provider.id});
  invalidate();showProvider();
}));
async function saveKey() {
  const key=$('api-key').value.trim(),accountId=$('account-id').value.trim();
  drafts[provider.id]=key;
  const keys={...savedKeys};
  if($('remember').checked && key) {keys[provider.id]=key;if(provider.usesAccountId && accountId) await chrome.storage.local.set({accountId});}
  else delete keys[provider.id];
  await writeKeys(keys);
}
$('save-key').addEventListener('click',()=>run(async()=>{await saveKey();status($('remember').checked?'APIキーをこのブラウザに保存しました。':'キーはこの画面だけで使用します。保存済みのキーは削除しました。');}));
$('forget-key').addEventListener('click',()=>run(async()=>{const keys={...savedKeys};delete keys[provider.id];await writeKeys(keys);drafts[provider.id]='';$('api-key').value='';$('remember').checked=false;invalidate();status('APIキーを削除しました。');}));
$('analyze').addEventListener('click',()=>run(async()=>{
  invalidate();
  const key=$('api-key').value.trim(),accountId=$('account-id').value.trim(),source=$('source').value,version=sourceVersion,current=provider;
  const problem=current.settingsError({key,accountId});
  if(problem) {$('settings').open=true;throw new Error(problem);}
  // Any configured or saved credential must stay out of the text sent to whichever host is selected.
  if([key,...Object.values(drafts),...Object.values(savedKeys)].map(x=>x?.trim()).some(x=>x&&source.includes(x))) throw new Error('文章に設定済みまたは保存済みのAPIキー・トークンが含まれています。取り除いてください。');
  if(!source.trim()) throw new Error('元の文章を入力してください。');
  controller=new AbortController();
  const signal=controller.signal;
  const scan=await command({op:'scan'});
  if(!scan.fields.length) throw new Error('対応するフォーム項目が見つかりませんでした。折りたたまれた項目を開いてから、もう一度試してください。');
  const analyzed=await evaluate(source,scan.fields,body=>callJev(body,key,{signal,provider:current,accountId}),message=>status(message),{model:current.model,thresholds:current.thresholds});
  signal.throwIfAborted();
  if (version!==sourceVersion || source!==$('source').value) throw new Error('文章が変わりました。もう一度候補を作ってください。');
  rows=analyzed;usedProvider=current;
  plan=scan;render();
  status(t(scan.unsupported?'proposalsReadyUnsupported':'proposalsReady'));
}));
$('apply').addEventListener('click',()=>run(async()=>{
  if(!plan) throw new Error('もう一度候補を作ってください。');
  const ids=new Set([...document.querySelectorAll('#rows input:checked')].map(x=>x.dataset.fieldId));
  if(!ids.size) throw new Error('入力する項目を選んでください。');
  const result=await command({op:'apply',token:plan.token,rows:rows.filter(x=>x.status==='ready' && ids.has(x.id)).map(x=>({id:x.id,value:x.value}))});
  const filled=result.filter(x=>x.status==='filled').length,unchanged=result.filter(x=>x.status==='unchanged').length,failed=result.filter(x=>x.status==='failed'||x.status==='skip').length;
  for(const item of result){const row=rows.find(x=>x.id===item.id);if(row){row.status=item.status;row.reason=item.reason;}}
  plan=null;render();status(`${filled}件を入力しました。${unchanged}件はすでに同じ値でした。${failed}件は設定できませんでした。フォームを確認してください。`,failed>0);
}));
$('undo').addEventListener('click',()=>run(async()=>{
  const result=await command({op:'undo'});
  invalidate();status(`${result.filter(x=>x.status==='restored').length}件を元に戻しました。${result.filter(x=>x.status==='skip').length}件は後から編集されたため残しました。${result.filter(x=>x.status==='failed').length}件は戻せませんでした。`);
}));
async function initialize() {
  localizeUI();
  try {
    await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
    const stored=await chrome.storage.local.get(['apiKey','keys','provider','accountId','uiLanguage']);
    const keys=validKeys(stored.keys);
    if(typeof stored.apiKey==='string') {if(stored.apiKey && !keys.typesafe) keys.typesafe=stored.apiKey;await writeKeys(keys);await chrome.storage.local.remove('apiKey');}
    else savedKeys=keys;
    drafts={...savedKeys};provider=providerOf(stored.provider);$('account-id').value=typeof stored.accountId==='string'?stored.accountId:'';
    showProvider();$('settings').open=!savedKeys[provider.id];
    const preference=['en','ja'].includes(stored.uiLanguage)?stored.uiLanguage:'auto';
    $('language').value=preference;language=resolveLanguage(preference,browserLanguage);t=translator(language);localizeUI();
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab || !/^https?:\/\//.test(tab.url||'')) throw new Error('通常のWebページで開いてください。Chrome内部ページには入力できません。');
    tabId=tab.id;const url=new URL(tab.url);$('target').textContent=t('target',{host:url.hostname,path:url.pathname});
  }catch(error){status(error.message,true);$('target').textContent=t('noTarget');}
}
initialize();
