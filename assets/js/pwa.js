(() => {
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toast = (message, kind = 'info') => {
        let node = document.getElementById('nc-toast');
        if (!node) { node=document.createElement('div'); node.id='nc-toast'; node.setAttribute('role','status'); node.setAttribute('aria-live','polite'); node.style.cssText='position:fixed;left:50%;bottom:22px;z-index:10000;transform:translateX(-50%) translateY(12px);max-width:min(92vw,520px);padding:11px 14px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(10,12,13,.96);color:#f3f5f4;font:600 12px/1.4 system-ui,sans-serif;box-shadow:0 16px 50px rgba(0,0,0,.45);opacity:0;transition:opacity .2s ease,transform .2s ease'; document.body.appendChild(node); }
        node.textContent=message; node.dataset.kind=kind; requestAnimationFrame(()=>{node.style.opacity='1';node.style.transform='translateX(-50%) translateY(0)';}); clearTimeout(node._timer); node._timer=setTimeout(()=>{node.style.opacity='0';node.style.transform='translateX(-50%) translateY(12px)';},3200);
    };
    const apiBase=String(window.NO_CONTEXT_API_URL||'https://nocontext.onrender.com').replace(/\/$/,'');
    const backend=document.getElementById('nc-backend-status');
    if(backend){backend.textContent='Checking…';backend.classList.remove('online');fetch(`${apiBase}/api/health`,{cache:'no-store',credentials:'omit'}).then(r=>{if(!r.ok)throw new Error();backend.textContent='Operational';backend.classList.add('online');}).catch(()=>{backend.textContent='Unavailable';backend.classList.remove('online');});}
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/NoContext-website/sw.js',{scope:'/NoContext-website/'}).catch(()=>{});
    document.querySelectorAll('a[href]').forEach(link=>{const href=link.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||link.target==='_blank')return;let url;try{url=new URL(href,location.href);}catch{return;}if(url.origin!==location.origin||!url.pathname.startsWith('/NoContext-website/'))return;link.addEventListener('pointerenter',()=>{if(!reduced())fetch(url.href,{cache:'force-cache',credentials:'same-origin'}).catch(()=>{});},{passive:true,once:true});});
    const updateConnection=()=>{document.documentElement.dataset.connection=navigator.onLine?'online':'offline';if(!navigator.onLine)toast('You are offline. Cached NoContext pages remain available.','offline');};
    addEventListener('online',()=>toast('Connection restored.','success')); addEventListener('offline',updateConnection); updateConnection();
})();
