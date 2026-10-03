// Self-contained because chrome.scripting serializes the function into an isolated world.
export function pageCommand(request) {
  const key='__jevFormFillPrivateV1';
  const clean=text=>String(text||'').replace(/\s+/g,' ').trim().slice(0,600);
  const doc=document;
  function openedForScan() {
    const opened=[];
    for (const d of doc.querySelectorAll('form details')) {
      if (!d.open && d.querySelector('input:not([type=hidden]),select,textarea')) {d.open=true;opened.push(d);}
    }
    return opened;
  }
  function visible(element) {
    if (!element?.isConnected) return false;
    // A custom menu may hide only its backing native radio; require a visible labelled menu item.
    const styled=element.matches('input[type=radio],input[type=checkbox]') && element.labels?.[0];
    const anchor=styled || element;
    if (anchor.closest('[hidden],[inert],[aria-hidden=true]')) return false;
    for (let parent=anchor;parent;parent=parent.parentElement) {
      const css=getComputedStyle(parent);
      if (css.display==='none' || css.visibility==='hidden' || css.visibility==='collapse') return false;
    }
    // Styled checkbox/radio inputs may be visually hidden, while their label is visible.
    return anchor.getClientRects().length>0;
  }
  function label(element) {
    const labels=Array.from(element.labels||[]).map(x=>{const clone=x.cloneNode(true);clone.querySelectorAll('input,textarea,select').forEach(n=>n.remove());return clean(clone.textContent);}).filter(Boolean);
    const aria=element.getAttribute('aria-label');
    const labelled=(element.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>doc.getElementById(id)?.textContent).filter(Boolean).join(' ');
    return clean(labels.join(' / ') || aria || labelled || element.placeholder || element.name || element.id);
  }
  function context(element) {
    const form=element.form || element.closest('form') || doc.body;
    const scopes=[];
    for(let parent=element.parentElement;parent&&parent!==form;parent=parent.parentElement)if(parent.matches('section,article'))scopes.unshift(parent);
    scopes.unshift(form);
    const headings=[];
    for(const scope of scopes) {
      const outline=[];
      for(const heading of scope.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        if(!(heading.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
        // Keep ancestor headings, never preceding headings inside sibling sections.
        if(heading.closest('section,article')!==scope.closest('section,article'))continue;
        const level=Number(heading.tagName.slice(1));
        while(outline.length&&outline.at(-1).level>=level)outline.pop();
        outline.push({level,text:clean(heading.textContent)});
      }
      headings.push(...outline.map(x=>x.text));
    }
    const legend=element.closest('fieldset')?.querySelector('legend')?.textContent;
    const row=element.closest('li,tr,[role=group]');
    let rowText='';
    if (row) {const clone=row.cloneNode(true);clone.querySelectorAll('input,select,textarea,button,details,a,[role=menu]').forEach(x=>x.remove());rowText=clean(clone.textContent);}
    return clean([...headings,legend,rowText].filter(Boolean).join(' / '));
  }
  function allowed(element) {
    if (!visible(element) || element.matches(':disabled') || element.readOnly) return false;
    if (element.tagName==='SELECT' && element.multiple) return false;
    if (element.tagName==='INPUT' && !['text','email','tel','url','search','number','date','time','datetime-local','checkbox','radio'].includes(element.type)) return false;
    const identity=[label(element),element.name,element.id,element.autocomplete].join(' ');
    if (element.matches('input[type=checkbox],input[type=radio],select')) return true;
    return !/(password|passwd|secret|token|api.?key|credit.?card|card.?number|cc-number|cc-csc|cvc|cvv|one.?time|otp|social.?security|パスワード|秘密|トークン|カード番号|認証コード)/i.test(identity);
  }
  function value(entry) {
    if (entry.kind==='radio') return entry.elements.find(x=>x.checked)?.value ?? null;
    if (entry.kind==='checkbox') return entry.elements[0].checked;
    return entry.elements[0].value;
  }
  function describe(entry,id) {
    const element=entry.elements[0];
    const base={id,kind:entry.kind,label:label(element),context:context(element),type:element.type||element.tagName.toLowerCase(),required:element.required};
    if (entry.kind==='radio') {
      base.label=clean(element.closest('fieldset')?.querySelector('legend')?.textContent || element.name || base.label);
      base.options=entry.elements.map(x=>({value:x.value,label:label(x)}));
    }
    if (entry.kind==='select') base.options=Array.from(element.options).filter(x=>!x.disabled && !x.closest('optgroup[disabled]')).map(x=>({value:x.value,label:clean(x.textContent)}));
    return base;
  }
  function collect() {
    const entries=[],seen=new Set();
    for (const element of doc.querySelectorAll('input,textarea,select')) {
      if (seen.has(element) || !allowed(element)) continue;
      const kind=element.type==='radio'?'radio':element.type==='checkbox'?'checkbox':element.tagName==='SELECT'?'select':'text';
      let elements=[element];
      if (kind==='radio' && element.name) {
        elements=Array.from(doc.querySelectorAll('input[type=radio]')).filter(x=>x.name===element.name && x.form===element.form);
        if (!elements.every(allowed)) {elements.forEach(x=>seen.add(x));continue;}
      }
      elements.forEach(x=>seen.add(x));
      const entry={kind,elements};
      const descriptor=describe(entry,`f${entries.length}`);
      if (!descriptor.label || descriptor.options?.length>254 || descriptor.options?.length===0 || new Set(descriptor.options?.map(x=>x.value)).size!== (descriptor.options?.length || 0)) continue;
      entry.descriptor=descriptor;entry.before=value(entry);entry.fingerprint=JSON.stringify(descriptor);
      entries.push(entry);
    }
    return entries;
  }
  function reveal(entry) {
    const opened=[];
    for (const element of entry.elements) for(let p=element.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS' && !p.open) {p.open=true;opened.push(p);}
    return opened;
  }
  function current(entry) {
    const first=entry.elements[0];
    if (entry.kind==='radio' && first.name) {
      const members=Array.from(doc.querySelectorAll('input[type=radio]')).filter(x=>x.name===first.name && x.form===first.form);
      if (members.length!==entry.elements.length || members.some((x,i)=>x!==entry.elements[i])) return false;
    }
    return entry.elements.every(allowed) && JSON.stringify(describe(entry,entry.descriptor.id))===entry.fingerprint;
  }
  function setter(element,property,newValue) {
    const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:element.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,property).set.call(element,newValue);
    element.dispatchEvent(new Event('input',{bubbles:true}));
    element.dispatchEvent(new Event('change',{bubbles:true}));
    element.dispatchEvent(new Event('blur',{bubbles:true}));
  }
  function write(entry,newValue,restoring=false) {
    if (entry.kind==='radio') {
      const target=entry.elements.find(x=>x.value===newValue);
      if (!target) return false;
      // Native radios update the whole group. No click: avoids submit/navigation handlers.
      setter(target,'checked',true);
    } else if (entry.kind==='checkbox') {
      if (typeof newValue!=='boolean') return false;
      setter(entry.elements[0],'checked',newValue);
    } else {
      if (typeof newValue!=='string') return false;
      if (entry.kind==='select' && !entry.descriptor.options.some(x=>x.value===newValue)) return false;
      const element=entry.elements[0];
      if (!restoring) {
        if (element.maxLength>=0 && newValue.length>element.maxLength) return false;
        const probe=element.cloneNode(true);probe.value=newValue;
        if (newValue && (!probe.validity.valid || probe.value!==newValue)) return false;
      }
      setter(element,'value',newValue);
    }
    return true;
  }
  const settle=()=>new Promise(resolve=>setTimeout(resolve,80));
  if (request.op==='scan') {
    const opened=openedForScan();
    try {
      const entries=collect();
      if (entries.length>160) throw new Error('160項目を超えています。対象フォームを分けてください。');
      const previous=globalThis[key];
      const token=crypto.randomUUID();
      globalThis[key]={token,url:location.href,entries,undo:previous?.undo||[]};
      return {token,url:location.origin+location.pathname,title:doc.title,fields:entries.map(x=>x.descriptor),unsupported:doc.querySelectorAll('[role=combobox]:not(select),[role=listbox]:not(select),iframe').length};
    } finally {opened.reverse().forEach(x=>{x.open=false;});}
  }
  return (async()=>{
    const state=globalThis[key];
    if (!state || state.url!==location.href || (request.op==='apply' && request.token!==state.token)) throw new Error('対象ページが変わりました。もう一度読み取ってください。');
    if (state.busy) throw new Error('入力処理中です。');
    state.busy=true;
    try {
      const results=[];
      if (request.op==='undo') {
        const pending=[],restoredRecords=[];
        for (const record of [...state.undo].reverse()) {
          const opened=reveal(record.entry);
          try {
            if (!current(record.entry) || value(record.entry)!==record.after) {results.push({id:record.entry.descriptor.id,status:'skip',reason:'その後の変更を残しました。'});continue;}
            if (record.entry.kind==='radio' && record.before===null) record.entry.elements.forEach(x=>setter(x,'checked',false));
            else if (!write(record.entry,record.before,true)) {pending.push(record);results.push({id:record.entry.descriptor.id,status:'failed'});continue;}
            await settle();
            const restored=value(record.entry)===record.before;
            const result={id:record.entry.descriptor.id,status:restored?'restored':'failed'};
            results.push(result);
            if(restored)restoredRecords.push({record,result});
            if (!restored) pending.push(record);
          } finally {opened.reverse().forEach(x=>{x.open=false;});}
        }
        if(restoredRecords.length) {
          await new Promise(resolve=>setTimeout(resolve,650));
          for(const {record,result} of restoredRecords)if(!record.entry.elements.every(x=>x.isConnected)||value(record.entry)!==record.before) {
            result.status='failed';pending.push(record);
          }
        }
        state.undo=state.undo.filter(record=>pending.includes(record));return results;
      }
      if (request.op!=='apply') throw new Error('不明な操作です。');
      const rows=new Map((request.rows||[]).map(x=>[x.id,x]));
      const undo=[];
      for (const entry of state.entries) {
        const row=rows.get(entry.descriptor.id);if(!row) continue;
        const opened=reveal(entry);
        try {
          if (!current(entry) || value(entry)!==entry.before) {results.push({id:row.id,status:'skip',reason:'ページの項目または値が変わりました。'});continue;}
          if (value(entry)===row.value) {results.push({id:row.id,status:'unchanged',reason:'すでに同じ値です。'});continue;}
          const before=value(entry);
          if (!write(entry,row.value)) {results.push({id:row.id,status:'skip',reason:'この値は項目に設定できません。'});continue;}
          const after=value(entry);
          if (after!==before) undo.push({entry,before,after});
          await settle();await settle();
          const retained=value(entry)===row.value;
          results.push({id:row.id,status:retained?'filled':'failed',reason:retained?'入力して読戻しを確認しました。':'ページが値を受け付けませんでした。'});
        } catch {results.push({id:row.id,status:'failed',reason:'この項目の入力に失敗しました。'});}
        finally {opened.reverse().forEach(x=>{x.open=false;});}
      }
      // A plan can be applied only once, even when some rows were deselected.
      if(results.some(x=>x.status==='filled')) {
        await new Promise(resolve=>setTimeout(resolve,650));
        for(const result of results.filter(x=>x.status==='filled')) {
          const entry=state.entries.find(x=>x.descriptor.id===result.id);
          if(!entry.elements.every(x=>x.isConnected)||value(entry)!==rows.get(result.id).value) {
            result.status='failed';result.reason='入力後にページが値を変更しました。';
          }
        }
      }
      state.token=null;
      if (undo.length) state.undo=undo;
      return results;
    } finally {state.busy=false;}
  })();
}
