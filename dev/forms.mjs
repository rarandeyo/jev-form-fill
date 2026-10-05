// Fixtures and their expected final states. Shared by the Node measurement and the browser run.
// expected: CSS selector -> accepted final values. A radio group is addressed by `input[name=...]`.
// A field is required when its initial value is not accepted; including the initial value makes a field optional.
// limits: selector -> {ideal, reason} for fields whose value the source determines but which the extension cannot write
// (not an exact source substring it can isolate, or a value that needs width conversion or romanization). grade() also
// accepts their initial value, so leaving them unchanged is correct; expected lists only the ideal values.
// set: 'tuning' fixtures choose thresholds (docs/validation.md); 'japan' fixtures only observe behavior.
// Every fixture whose source ends in whitespace also gets a `-nonl` copy without it, because pasted text often has no
// final newline and Clef's confidences shift with it.
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
      // A prefecture that appears only inside the address is optional here and in the Japanese application fixtures.
      'input[name=name]':['山田太郎'],'input[name=kana]':['ヤマダタロウ'],'input[name=email]':['taro@example.com'],'input[name=tel]':['03-1234-5678'],'select[name=pref]':['東京都',''],
      'textarea[name=msg]':['見積もりをお願いしたいです'],'input[name=news]':[false]}},
    ...await japanFixtures()
  ];
  return list.flatMap(fixture=>fixture.source===fixture.source.trimEnd()?[fixture]:[fixture,{...fixture,name:`${fixture.name}-nonl`,source:fixture.source.trimEnd()}]);
}
const jp='examples/jp-application-form.html',en='examples/en-signup-form.html';
const limit=(ideal,reason)=>({ideal,reason});
// tokens() in core.js keeps a run of letters and digits (joined by - / ') as one token, so 渋谷区 cannot be cut out of
// 東京都渋谷区神南1-2-3, and 150-0041 or 090-1234-5678 cannot be split into separate boxes.
const unsplit='part of a longer token in the source';
const fullWidth='full-width in the source; the box asks for half-width and nothing converts width';
const romanize='an English form usually wants the romanized name; the Japanese name is accepted but not required';
const blank=names=>Object.fromEntries(names.map(name=>[`[name=${name}]`,['']]));
const splitBoxes={'[name=zip1]':['150'],'[name=zip2]':['0041'],'[name=tel1]':['090'],'[name=tel2]':['1234'],'[name=tel3]':['5678']};
const splitLimits=reason=>Object.fromEntries(Object.entries(splitBoxes).map(([selector,[ideal]])=>[selector,limit(ideal,reason)]));
const address={'[name=city]':['渋谷区'],'[name=street]':['神南1-2-3']},addressLimits={'[name=city]':limit('渋谷区',unsplit),'[name=street]':limit('神南1-2-3',unsplit)};
const birth={'[name=birth_year]':['1990'],'[name=birth_month]':['4'],'[name=birth_day]':['5']};
// Optional on the English form: the source does not say how to divide a Japanese address into its lines.
const enAddress={'[name=address1]':['','東京都渋谷区神南1-2-3'],'[name=address2]':['','みなもビル4F']};
const enLimits={'[name=first_name]':limit('太郎 / Taro',romanize),'[name=last_name]':limit('山田 / Yamada',romanize),'[name=city]':limit('渋谷区 / Shibuya-ku',unsplit),'[name=state]':limit('東京都 / Tokyo',unsplit)};
const enNames={'[name=first_name]':['太郎'],'[name=last_name]':['山田'],'[name=city]':['渋谷区'],'[name=state]':['東京都']};
async function japanFixtures() {
  const form=await text(`../${jp}`),signup=await text(`../${en}`),source=name=>text(`../examples/${name}`);
  return [
    {name:'jp-list',set:'japan',page:jp,html:form,source:await source('jp-source-list.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],'[name=sei_kana]':['ヤマダ'],'[name=mei_kana]':['タロウ'],'[name=furigana]':['やまだ たろう'],
      ...splitBoxes,'[name=pref]':['東京都',''],...address,'[name=building]':['みなもビル4F'],...birth,'input[name=gender]':['male'],'input[name=contact]':['email'],
      '[name=email]':['taro.yamada@example.jp'],'[name=company]':['株式会社みなも'],'[name=note]':['平日の日中は電話に出られません'],'[name=agree]':[true]},
      limits:{...splitLimits(unsplit),...addressLimits}},
    {name:'jp-prose',set:'japan',page:jp,html:form,source:await source('jp-source-prose.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],...blank(['sei_kana','mei_kana','furigana','company','note']),
      ...splitBoxes,'[name=pref]':['東京都',''],...address,'[name=building]':['みなもビル4F'],...birth,'input[name=gender]':['male'],'input[name=contact]':['email'],
      '[name=email]':['taro.yamada@example.jp'],'[name=agree]':[false]},
      limits:{'[name=sei]':limit('山田',unsplit),'[name=mei]':limit('太郎',unsplit),...splitLimits(unsplit),...addressLimits}},
    {name:'jp-zenkaku',set:'japan',page:jp,html:form,source:await source('jp-source-zenkaku.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],...blank(['sei_kana','mei_kana','furigana','note']),
      ...splitBoxes,'[name=pref]':['東京都',''],'[name=city]':['渋谷区'],'[name=street]':['神南１－２－３'],'[name=building]':['みなもビル４Ｆ'],
      ...birth,'input[name=gender]':['none'],'input[name=contact]':[null],'[name=email]':['taro.yamada@example.jp'],'[name=company]':['株式会社みなも'],'[name=agree]':[false]},
      limits:{...splitLimits(fullWidth),...addressLimits,'[name=street]':limit('神南１－２－３',unsplit),'[name=email]':limit('taro.yamada@example.jp',fullWidth)}},
    {name:'jp-wareki',set:'japan',page:jp,html:form,source:await source('jp-source-wareki.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],'[name=sei_kana]':['ヤマダ'],'[name=mei_kana]':['タロウ'],
      ...blank(['furigana','zip1','zip2','city','street','building','email','company','note','pref']),
      '[name=tel1]':['03'],'[name=tel2]':['1234'],'[name=tel3]':['5678'],
      // 平成2年 is 1990; the year is a closed choice, so the model has to make the conversion itself.
      ...birth,'input[name=gender]':['none'],'input[name=contact]':['phone'],'[name=agree]':[false]},
      limits:{'[name=tel1]':limit('03',unsplit),'[name=tel2]':limit('1234',unsplit),'[name=tel3]':limit('5678',unsplit)}},
    // The same facts with each value in 「」: quoted values are offered to the model as whole candidates instead of token ranges.
    {name:'jp-quoted',set:'japan',page:jp,html:form,source:await source('jp-source-quoted.txt'),expected:{
      '[name=sei]':['山田'],'[name=mei]':['太郎'],'[name=sei_kana]':['ヤマダ'],'[name=mei_kana]':['タロウ'],'[name=furigana]':['やまだ たろう'],
      ...splitBoxes,'[name=pref]':['東京都'],...address,'[name=building]':['みなもビル4F'],...birth,'input[name=gender]':['male'],'input[name=contact]':['email'],
      '[name=email]':['taro.yamada@example.jp'],'[name=company]':['株式会社みなも'],'[name=note]':['平日の日中は電話に出られません'],'[name=agree]':[true]}},
    // Romanized values written by the user, quoted, with Japanese item names.
    {name:'en-quoted',set:'japan',page:en,html:signup,source:await source('en-source-ja-quoted.txt'),expected:{
      '[name=first_name]':['Taro'],'[name=last_name]':['Yamada'],'[name=full_name]':['Taro Yamada'],'[name=email]':['taro.yamada@example.jp'],'[name=phone]':['+81-90-1234-5678'],
      '[name=company]':['Minamo Inc.'],'[name=address1]':['1-2-3 Jinnan'],'[name=address2]':['Minamo Bldg. 4F'],'[name=city]':['Shibuya-ku'],'[name=state]':['Tokyo'],
      '[name=postal]':['150-0041'],'[name=country]':['JP'],'[name=marketing]':[false]}},
    {name:'en-list',set:'japan',page:en,html:signup,source:await source('en-source-ja-list.txt'),expected:{
      ...enNames,'[name=full_name]':['山田 太郎'],'[name=email]':['taro.yamada@example.jp'],'[name=phone]':['090-1234-5678'],
      '[name=company]':['株式会社みなも'],...enAddress,'[name=postal]':['150-0041'],'[name=country]':['JP'],'[name=marketing]':[false]},
      limits:enLimits},
    {name:'en-prose',set:'japan',page:en,html:signup,source:await source('en-source-ja-prose.txt'),expected:{
      ...enNames,'[name=full_name]':['山田太郎'],'[name=email]':['taro.yamada@example.jp'],'[name=phone]':['090-1234-5678'],
      '[name=company]':['株式会社みなも'],...enAddress,'[name=postal]':['150-0041'],'[name=country]':['JP'],'[name=marketing]':[false]},
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
export function grade(expected,initial,final,limits={}) {
  const rows=Object.entries(expected).map(([selector,ideal])=>{
    const accepted=Object.hasOwn(limits,selector)?[...ideal,initial[selector]]:ideal;
    const changed=final[selector]!==initial[selector],ok=accepted.includes(final[selector]);
    return {selector,initial:initial[selector],final:final[selector],accepted,changed,ok,status:ok?(changed?'filled':'kept'):(changed?'wrong':'missed')};
  });
  const count=status=>rows.filter(x=>x.status===status).length;
  const needed=rows.filter(x=>!x.accepted.includes(x.initial));
  // done: required changes made; filled also counts optional correct changes (an accepted value other than the initial one).
  return {done:needed.filter(x=>x.ok).length,needed:needed.length,filled:count('filled'),kept:count('kept'),missed:count('missed'),wrong:count('wrong'),rows};
}
