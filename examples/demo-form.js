document.querySelector('form').addEventListener('submit',event=>{
  event.preventDefault();
  document.getElementById('submitted').hidden=false;
});
document.getElementById('copy').addEventListener('click',async()=>{
  try {
    await navigator.clipboard.writeText(document.getElementById('source').textContent);
    document.getElementById('copy').textContent='Copied';
  } catch {
    document.getElementById('copy').textContent='Copy failed — select the text above';
  }
});
