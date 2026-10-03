export async function callJev(body,key,{signal,fetcher=fetch}={}) {
  if (!key?.trim()) throw new Error('TypeSafeのAPIキーを設定してください。');
  const response=await fetcher('https://api.typesafe.ai/v1/systemone',{
    method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
    headers:{'Authorization':`Bearer ${key.trim()}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    const messages={401:'APIキーが無効です。',403:'APIを利用する権限がありません。',422:'APIが要求形式を受け付けませんでした。',429:'APIの利用上限に達しました。しばらく待ってやり直してください。',529:'APIが混雑しています。しばらく待ってやり直してください。'};
    throw new Error(messages[response.status] || `APIエラー (${response.status})`);
  }
  const result=await response.json();
  if (!result || typeof result.answers!=='object' || result.answers===null || Array.isArray(result.answers)) throw new Error('APIから有効な回答が返りませんでした。');
  return result;
}
