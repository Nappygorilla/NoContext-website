(() => {
  const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
  const accountGrid = document.querySelector('#account.account-grid');
  const hero = accountGrid?.querySelector('.account-card--hero');
  if (!configured || !accountGrid || !hero || document.querySelector('[data-discord-link-card]')) return;

  const card = document.createElement('section');
  card.className = 'account-card discord-link-card';
  card.dataset.discordLinkCard = 'true';
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px">
      <div>
        <div style="font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:7px">Connected account</div>
        <h2 style="display:flex;align-items:center;gap:10px;margin-bottom:7px"><i class="fab fa-discord" aria-hidden="true"></i> Discord</h2>
        <p>Link your Discord account to this NoContext account.</p>
      </div>
      <div data-discord-status style="font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);white-space:nowrap">Checking…</div>
    </div>
    <div data-discord-body style="margin-top:18px"></div>
    <p class="account-note" data-discord-message aria-live="polite"></p>
  `;
  accountGrid.insertBefore(card, hero.nextElementSibling);

  const status = card.querySelector('[data-discord-status]');
  const body = card.querySelector('[data-discord-body]');
  const message = card.querySelector('[data-discord-message]');

  const setMessage = (text, kind = '') => {
    message.textContent = text;
    message.style.color = kind === 'success' ? '#9ff0b0' : kind === 'error' ? '#ff9d9d' : 'var(--text-muted)';
  };

  const render = data => {
    if (data?.linked && data.discord) {
      status.textContent = 'Connected';
      status.style.color = '#9ff0b0';
      body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:15px;padding:14px 15px;border:1px solid rgba(184,255,61,.14);border-radius:13px;background:rgba(184,255,61,.035)">
          <div style="display:flex;align-items:center;gap:12px;min-width:0">
            <span style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#313338;color:#fff"><i class="fab fa-discord" aria-hidden="true"></i></span>
            <div style="min-width:0"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(data.discord.username || 'Discord User')}</strong><span style="display:block;margin-top:3px;font-size:.76rem;color:var(--text-muted)">Discord account linked</span></div>
          </div>
        </div>
      `;
      return;
    }

    status.textContent = 'Not connected';
    status.style.color = 'var(--text-muted)';
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <span style="font-size:.82rem;color:var(--text-muted)">No Discord account is linked yet.</span>
        <a class="btn btn-primary" data-discord-link-button href="${configured}/api/auth/discord/link"><i class="fab fa-discord" aria-hidden="true"></i> Link Discord</a>
      </div>
    `;
  };

  const escapeHtml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const result = new URLSearchParams(location.search).get('discord_link');
  if (result === 'success') setMessage('Discord account linked successfully.', 'success');
  if (result === 'account-already-linked') setMessage('This NoContext account already has a Discord account linked.', 'error');
  if (result === 'discord-already-linked') setMessage('That Discord account is already linked to another NoContext account.', 'error');

  fetch(`${configured}/api/auth/discord/status`, { credentials: 'include', cache: 'no-store' })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.replace('./login.html');
        return null;
      }
      if (!response.ok) throw new Error(data.detail || 'Unable to check Discord connection.');
      return data;
    })
    .then(data => { if (data) render(data); })
    .catch(error => {
      status.textContent = 'Unavailable';
      status.style.color = '#ff9d9d';
      body.innerHTML = '<span style="font-size:.82rem;color:var(--text-muted)">Discord connection status could not be loaded.</span>';
      setMessage(error.message || 'Unable to check Discord connection.', 'error');
    });
})();
