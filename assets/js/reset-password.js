(() => {
  const api = String(window.LUNA_API_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');
  const form = document.getElementById('reset-form');
  const status = document.getElementById('status');
  const token = new URLSearchParams(location.search).get('token') || '';
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = form.querySelector('#password').value;
    const confirm = form.querySelector('#confirm').value;
    const button = form.querySelector('button');
    if (password !== confirm) { status.textContent = 'Passwords do not match.'; return; }
    if (!token) { status.textContent = 'This reset link is missing its token.'; return; }
    button.disabled = true;
    status.textContent = 'Updating password…';
    try {
      const response = await fetch(`${api}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Unable to update your password.');
      status.textContent = data.message || 'Password updated. Please sign in.';
      status.dataset.kind = 'success';
      setTimeout(() => location.replace('login.html'), 900);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Unable to update your password.';
    } finally {
      button.disabled = false;
    }
  });
})();
