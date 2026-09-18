(() => {
  'use strict';

  const BASE = '/NoContext-website/';
  const API = 'https://nocontext.onrender.com';
  const esc = value => String(value).replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));

  function addPageChrome() {
    document.documentElement.classList.add('nc-premium-ui');
    const main = document.querySelector('main, .hero, header.hero, .section');
    if (main && !main.classList.contains('page-shell')) main.classList.add('page-shell');

    const body = document.body;
    if (!body.querySelector('.nc-topline')) {
      const bar = document.createElement('div');
      bar.className = 'nc-topline';
      bar.innerHTML = '<div class="container"><span><i></i> NoContext system online</span><span>Independent software · Updated regularly</span></div>';
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
            <h3><i class="fas fa-cube"></i> NoContext</h3>
            <p>Focused software, browser experiences and tools built with a deliberate interface, useful features and minimal noise.</p>
            <span class="nc-footer-status"><i></i> All systems operational</span>
          </div>
          <div class="nc-footer-col"><h4>Products</h4><a href="${BASE}store/">Store</a><a href="${BASE}features/">Features</a><a href="${BASE}browser-games/">Browser Games</a><a href="${BASE}developer-api/">Developer API</a></div>
          <div class="nc-footer-col"><h4>Company</h4><a href="${BASE}about/">About</a><a href="${BASE}updates/">Updates</a><a href="${BASE}faq/">FAQ</a><a href="${BASE}contact/">Contact</a></div>
          <div class="nc-footer-col"><h4>Legal</h4><a href="${BASE}privacy/">Privacy</a><a href="${BASE}terms/">Terms</a><a href="${BASE}acceptable-use/">Acceptable Use</a><a href="${BASE}copyright/">Copyright</a></div>
        </div>
        <div class="nc-footer-bottom">
          <span>© 2026 NoContext. All rights reserved.</span>
          <span><a href="${BASE}status/">System Status</a><a href="https://discord.gg/GrD3C722nC" rel="noopener noreferrer">Discord</a></span>
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
          <p>Link your Discord account to this NoContext account.</p>
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
            <div><strong style="display:block;color:#fff">${esc(data.discord?.username || 'Discord account')}</strong><span style="display:block;margin-top:4px;color:var(--text-muted);font-size:.78rem">Linked to your NoContext account</span></div>
            <i class="fas fa-check-circle" style="color:#9ff0b0;font-size:1.1rem"></i>
          </div>
        `;
        return;
      }
      state.textContent = 'Not connected';
      state.style.color = 'var(--text-muted)';
      body.innerHTML = `
        <p style="font-size:.8rem">Connect Discord here so your Discord identity stays attached to the NoContext account you are currently using.</p>
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
      success: 'Discord has been linked to your NoContext account.',
      'discord-already-linked': 'That Discord account is already linked to another NoContext account.',
      'account-already-linked': 'This NoContext account already has a Discord account linked.',
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
      label.textContent = String(index + 1).padStart(2, '0') + ' / NOCONTEXT';
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
