/**
 * API service boundary.
 *
 * This site is a static GitHub Pages frontend. Authentication, license
 * validation, key generation, and payments MUST be performed server-side.
 * Never place private credentials, signing keys, or trusted authorization
 * decisions in this file.
 */

const API_CONFIG = Object.freeze({
    BASE_URL: 'https://api.yourdomain.com',
    ENDPOINTS: Object.freeze({
        CLAIM_KEY: '/api/keys/claim',
        VALIDATE_LICENSE: '/api/license/validate',
        CREATE_STRIPE_SESSION: '/api/store/checkout',
        CRYPTO_PAYMENT: '/api/store/crypto'
    })
});

const ApiService = {
    async claimFreeKey(token) {
        if (!token || typeof token !== 'string' || token.length > 2048) {
            throw new Error('Invalid or expired token. Please complete the Work.ink task again.');
        }

        // Never mint a real license key from public client-side code.
        // Until the backend endpoint exists, fail closed.
        throw new Error('Free-key verification is temporarily unavailable. Please try again later.');
    },

    async checkLicenseStatus(key) {
        if (!key || typeof key !== 'string' || key.length > 256) {
            return { success: false, status: 'Invalid', expiry: 'N/A' };
        }

        // License status is security-sensitive and must come from the backend.
        throw new Error('License verification is temporarily unavailable. Please try again later.');
    },

    async createCheckoutSession(productId) {
        if (!productId || typeof productId !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(productId)) {
            throw new Error('Invalid product.');
        }

        // Stripe secret keys belong on the backend. Do not return a fake or
        // attacker-controlled checkout URL from a static frontend.
        throw new Error('Checkout is temporarily unavailable. Please try again later.');
    }
};
