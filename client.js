import {providers} from './providers.js';
export async function callJev(body,key,{signal,fetcher=fetch,provider=providers.typesafe,accountId}={}) {
  const problem=provider.settingsError({key,accountId});
  if (problem) throw new Error(problem);
  const response=await fetcher(provider.url({accountId}),{
    method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
    headers:{'Authorization':`Bearer ${key.trim()}`,'Content-Type':'application/json'},
    body:JSON.stringify({...body,model:provider.model}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    // Upstream error bodies are never shown; only known codes pick a fixed message.
    let detail=null;try{detail=await response.json?.();}catch{}
    throw new Error(provider.error(response.status,detail) || `APIエラー (${response.status})`);
  }
  return provider.unwrap(await response.json());
}
