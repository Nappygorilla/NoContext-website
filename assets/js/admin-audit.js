(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  const root = document.querySelector('[data-audit-log]');
  const list = document.querySelector('[data-audit-list]');
  const status = document.querySelector('[data-audit-status]');
  const csrf = () => sessionStorage.getItem('nocontext_csrf') || localStorage.getItem('nocontext_csrf') || '';
  const sessionToken = () => sessionStorage.getItem('nocontext_session') || localStorage.getItem('nocontext_session_token') || '';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const request = async (path, options = {}) => {
    const headers = {'Content-Type':'application/json', ...(csrf()?{'X-CSRF-Token':csrf()}:{}), ...(sessionToken()?{Authorization:`Bearer ${sessionToken()}`}:{}) , ...(options.headers || {})};
    const response = await fetch(`${api}${path}`, {...options, headers, credentials:'include', cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  };
  const formatDate = value => {
    if (!value) return 'No expiration';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
  };

  const renderAudit = logs => {
    status.textContent = `${logs.length} recent events`;
    list.innerHTML = logs.length ? logs.map(log => `<article class="audit-row"><div><strong>${esc(log.action)}</strong><span>${esc(log.targetType)}${log.targetId ? ` #${esc(log.targetId)}` : ''}</span></div><div class="audit-details">${esc(log.details || '—')}</div><time>${esc(formatDate(log.createdAt))} · Actor #${esc(log.actorUserId)}</time></article>`).join('') : '<p>No audit events yet.</p>';
  };

  const addKeyOverview = async () => {
    const shell = document.querySelector('.admin-shell');
    if (!shell || document.querySelector('[data-key-overview]')) return;
    const section = document.createElement('section');
    section.className = 'admin-card';
    section.dataset.keyOverview = 'true';
    section.style.marginBottom = '18px';
    section.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:15px;align-items:flex-start">
        <div>
          <div class="kicker">License inventory</div>
          <h2>All License Keys</h2>
          <p>See every imported key separated into active and inactive licenses.</p>
        </div>
        <span class="admin-badge"><i class="fas fa-key"></i> <span data-key-overview-count>Loading…</span></span>
      </div>
      <div data-key-overview-content style="display:grid;gap:14px;margin-top:18px"></div>`;
    const anchor = document.querySelector('[data-key-management]');
    (anchor || shell.querySelector('.audit-log') || shell.querySelector('.admin-grid'))?.after(section);
    const content = section.querySelector('[data-key-overview-content]');
    const count = section.querySelector('[data-key-overview-count]');

    const row = (item, active) => `<article style="padding:14px 15px;border:1px solid ${active ? 'rgba(190,255,70,.16)' : 'rgba(255,255,255,.08)'};border-radius:13px;background:${active ? 'rgba(190,255,70,.03)' : 'rgba(255,255,255,.015)'}"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><code style="font-family:ui-monospace,monospace;color:#fff;word-break:break-all">${esc(item.keyPrefix)}••••••••</code>${active ? '<span class="active-pill">Active</span>' : '<span class="expired-pill">Inactive</span>'}</div><div style="margin-top:6px;color:var(--text-muted);font-size:.74rem;line-height:1.5">User #${esc(item.userId)} · ${esc(item.username)}${item.email ? ` · ${esc(item.email)}` : ''} · ${esc(item.product)}</div><div style="margin-top:3px;color:#808985;font-size:.7rem">Created ${esc(formatDate(item.createdAt))} · Expires ${esc(formatDate(item.expiresAt))}</div></div></div></article>`;

    const loadKeys = async () => {
      try {
        const data = await request('/api/admin/keys');
        const keys = Array.isArray(data.keys) ? data.keys : [];
        const active = keys.filter(item => item.active);
        const inactive = keys.filter(item => !item.active);
        count.textContent = `${keys.length} total`;
        content.innerHTML = `
          <section style="padding:14px;border:1px solid rgba(190,255,70,.16);border-radius:15px;background:rgba(190,255,70,.025)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0;font-size:.95rem">Active Keys</h3><span style="color:var(--accent);font-size:.7rem;text-transform:uppercase;letter-spacing:.08em">${active.length} active</span></div>
            <div style="display:grid;gap:9px">${active.length ? active.map(item => row(item, true)).join('') : '<p style="margin:0;color:var(--text-muted);font-size:.8rem">No active keys.</p>'}</div>
          </section>
          <section style="padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.012)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0;font-size:.95rem">Inactive Keys</h3><span style="color:var(--text-muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.08em">${inactive.length} inactive</span></div>
            <div style="display:grid;gap:9px">${inactive.length ? inactive.map(item => row(item, false)).join('') : '<p style="margin:0;color:var(--text-muted);font-size:.8rem">No inactive keys.</p>'}</div>
          </section>`;
      } catch (error) {
        count.textContent = 'Unavailable';
        content.innerHTML = `<p class="admin-error">${esc(error.message)}</p>`;
      }
    };
    await loadKeys();
    setInterval(loadKeys, 15000);
  };

  const load = async () => {
    try {
      const data = await request('/api/admin/audit-logs?limit=150');
      const logs = Array.isArray(data.logs) ? data.logs : [];
      renderAudit(logs);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Unable to load audit log.';
      list.innerHTML = '';
    }
  };
  if (root) load();
  addKeyOverview();
})();
