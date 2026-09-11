(() => {
    const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
    const userLabel = document.querySelector('[data-account-user]');
    const emailLabel = document.querySelector('[data-account-email]');
    const logout = document.querySelector('[data-account-logout]');
    const state = document.querySelector('[data-account-state]');
    if (!configured) {
        state && (state.textContent = 'Backend not configured');
        return;
    }

    let csrfToken = sessionStorage.getItem('nocontext_csrf') || '';

    const request = async (path, options = {}) => {
        const response = await fetch(`${configured}${path}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Request failed.');
        return data;
    };

    (async () => {
        try {
            const data = await request('/api/auth/me');
            if (!data.authenticated) {
                sessionStorage.removeItem('nocontext_csrf');
                location.replace('login.html');
                return;
            }
            csrfToken = data.csrfToken || csrfToken;
            if (csrfToken) sessionStorage.setItem('nocontext_csrf', csrfToken);
            if (userLabel) userLabel.textContent = data.user.username;
            if (emailLabel) emailLabel.textContent = data.user.email;
            if (state) state.textContent = 'Signed in';
        } catch (error) {
            if (state) state.textContent = error instanceof Error ? error.message : 'Unable to load account.';
        }
    })();

    logout?.addEventListener('click', async () => {
        logout.disabled = true;
        try {
            await request('/api/auth/logout', { method: 'POST' });
            sessionStorage.removeItem('nocontext_csrf');
            location.replace('login.html');
        } catch (error) {
            if (state) state.textContent = error instanceof Error ? error.message : 'Unable to sign out.';
            logout.disabled = false;
        }
    });
})();
