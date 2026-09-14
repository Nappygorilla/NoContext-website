(() => {
  const api = String(window.NO_CONTEXT_API_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');
  const form = document.getElementById('forgot-form');
  const status = document.getElementById('status');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = 'Sending…';
    status.dataset.kind = '';
    try {
      const response = await fetch(`${api}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.querySelector('#email').value.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Unable to request a reset link.');
      status.textContent = data.message || 'If that email belongs to an account, a reset link has been sent.';
      status.dataset.kind = 'success';
      form.reset();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Unable to request a reset link.';
    } finally {
      button.disabled = false;
    }
  });
})();
