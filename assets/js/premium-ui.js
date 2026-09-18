(() => {
  'use strict';

  const BASE = '/luna.win-website/';
  const API = 'https://nocontext.onrender.com';
  const esc = value => String(value).replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));

  function lunaBrand() {
    if (document.getElementById('luna-brand-style')) return;
    const style=document.createElement('style');
    style.id='luna-brand-style';
    style.textContent=`
      :root{--accent:#dfe7ff;--accent-soft:rgba(170,190,255,.10)}
      body:before{background:radial-gradient(circle at 50% -10%,rgba(120,145,255,.14),transparent 34%),radial-gradient(circle at 100% 35%,rgba(190,205,255,.045),transparent 30%)}
      nav:after{background:linear-gradient(90deg,transparent,rgba(190,205,255,.45),transparent)}
      .logo i{color:#dfe7ff}.btn-primary{background:#dfe7ff;color:#080a10;box-shadow:0 8px 28px rgba(170,190,255,.14)}
      .btn-primary:hover{box-shadow:0 14px 42px rgba(170,190,255,.25)}
      .hero:before{box-shadow:0 0 150px rgba(140,165,255,.09),inset 0 0 100px rgba(255,255,255,.018)}
      .hero:after{background:radial-gradient(circle at 50% 38%,rgba(140,165,255,.12),transparent 28%),linear-gradient(to bottom,transparent 65%,var(--bg) 100%)}
      .text-gradient{background:linear-gradient(110deg,#fff,#eef2ff 48%,#c8d4ff);-webkit-background-clip:text;background-clip:text}
      .ambient-orb{background:#9db2ff}.nc-easter button:hover{color:#dfe7ff}
      .luna-stars{position:fixed;inset:0;pointer-events:none;z-index:-2;background-image:radial-gradient(circle,rgba(255,255,255,.42) 1px,transparent 1.5px);background-size:97px 97px;opacity:.08;mask-image:linear-gradient(to bottom,black,transparent 80%)}
    `;
    document.head.appendChild(style);
    const stars=document.createElement('div');stars.className='luna-stars';document.body.prepend(stars);
  }

  function applyLunaCopy() {
    const replacements=[['luna.win system online','luna.win system online'],['luna.win · Moonlit software','luna.win · Moonlit software'],['luna.win External','luna.win External'],['luna.win / Control','luna.win / Control'],['luna.win','luna.win'],['luna','luna'],['LUNA','LUNA'],['NO CONTEXT','LUNA']];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{let v=node.nodeValue;replacements.forEach(([a,b])=>v=v.split(a).join(b));node.nodeValue=v});
    document.querySelectorAll('.logo i').forEach(i=>i.className='fas fa-moon');
    document.title=document.title.replace(/luna.win/gi,'luna.win');
    document.querySelectorAll('meta').forEach(m=>{const k=m.getAttribute('name')||m.getAttribute('property');if(['description','og:site_name','og:title','og:description','twitter:title','twitter:description'].includes(k)&&m.content)m.content=m.content.replace(/luna.win/gi,'luna.win')});
  }

  function addPageChrome() {
    document.documentElement.classList.add('nc-premium-ui');
    const main = document.querySelector('main, .hero, header.hero, .section');
    if (main && !main.classList.contains('page-shell')) main.classList.add('page-shell');

    const body = document.body;
    if (!body.querySelector('.nc-topline')) {
      const bar = document.createElement('div');
      bar.className = 'nc-topline';
      bar.innerHTML = '<div class="container"><span><i></i> luna.win system online</span><span>luna.win · Moonlit software</span></div>';
      body.insertBefore(bar, body.firstChild);
    }
  }

  function upgradeFooter() {
    const footer = document.querySelector('footer');
    if (!footer || footer.dataset.premiumFooter === 'true') return;
    footer.dataset.premiumFooter = 'true';
    footer.innerHTML = `
      <div class="container">
        <div class="nc-pro-footer">
          <div class="nc-pro-footer-brand">
            <h3><i class="fas fa-moon"></i> luna.win</h3>
            <p>Focused software, browser experiences and tools built with a deliberate interface, useful features and minimal noise.</p>
            <span class="nc-footer-status"><i></i> All systems operational</span>
          </div>
          <div class="nc-footer-col"><h4>Products</h4><a href="${BASE}store.html">Store</a><a href="${BASE}features.html">Features</a><a href="${BASE}browser-games.html">Browser Games</a><a href="${BASE}developer-api.html">Developer API</a></div>
          <div class="nc-footer-col"><h4>Company</h4><a href="${BASE}about.html">About</a><a href="${BASE}updates.html">Updates</a><a href="${BASE}faq.html">FAQ</a><a href="${BASE}contact.html">Contact</a></div>
          <div class="nc-footer-col"><h4>Legal</h4><a href="${BASE}privacy.html">Privacy</a><a href="${BASE}terms.html">Terms</a><a href="${BASE}acceptable-use.html">Acceptable Use</a><a href="${BASE}copyright.html">Copyright</a></div>
        </div>
        <div class="nc-footer-bottom">
          <span>© 2026 luna.win. All rights reserved.</span>
          <span><a href="${BASE}status.html">System Status</a><a href="https://discord.gg/GrD3C722nC" rel="noopener noreferrer">Discord</a></span>
        </div>
      </div>`;
  }

  function addDiscordDashboardCard() {
    const grid = document.querySelector('#account.account-grid');
    if (!grid || document.querySelector('[data-premium-discord-card]')) return;

    const card = document.createElement('section');
    card.className = 'account-card';
    card.dataset.premiumDiscordCard = 'true';
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
        <div>
          <h2><i class="fab fa-discord" style="margin-right:7px"></i>Discord</h2>
          <p>Link your Discord account to this luna.win account.</p>
        </div>
        <span data-premium-discord-state style="font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Checking…</span>
      </div>
      <div data-premium-discord-body style="margin-top:18px"></div>
    `;

    const licenseCard = grid.querySelector('.account-card:last-child');
    grid.appendChild(card);

    const state = card.querySelector('[data-premium-discord-state]');
    const body = card.querySelector('[data-premium-discord-body]');
    const render = data => {
      if (data?.linked) {
        state.textContent = 'Connected';
        state.style.color = '#9ff0b0';
        body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)">
            <div><strong style="display:block;color:#fff">${esc(data.discord?.username || 'Discord account')}</strong><span style="display:block;margin-top:4px;color:var(--text-muted);font-size:.78rem">Linked to your luna.win account</span></div>
            <i class="fas fa-check-circle" style="color:#9ff0b0;font-size:1.1rem"></i>
          </div>
        `;
        return;
      }
      state.textContent = 'Not connected';
      state.style.color = 'var(--text-muted)';
      body.innerHTML = `
        <p style="font-size:.8rem">Connect Discord here so your Discord identity stays attached to the luna.win account you are currently using.</p>
        <div class="account-actions" style="margin-top:16px"><a class="btn btn-primary" href="${API}/api/auth/discord/link"><i class="fab fa-discord" style="margin-right:7px"></i>Link Discord</a></div>
      `;
    };

    fetch(`${API}/api/auth/discord/status`, { credentials: 'include', cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error('not-signed-in');
        if (!response.ok) throw new Error(data.detail || 'Unable to check Discord status.');
        return data;
      })
      .then(render)
      .catch(error => {
        state.textContent = error.message === 'not-signed-in' ? 'Sign in required' : 'Unavailable';
        state.style.color = '#ff9d9d';
        body.innerHTML = '<p style="font-size:.8rem;color:var(--text-muted)">Sign in to manage your Discord connection.</p>';
      });
  }

  function addDiscordResultNotice() {
    if (!location.pathname.endsWith('account-dashboard.html')) return;
    const result = new URLSearchParams(location.search).get('discord_link');
    if (!result || document.querySelector('[data-discord-result-notice]')) return;
    const host = document.querySelector('.account-head');
    if (!host) return;
    const notice = document.createElement('div');
    notice.dataset.discordResultNotice = 'true';
    notice.style.cssText = 'margin-top:12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);font-size:.8rem;color:#9ff0b0;';
    const messages = {
      success: 'Discord has been linked to your luna.win account.',
      'discord-already-linked': 'That Discord account is already linked to another luna.win account.',
      'account-already-linked': 'This luna.win account already has a Discord account linked.',
    };
    notice.textContent = messages[result] || 'Discord linking could not be completed.';
    if (result !== 'success') notice.style.color = '#ffcf9d';
    host.appendChild(notice);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  function addSectionLabels() {
    document.querySelectorAll('.section-title').forEach((section, index) => {
      if (section.querySelector('.nc-section-label')) return;
      const heading = section.querySelector('h2,h1');
      if (!heading) return;
      const label = document.createElement('div');
      label.className = 'nc-section-label';
      label.textContent = String(index + 1).padStart(2, '0') + ' / LUNA';
      heading.before(label);
    });
  }

  function improveLinks() {
    document.querySelectorAll('a.btn-primary,a.btn-outline').forEach(a => {
      if (!a.getAttribute('aria-label') && !a.textContent.trim()) a.setAttribute('aria-label','Open link');
    });
  }

  function init() {
    lunaBrand();
    addPageChrome();
    upgradeFooter();
    addSectionLabels();
    applyLunaCopy();
    improveLinks();
    addDiscordDashboardCard();
    addDiscordResultNotice();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
