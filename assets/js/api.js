/** API boundary for the static GitHub Pages frontend. */
const API_BASE_URL = 'https://nocontext.onrender.com';
const API_CONFIG = Object.freeze({
    BASE_URL: String(window.NO_CONTEXT_API_URL || API_BASE_URL).trim().replace(/\/$/, ''),
    ENDPOINTS: Object.freeze({
        CLAIM_SESSION: '/api/keys/session',
        CLAIM_KEY: '/api/keys/claim',
        WORKINK_START: '/api/keys/workink/start',
        WORKINK_AUTHORIZE: '/api/keys/workink/authorize',
        VALIDATE_LICENSE: '/api/keys/validate',
        DISCORD_START: '/api/keys/discord/start',
        CREATE_STRIPE_SESSION: '/api/store/checkout',
        CRYPTO_PAYMENT: '/api/store/crypto'
    })
});

const ApiService = {
    authToken() { return localStorage.getItem('nocontext_session_token') || ''; },
    csrfToken() { return localStorage.getItem('nocontext_csrf') || sessionStorage.getItem('nocontext_csrf') || ''; },
    authHeaders(extra = {}) {
        const token = this.authToken();
        const csrf = this.csrfToken();
        return { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
    },
    async getKeySession() {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLAIM_SESSION}`, { credentials: 'include', cache: 'no-store', headers: this.authHeaders() });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Unable to initialize key access.');
        return data;
    },

    workinkStartUrl() { return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WORKINK_START}`; },

    async authorizeWorkink(token) {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WORKINK_AUTHORIZE}`, {
            method: 'POST', credentials: 'include', headers: this.authHeaders(), body: JSON.stringify({ token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Unable to verify the Work.ink completion.');
        return data;
    },

    async claimFreeKey(product, grant) {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLAIM_KEY}`, {
            method: 'POST', credentials: 'include', headers: this.authHeaders(), body: JSON.stringify({ product: product || 'NoContext External', grant: grant || '' })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Unable to generate a key.');
        return data;
    },

    discordVerifyUrl() { return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DISCORD_START}`; },

    async checkLicenseStatus(key) {
        if (!key || typeof key !== 'string' || key.length > 256) return { success: false, status: 'Invalid', expiry: 'N/A' };
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE_LICENSE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key.trim(), product: 'NoContext External' }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return { success: false, status: data.detail || 'Invalid', expiry: 'N/A' };
        return { success: Boolean(data.valid), status: data.status || 'Active', expiry: data.expiresAt || 'N/A' };
    },

    async createCheckoutSession(productId) {
        if (!productId || typeof productId !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(productId)) throw new Error('Invalid product.');
        throw new Error('Checkout is temporarily unavailable. Please try again later.');
    }
};
