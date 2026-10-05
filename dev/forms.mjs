// Fixtures and their expected final states. Shared by the Node measurement and the browser run.
// expected: CSS selector -> accepted final values. A radio group is addressed by `input[name=...]`.
// A field is required when its initial value is not accepted; including the initial value means leaving it is also correct.
// limits: fields whose value the source does determine (or suggest), but which the extension cannot write because the value
// is not an exact source substring it can isolate or an existing option. Leaving them unchanged is accepted, not a miss.
// set: 'tuning' fixtures choose thresholds (docs/validation.md); 'variant' is a browser-run copy of a measured variant;
// 'japan' fixtures only observe behavior.
import {readFile} from 'node:fs/promises';
const text=path=>readFile(new URL(path,import.meta.url),'utf8');
const demoSource=html=>html.match(/<pre id="source">([\s\S]*?)<\/pre>/)[1];
export async function fixtures() {
  const demo=await text('../examples/demo-form.html');
  const list=[
    {name:'demo-form',set:'tuning',page:'examples/demo-form.html',html:demo,source:demoSource(demo),expected:{
      '#name':['Mika Arai'],'#email':['mika.arai@example.test'],'#company':['Minamo Research Lab'],'#meal':['vegetarian'],'#code':['004207'],'#phone':[''],'input[name=newsletter]':[false]}},
    {name:'github-app',set:'tuning',page:'examples/github-app-form.html',html:await text('../examples/github-app-form.html'),source:await text('../examples/github-app-source.txt'),expected:{
      '#app-name':['example-maintenance-app'],'#description':['Creates maintenance pull requests for an example repository.'],'#homepage':['https://example.com/maintenance-app'],
      '#callback':[''],'#expire':[false],'#oauth':[false],'#device':[false],'#setup':[''],'#active':[false],'#webhook':[''],'#secret':[''],
      'input[name=contents]':['write'],'#pull-requests':['write'],'#metadata':['read'],'#workflows':['none'],'#members':['none'],'#email-permission':['none'],
      '#event-meta':[false],'#event-security':[false],'input[name=where]':['only'],'#unspecified':['この値はそのまま']}},
    {name:'contact-ja',set:'tuning',page:'examples/contact-form-ja.html',html:await text('../examples/contact-form-ja.html'),source:await text('../examples/contact-source-ja.txt'),expected:{
      // The prefecture is only implied by the address, so leaving it unset is also correct.
      'input[name=name]':['山田太郎'],'input[name=kana]':['ヤマダタロウ'],'input[name=email]':['taro@example.com'],'input[name=tel]':['03-1234-5678'],'select[name=pref]':['東京都',''],
      'textarea[name=msg]':['見積もりをお願いしたいです'],'input[name=news]':[false]}},
  ];
  // The one case the Clef confidence of 0.70 changes: without the final newline the email's range end scores 0.7411.
  // The measurement makes this variant itself; it is listed here so the browser run can use it too.
  const contact=list.find(x=>x.name==='contact-ja');
  return [...list,{...contact,name:'contact-ja-nonl',set:'variant',source:contact.source.trimEnd()},...await japanFixtures()];
}
const jp='examples/jp-application-form.html',en='examples/en-signup-form.html';
const limit=(ideal,reason)=>({ideal,reason});
// Japanese text runs without spaces form a single token, so a part such as a ward or a house number cannot be cut out of
// 東京都渋谷区神南1-2-3, and 150-0041 or 090-1234-5678 cannot be split into the separate boxes.
const unsplit='part of a longer token in the source';
async function japanFixtures() {
  const form=await text(`../${jp}`),signup=await text(`../${en}`),source=name=>text(`../examples/${name}`);
  const blank=names=>Object.fromEntries(names.map(name=>[name.includes('[')?name:`[name=${name}]`,['']]));
  const zipTel=(zip,tel)=>({
    '[name=zip1]':['',...zip.slice(0,1)],'[name=zip2]':['',...zip.slice(1)],'[name=tel1]':['',tel[0]],'[name=tel2]':['',tel[1]],'[name=tel3]':['',tel[2]]});
  const zipTelLimits=(zip,tel)=>({...(zip.length?{'[name=zip1]':limit(zip[0],unsplit),'[name=zip2]':limit(zip[1],unsplit)}:{}),
    '[name=tel1]':limit(tel[0],unsplit),'[name=tel2]':limit(tel[1],unsplit),'[name=tel3]':limit(tel[2],unsplit)});
  const enLimits={'[name=city]':limit('渋谷区 (Shibuya)',unsplit),'[name=state]':limit('東京都 (Tokyo)',unsplit),'[name=first_name]':limit('太郎 / Taro','no romanization; given name only when it can be isolated'),'[name=last_name]':limit('山田 / Yamada','no romanization; family name only when it can be isolated'),
    '[name=address1]':limit('street address','not uniquely determined for an English address form'),'[name=address2]':limit('みなもビル4F','not uniquely determined for an English address form')};
  const enAddress={'[name=address1]':['','東京都渋谷区神南1-2-3','東京都渋谷区神南1-2-3 みなもビル4F','〒150-0041 東京都渋谷区神南1-2-3 みなもビル4F','150-0041 東京都渋谷区神南1-2-3 みなもビル4F'],'[name=address2]':['','みなもビル4F'],'[name=city]':['','渋谷区'],'[name=state]':['','東京都']};
  return [
    {name:'jp-list',set:'japan',page:jp,html:form,source:await source('jp-source-list.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],'[name=sei_kana]':['ヤマダ'],'[name=mei_kana]':['タロウ'],'[name=furigana]':['やまだ たろう'],
      ...zipTel(['150','0041'],['090','1234','5678']),'[name=pref]':['東京都'],'[name=city]':['','渋谷区'],'[name=street]':['','神南1-2-3'],'[name=building]':['みなもビル4F'],
      '[name=birth_year]':['1990'],'[name=birth_month]':['4'],'[name=birth_day]':['5'],'input[name=gender]':['male'],'input[name=contact]':['email'],
      '[name=email]':['taro.yamada@example.jp'],'[name=company]':['株式会社みなも'],'[name=note]':['平日の日中は電話に出られません'],'[name=agree]':[true]},
      limits:{...zipTelLimits(['150','0041'],['090','1234','5678']),'[name=city]':limit('渋谷区',unsplit),'[name=street]':limit('神南1-2-3',unsplit)}},
    {name:'jp-prose',set:'japan',page:jp,html:form,source:await source('jp-source-prose.txt'),expected:{
      '[name=sei]':['','山田'],'[name=mei]':['','太郎'],...blank(['sei_kana','mei_kana','furigana','company','note']),
      ...zipTel(['150','0041'],['090','1234','5678']),'[name=pref]':['東京都'],'[name=city]':['','渋谷区'],'[name=street]':['','神南1-2-3'],'[name=building]':['みなもビル4F'],
      '[name=birth_year]':['1990'],'[name=birth_month]':['4'],'[name=birth_day]':['5'],'input[name=gender]':['male'],'input[name=contact]':['email'],
      '[name=email]':['taro.yamada@example.jp'],'[name=agree]':[false]},
      limits:{'[name=sei]':limit('山田',unsplit),'[name=mei]':limit('太郎',unsplit),...zipTelLimits(['150','0041'],['090','1234','5678']),'[name=city]':limit('渋谷区',unsplit),'[name=street]':limit('神南1-2-3',unsplit)}},
    {name:'jp-zenkaku',set:'japan',page:jp,html:form,source:await source('jp-source-zenkaku.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],...blank(['sei_kana','mei_kana','furigana','note']),
      ...zipTel(['150','0041'],['090','1234','5678']),'[name=pref]':['東京都'],'[name=city]':['','渋谷区'],'[name=street]':['','神南１－２－３','神南1-2-3'],'[name=building]':['みなもビル４Ｆ','みなもビル4F'],
      '[name=birth_year]':['1990'],'[name=birth_month]':['4'],'[name=birth_day]':['5'],'input[name=gender]':['none'],'input[name=contact]':[null],
      '[name=email]':['','taro.yamada@example.jp'],'[name=company]':['株式会社みなも'],'[name=agree]':[false]},
      limits:{'[name=zip1]':limit('150','full-width digits in the source; the box asks for half-width'),'[name=zip2]':limit('0041','full-width digits in the source; the box asks for half-width'),
        '[name=tel1]':limit('090','full-width digits in one token'),'[name=tel2]':limit('1234','full-width digits in one token'),'[name=tel3]':limit('5678','full-width digits in one token'),
        '[name=city]':limit('渋谷区',unsplit),'[name=street]':limit('神南1-2-3',unsplit),'[name=email]':limit('taro.yamada@example.jp','full-width in the source; no width conversion')}},
    {name:'jp-wareki',set:'japan',page:jp,html:form,source:await source('jp-source-wareki.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],'[name=sei_kana]':['ヤマダ'],'[name=mei_kana]':['タロウ'],
      ...blank(['furigana','zip1','zip2','city','street','building','email','company','note']),'[name=pref]':[''],
      '[name=tel1]':['','03'],'[name=tel2]':['','1234'],'[name=tel3]':['','5678'],
      // 平成2年 is 1990; the year is a closed choice, so the model has to make the conversion itself.
      '[name=birth_year]':['1990'],'[name=birth_month]':['4'],'[name=birth_day]':['5'],'input[name=gender]':['none'],'input[name=contact]':['phone'],'[name=agree]':[false]},
      limits:{'[name=tel1]':limit('03',unsplit),'[name=tel2]':limit('1234',unsplit),'[name=tel3]':limit('5678',unsplit)}},
    // The same facts with each value in 「」: quoted values are offered to the model as whole candidates instead of token ranges.
    {name:'jp-quoted',set:'japan',page:jp,html:form,source:await source('jp-source-quoted.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],'[name=sei_kana]':['ヤマダ'],'[name=mei_kana]':['タロウ'],'[name=furigana]':['やまだ たろう'],
      '[name=zip1]':['150'],'[name=zip2]':['0041'],'[name=tel1]':['090'],'[name=tel2]':['1234'],'[name=tel3]':['5678'],
      '[name=pref]':['東京都'],'[name=city]':['渋谷区'],'[name=street]':['神南1-2-3'],'[name=building]':['みなもビル4F'],
      '[name=birth_year]':['1990'],'[name=birth_month]':['4'],'[name=birth_day]':['5'],'input[name=gender]':['male'],'input[name=contact]':['email'],
      '[name=email]':['taro.yamada@example.jp'],'[name=company]':['株式会社みなも'],'[name=note]':['平日の日中は電話に出られません'],'[name=agree]':[true]}},
    // Romanized values written by the user, quoted, with Japanese item names.
    {name:'en-quoted',set:'japan',page:en,html:signup,source:await source('en-source-ja-quoted.txt'),expected:{
      '[name=first_name]':['Taro'],'[name=last_name]':['Yamada'],'[name=full_name]':['Taro Yamada'],'[name=email]':['taro.yamada@example.jp'],'[name=phone]':['+81-90-1234-5678'],
      '[name=company]':['Minamo Inc.'],'[name=address1]':['1-2-3 Jinnan'],'[name=address2]':['Minamo Bldg. 4F'],'[name=city]':['Shibuya-ku'],'[name=state]':['Tokyo'],
      '[name=postal]':['150-0041'],'[name=country]':['JP'],'[name=marketing]':[false]}},
    {name:'en-list',set:'japan',page:en,html:signup,source:await source('en-source-ja-list.txt'),expected:{
      '[name=first_name]':['','太郎'],'[name=last_name]':['','山田'],'[name=full_name]':['山田 太郎'],'[name=email]':['taro.yamada@example.jp'],'[name=phone]':['090-1234-5678'],
      '[name=company]':['株式会社みなも'],...enAddress,'[name=postal]':['150-0041'],'[name=country]':['JP'],'[name=marketing]':[false]},
      limits:enLimits},
    {name:'en-prose',set:'japan',page:en,html:signup,source:await source('en-source-ja-prose.txt'),expected:{
      '[name=first_name]':['','太郎'],'[name=last_name]':['','山田'],'[name=full_name]':['','山田太郎'],'[name=email]':['taro.yamada@example.jp'],'[name=phone]':['090-1234-5678'],
      '[name=company]':['','株式会社みなも'],...enAddress,'[name=postal]':['150-0041'],'[name=country]':['JP'],'[name=marketing]':[false]},
      limits:{...enLimits,'[name=full_name]':limit('山田太郎',unsplit),'[name=company]':limit('株式会社みなも',unsplit)}}
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
