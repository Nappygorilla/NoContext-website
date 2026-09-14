/**
 * API service boundary for the static GitHub Pages frontend.
 * Authentication, license validation, key generation, and payments are
 * performed by the server-side backend hosted on Render.
 */

const API_BASE_URL = 'https://nocontext-website.onrender.com';

const API_CONFIG = Object.freeze({
    BASE_URL: String(window.NO_CONTEXT_API_URL || API_BASE_URL).trim().replace(/\/$/, ''),
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
        throw new Error('Free-key verification is temporarily unavailable. Please try again later.');
    },

    async checkLicenseStatus(key) {
        if (!key || typeof key !== 'string' || key.length > 256) {
            return { success: false, status: 'Invalid', expiry: 'N/A' };
        }
        throw new Error('License verification is temporarily unavailable. Please try again later.');
    },

    async createCheckoutSession(productId) {
        if (!productId || typeof productId !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(productId)) {
            throw new Error('Invalid product.');
        }
        throw new Error('Checkout is temporarily unavailable. Please try again later.');
    }
};
