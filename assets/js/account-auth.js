(() => {
    const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
    const userLabels = document.querySelectorAll('[data-account-user]');
    const secondaryUser = document.querySelector('[data-account-user-secondary]');
    const emailLabel = document.querySelector('[data-account-email]');
    const idLabel = document.querySelector('[data-account-id]');
    const expiryLabel = document.querySelector('[data-account-expiry]');
    const avatar = document.querySelector('[data-account-avatar]');
    const logout = document.querySelector('[data-account-logout]');
    const state = document.querySelector('[data-account-state]');
    const loading = document.querySelector('[data-account-loading]');
    const licenseList = document.querySelector('[data-license-list]');
    const licenseGenerate = document.querySelector('[data-license-generate]');
    const licenseMessage = document.querySelector('[data-license-message]');

    const redirectToLogin = () => {
        sessionStorage.removeItem('nocontext_csrf');
        location.replace('login.html');
    };

    // This page is private. Without a configured authentication backend there
    // is no trustworthy way to prove that the visitor is logged in.
    if (!configured) {
        redirectToLogin();
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

    const formatExpiry = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    };

    const escapeHtml = (value) => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const renderLicenses = (licenses) => {
        if (!licenseList) return;
        if (!licenses.length) {
            licenseList.innerHTML = '<div class="license-empty">No licenses yet.</div>';
            return;
        }
        licenseList.innerHTML = licenses.map((license) => {
            const status = String(license.status || 'unknown').toLowerCase();
            return `<div class="license-row">
                <div>
                    <div class="license-key">${escapeHtml(license.keyPrefix)}••••••••</div>
                    <div class="license-meta">${escapeHtml(license.product)} · Expires ${escapeHtml(formatExpiry(license.expiresAt))}</div>
                </div>
                <div class="license-status ${escapeHtml(status)}">${escapeHtml(status)}</div>
            </div>`;
        }).join('');
    };

    const loadLicenses = async () => {
        if (!licenseList) return;
        try {
            const data = await request('/api/licenses');
            renderLicenses(Array.isArray(data.licenses) ? data.licenses : []);
        } catch (error) {
            licenseList.innerHTML = '<div class="license-empty">Unable to load licenses.</div>';
        }
    };

    const showLicenseMessage = (message, type = '') => {
        if (!licenseMessage) return;
        licenseMessage.textContent = message;
        licenseMessage.className = `license-message${type ? ` ${type}` : ''}`;
    };

    (async () => {
        try {
            const data = await request('/api/auth/me');
            if (!data.authenticated || !data.user) {
                redirectToLogin();
                return;
            }

            csrfToken = data.csrfToken || csrfToken;
            if (csrfToken) sessionStorage.setItem('nocontext_csrf', csrfToken);

            const username = String(data.user.username || 'User');
            userLabels.forEach((node) => { node.textContent = username; });
            if (secondaryUser) secondaryUser.textContent = username;
            if (emailLabel) emailLabel.textContent = data.user.email || '—';
            if (idLabel) idLabel.textContent = String(data.user.id ?? '—');
            if (expiryLabel) expiryLabel.textContent = formatExpiry(data.sessionExpiresAt);
            if (avatar) avatar.textContent = username.slice(0, 2).toUpperCase();
            if (state) state.textContent = 'Signed in';
            loading?.classList.add('hidden');

            await loadLicenses();
        } catch (error) {
            if (loading) loading.classList.add('hidden');
            if (state) {
                state.textContent = error instanceof Error ? error.message : 'Unable to verify session.';
                state.classList.add('account-error');
            }
            // Authentication failures must fail closed rather than leaving a
            // private dashboard visible to an unverified visitor.
            setTimeout(redirectToLogin, 900);
        }
    })();

    licenseGenerate?.addEventListener('click', async () => {
        licenseGenerate.disabled = true;
        showLicenseMessage('Generating license…');
        try {
            const data = await request('/api/licenses/generate', {
                method: 'POST',
                body: JSON.stringify({ product: 'NoContext External' })
            });
            const key = String(data.key || '');
            // The plaintext key is shown once. It is never fetched from the API again.
            showLicenseMessage(`Your new key: ${key} — copy it now.`, 'success');
            try { await navigator.clipboard.writeText(key); } catch (_) { /* clipboard is optional */ }
            await loadLicenses();
        } catch (error) {
            showLicenseMessage(error instanceof Error ? error.message : 'Unable to generate license.', 'error');
        } finally {
            licenseGenerate.disabled = false;
        }
    });

    logout?.addEventListener('click', async () => {
        logout.disabled = true;
        try {
            await request('/api/auth/logout', { method: 'POST' });
            redirectToLogin();
        } catch (error) {
            if (state) {
                state.textContent = error instanceof Error ? error.message : 'Unable to sign out.';
                state.classList.add('account-error');
            }
            logout.disabled = false;
        }
    });
})();
