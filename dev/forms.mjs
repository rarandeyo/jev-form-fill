// Tuning fixtures and their expected final states. Shared by the Node measurement and the browser run.
// Each entry: CSS selector -> accepted final values. A radio group is addressed by `input[name=...]`.
import {readFile} from 'node:fs/promises';
const text=path=>readFile(new URL(path,import.meta.url),'utf8');
const demoSource=html=>html.match(/<pre id="source">([\s\S]*?)<\/pre>/)[1];
export async function fixtures() {
  const demo=await text('../examples/demo-form.html');
  return [
    {name:'demo-form',page:'examples/demo-form.html',html:demo,source:demoSource(demo),expected:{
      '#name':['Mika Arai'],'#email':['mika.arai@example.test'],'#company':['Minamo Research Lab'],'#meal':['vegetarian'],'#code':['004207'],'#phone':[''],'input[name=newsletter]':[false]}},
    {name:'github-app',page:'examples/github-app-form.html',html:await text('../examples/github-app-form.html'),source:await text('../examples/github-app-source.txt'),expected:{
      '#app-name':['example-maintenance-app'],'#description':['Creates maintenance pull requests for an example repository.'],'#homepage':['https://example.com/maintenance-app'],
      '#callback':[''],'#expire':[false],'#oauth':[false],'#device':[false],'#setup':[''],'#active':[false],'#webhook':[''],'#secret':[''],
      'input[name=contents]':['write'],'#pull-requests':['write'],'#metadata':['read'],'#workflows':['none'],'#members':['none'],'#email-permission':['none'],
      '#event-meta':[false],'#event-security':[false],'input[name=where]':['only'],'#unspecified':['この値はそのまま']}},
    {name:'contact-ja',page:'examples/contact-form-ja.html',html:await text('../examples/contact-form-ja.html'),source:await text('../examples/contact-source-ja.txt'),expected:{
      // The prefecture is only implied by the address, so leaving it unset is also correct.
      'input[name=name]':['山田太郎'],'input[name=kana]':['ヤマダタロウ'],'input[name=email]':['taro@example.com'],'input[name=tel]':['03-1234-5678'],'select[name=pref]':['東京都',''],
      'textarea[name=msg]':['見積もりをお願いしたいです'],'input[name=news]':[false]}}
  ];
}
// Self-contained so it can also run inside a browser page via toString().
export function readState(selectors) {
  const out={};
  for (const selector of selectors) {
    const elements=[...document.querySelectorAll(selector)];
    const first=elements[0];
    out[selector]=!first?null:first.type==='radio'?(elements.find(x=>x.checked)?.value??null):first.type==='checkbox'?first.checked:first.value;
  }
  return out;
}
export function grade(expected,initial,final) {
  const rows=Object.entries(expected).map(([selector,accepted])=>{
    const changed=final[selector]!==initial[selector],ok=accepted.includes(final[selector]);
    return {selector,initial:initial[selector],final:final[selector],accepted,changed,ok,status:ok?(changed?'filled':'kept'):(changed?'wrong':'missed')};
  });
  const count=status=>rows.filter(x=>x.status===status).length;
  const needed=rows.filter(x=>!x.accepted.includes(x.initial));
  // done: required changes made; filled also counts optional correct changes (an accepted value other than the initial one).
  return {done:needed.filter(x=>x.ok).length,needed:needed.length,filled:count('filled'),kept:count('kept'),missed:count('missed'),wrong:count('wrong'),rows};
}
