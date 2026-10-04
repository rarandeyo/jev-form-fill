import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveLanguage,translator,localizeMessage} from '../i18n.js';

test('explicit language overrides browser language; unsupported languages fall back to English',()=>{
  assert.equal(resolveLanguage('en','ja-JP'),'en');
  assert.equal(resolveLanguage('ja','en-US'),'ja');
  assert.equal(resolveLanguage('auto','ja-JP'),'ja');
  assert.equal(resolveLanguage(undefined,'de-DE'),'en');
});

test('runtime reasons and progress localize in both directions without translating source values',()=>{
  assert.equal(localizeMessage('ページが値を受け付けませんでした。','en'),'The page did not accept the value.');
  assert.equal(localizeMessage('入力後にページが値を変更しました。','en'),'The page changed the value after filling.');
  assert.equal(localizeMessage('1〜8 / 44 項目を読み取っています…','en'),'Reading fields 1–8 of 44…');
  assert.equal(localizeMessage('Reading fields 1–8 of 44…','ja'),'1〜8 / 44 項目を読み取っています…');
  assert.equal(localizeMessage('APIエラー (500)','en'),'API error (500)');
  assert.equal(localizeMessage('APIの1日の利用枠を使い切りました。','en'),"The API's daily allowance is used up.");
  assert.equal(localizeMessage('Cloudflare Workers AIへ送って候補を作る','en'),'Create proposals with Cloudflare Workers AI');
  assert.equal(localizeMessage('新井 美香','en'),'新井 美香');
  assert.equal(translator('en')('applySummary',{filled:3,unchanged:1,failed:2}),'Filled 3. Already matching: 1. Could not set: 2. Check the form.');
});
