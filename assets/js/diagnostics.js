(()=>{
  const esc=value=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const formatSession=()=>{const s=Math.max(0,Math.floor(performance.now()/1000)),d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;};
  const init=()=>{
    const original=document.getElementById('luna-terminal');
    if(original){
      const terminal=original.cloneNode(true);
      original.replaceWith(terminal);
      const input=terminal.querySelector('#luna-command'),output=terminal.querySelector('#luna-terminal-output');
      const renderInitial=()=>{output.innerHTML='<span class="luna-line"><span class="luna-prompt">luna@system:~$</span> status</span><span class="luna-line">frontend <span class="luna-value">online</span></span><span class="luna-line">session <span class="luna-value" id="luna-uptime">'+formatSession()+'</span></span><span class="luna-line">backend <span class="luna-value" id="luna-terminal-backend">not configured</span></span><span class="luna-line">latency <span class="luna-value" id="luna-latency">--</span></span><span class="luna-line luna-muted">type <span class="luna-value">help</span> for commands<span class="luna-cursor"></span></span><div class="luna-terminal-input"><span class="luna-prompt">&gt;</span><input id="luna-command" autocomplete="off" spellcheck="false" placeholder="try: status, products, build, help"><button class="sr-only" id="luna-command-submit" type="button">Run command</button></div>';
      };
      renderInitial();
      const print=html=>{const row=document.createElement('span');row.className='luna-line';row.innerHTML=html;output.insertBefore(row,output.querySelector('.luna-terminal-input'));};
      const run=raw=>{const cmd=raw.trim().toLowerCase();if(!cmd)return;print(`<span class="luna-prompt">luna@system:~$</span> ${esc(raw)}`);const backend=document.getElementById('luna-backend-status')?.textContent||'Not configured';const commands={help:'commands: status · products · build · session · clear · help',status:`frontend online · backend ${backend.toLowerCase()}`,products:'external [available] · executor [coming soon] · fivem [coming soon]',build:'static deployment · source main · GitHub Pages',session:`page session ${formatSession()}`,clear:'__CLEAR__'};const response=commands[cmd]||`command not found: ${esc(cmd)}`;if(response==='__CLEAR__'){output.querySelectorAll('.luna-line').forEach(x=>x.remove());print('<span class="luna-muted">terminal cleared. type <span class="luna-value">help</span> for commands</span>')}else print(`<span class="luna-value">${response}</span>`);input.value='';output.parentElement.scrollTop=output.parentElement.scrollHeight;};
      input.addEventListener('keydown',e=>{if(e.key==='Enter')run(input.value)});terminal.querySelector('#luna-command-submit')?.addEventListener('click',()=>run(input.value));
    }
    const session=document.getElementById('luna-uptime');if(session){const update=()=>session.textContent=formatSession();update();setInterval(update,30000);const label=session.parentElement?.firstChild;if(label&&label.nodeType===3)label.textContent='session ';}
    const backend=document.getElementById('luna-backend-status');const terminalBackend=document.getElementById('luna-terminal-backend');const latency=document.getElementById('luna-latency');
    const api=typeof window.NO_CONTEXT_API_URL==='string'&&window.NO_CONTEXT_API_URL.trim()?window.NO_CONTEXT_API_URL.trim():'';
    const setBackend=(text,online=false)=>{if(backend){backend.textContent=text;backend.classList.toggle('online',online)}if(terminalBackend)terminalBackend.textContent=text.toLowerCase()};
    if(!api){setBackend('Not configured');if(latency)latency.textContent='--';return;}
    setBackend('Checking…');
    const started=performance.now();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4000);
    fetch(new URL('/api/health',api).toString(),{method:'GET',cache:'no-store',signal:controller.signal}).then(r=>{const ms=Math.round(performance.now()-started);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json().catch(()=>({})).then(data=>({data,ms}));}).then(({data,ms})=>{clearTimeout(timeout);const healthy=data?.status==='ok'||data?.status==='healthy'||data?.ok===true||data?.status===undefined;setBackend(healthy?'Healthy':'Responding',healthy);if(latency)latency.textContent=`${ms}ms`;}).catch(()=>{clearTimeout(timeout);setBackend('Unreachable');if(latency)latency.textContent='--';});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
