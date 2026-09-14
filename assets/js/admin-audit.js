(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  const root = document.querySelector('[data-audit-log]');
  const list = document.querySelector('[data-audit-list]');
  const status = document.querySelector('[data-audit-status]');
  const csrf = () => localStorage.getItem('nocontext_csrf') || sessionStorage.getItem('nocontext_csrf') || '';
  const sessionToken = () => localStorage.getItem('nocontext_session_token') || '';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const request = async path => {
    const headers = {'Content-Type':'application/json', ...(csrf()?{'X-CSRF-Token':csrf()}:{}), ...(sessionToken()?{Authorization:`Bearer ${sessionToken()}`}:{})};
    const response = await fetch(`${api}${path}`, {headers, credentials:'include', cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  };
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
  };
  const load = async () => {
    try {
      const data = await request('/api/admin/audit-logs?limit=150');
      const logs = Array.isArray(data.logs) ? data.logs : [];
      status.textContent = `${logs.length} recent events`;
      list.innerHTML = logs.length ? logs.map(log => `<article class="audit-row"><div><strong>${esc(log.action)}</strong><span>${esc(log.targetType)}${log.targetId ? ` #${esc(log.targetId)}` : ''}</span></div><div class="audit-details">${esc(log.details || '—')}</div><time>${esc(formatDate(log.createdAt))} · Actor #${esc(log.actorUserId)}</time></article>`).join('') : '<p>No audit events yet.</p>';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Unable to load audit log.';
      list.innerHTML = '';
    }
  };
  if (root) load();
})();
