(() => {
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toast = (message) => {
        let node = document.getElementById('luna-toast');
        if (!node) {
            node = document.createElement('div'); node.id = 'luna-toast'; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
            node.style.cssText = 'position:fixed;left:50%;bottom:22px;z-index:10000;transform:translateX(-50%) translateY(12px);max-width:min(92vw,520px);padding:11px 14px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(10,12,13,.96);color:#f3f5f4;font:600 12px/1.4 system-ui,sans-serif;box-shadow:0 16px 50px rgba(0,0,0,.45);opacity:0;transition:opacity .2s ease,transform .2s ease';
            document.body.appendChild(node);
        }
        node.textContent = message;
        requestAnimationFrame(() => { node.style.opacity = '1'; node.style.transform = 'translateX(-50%) translateY(0)'; });
        clearTimeout(node._timer);
        node._timer = setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateX(-50%) translateY(12px)'; }, 3200);
    };

    const apiBase = String(window.LUNA_API_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');
    const backend = document.getElementById('luna-backend-status');
    if (backend) {
        backend.textContent = 'Checking…'; backend.classList.remove('online');
        const started = performance.now();
        fetch(`${apiBase}/api/health`, { cache: 'no-store', credentials: 'omit' })
            .then(r => { if (!r.ok) throw new Error(); return r.json().catch(() => ({})); })
            .then(() => {
                const latency = Math.round(performance.now() - started);
                backend.textContent = `Operational · ${latency}ms`; backend.classList.add('online');
                const latencyLabel = document.getElementById('luna-latency'); if (latencyLabel) latencyLabel.textContent = `${latency}ms`;
                const uptime = document.getElementById('luna-uptime'); if (uptime) uptime.textContent = 'live';
            })
            .catch(() => {
                backend.textContent = 'Unavailable'; backend.classList.remove('online');
                const uptime = document.getElementById('luna-uptime'); if (uptime) uptime.textContent = 'offline';
            });
    }

    const syncNavigation = async () => {
        const nav = document.querySelector('nav .container'); const links = document.querySelector('.nav-links'); if (!nav || !links) return;
        links.querySelectorAll('a').forEach(link => { if (link.textContent.trim().toLowerCase() === 'key') link.parentElement?.remove(); });
        document.querySelectorAll('a[href="key.html"]').forEach(link => {
            if (link.textContent.toLowerCase().includes('try the free version')) { link.href = 'product.html?id=external'; link.innerHTML = 'View the free version <i class="fas fa-arrow-right"></i>'; }
        });
        const actions = nav.querySelector('.nav-actions'); if (!actions) return;
        const api = String(window.LUNA_API_URL || '').trim().replace(/\/$/, ''); if (!api) return;
        try {
            const response = await fetch(`${api}/api/auth/me`, { credentials: 'include', cache: 'no-store' }); const data = await response.json().catch(() => ({}));
            const signedIn = Boolean(response.ok && data.authenticated && data.user);
            actions.innerHTML = signedIn ? '<a href="/NoContext-website/account-dashboard.html" class="btn btn-primary">Dashboard</a>' : '<a href="/NoContext-website/login.html" class="btn btn-outline">Sign In</a><a href="/NoContext-website/register.html" class="btn btn-primary">Register</a>';
        } catch (_) {}
    };
    syncNavigation();

    const polish = document.createElement('style');
    polish.textContent = '.ambient-orb{opacity:.16!important}.cursor-glow{opacity:.28!important}.grid-overlay{opacity:.5!important}.scroll-progress{height:2px!important}.hero-preview{will-change:transform}.luna-terminal-input input{caret-color:var(--accent)}';
    document.head.appendChild(polish);

    const egg = document.getElementById('luna-easter-trigger');
    if (egg) { egg.setAttribute('aria-hidden', 'true'); egg.tabIndex = -1; egg.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;padding:0;margin:-1px;opacity:0;pointer-events:none'; }

    const reveal = () => {
        document.body.classList.toggle('luna-hidden-mode');
        const box = document.createElement('div'); box.textContent = 'NO CONTEXT // SIGNAL FOUND';
        box.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000;padding:10px 14px;border:1px solid rgba(190,255,70,.35);background:rgba(8,10,10,.94);color:var(--accent);font:600 11px/1.2 monospace;letter-spacing:.14em;box-shadow:0 10px 40px rgba(0,0,0,.35)';
        document.body.appendChild(box);
        if (window.gsap && !reduced()) gsap.fromTo(box, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power3.out' });
        setTimeout(() => box.remove(), 2200);
    };

    // Hidden trigger: nine rapid logo clicks.
    const logo = document.querySelector('nav .logo');
    if (logo) {
        const cleanLogo = logo.cloneNode(true); logo.replaceWith(cleanLogo);
        let clicks = 0, timer = 0;
        cleanLogo.addEventListener('click', event => {
            clicks += 1; clearTimeout(timer); timer = setTimeout(() => { clicks = 0; }, 1100);
            if (clicks >= 9) { event.preventDefault(); clicks = 0; reveal(); }
        });
    }

    // Hidden trigger: type the full word "nocontext". Intercept the old
    // shorter "nocont" trigger so the previous easter egg cannot fire first.
    let keyBuffer = '';
    addEventListener('keydown', event => {
        if (event.key.length !== 1) return;
        const key = event.key.toLowerCase();
        if (keyBuffer.endsWith('nocon') && key === 't') event.stopImmediatePropagation();
        keyBuffer = (keyBuffer + key).slice(-16);
        if (keyBuffer.endsWith('nocontext')) { keyBuffer = ''; reveal(); }
    }, true);

    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/NoContext-website/sw.js', { scope: '/NoContext-website/' }).catch(() => {});

    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href'); if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') return;
        let url; try { url = new URL(href, location.href); } catch { return; }
        if (url.origin !== location.origin || !url.pathname.startsWith('/NoContext-website/')) return;
        link.addEventListener('pointerenter', () => { if (!reduced() && !window.matchMedia('(pointer: coarse)').matches) fetch(url.href, { cache: 'force-cache', credentials: 'same-origin' }).catch(() => {}); }, { passive: true, once: true });
    });

    const updateConnection = () => { document.documentElement.dataset.connection = navigator.onLine ? 'online' : 'offline'; if (!navigator.onLine) toast('You are offline. Cached luna.win pages remain available.'); };
    addEventListener('online', () => toast('Connection restored.')); addEventListener('offline', updateConnection); updateConnection();
})();
