/**
 * API Service Placeholder
 *
 * Replace the BASE_URL and endpoints with your actual backend logic.
 * Do NOT put secret keys or sensitive data here.
 */

const API_CONFIG = {
    BASE_URL: 'https://api.yourdomain.com', // Replace with your actual backend URL
    ENDPOINTS: {
        CLAIM_KEY: '/api/keys/claim',
        VALIDATE_LICENSE: '/api/license/validate',
        CREATE_STRIPE_SESSION: '/api/store/checkout',
        CRYPTO_PAYMENT: '/api/store/crypto'
    }
};

const ApiService = {
    /**
     * Sends the Work.ink claim token to the backend to get a key
     */
    async claimFreeKey(token) {
        console.log('API call: Claiming key with token:', token);

        // Simulation: Wait for 1.5s
        await new Promise(r => setTimeout(r, 1500));

        // DEMO STATE: Returning a mock response
        // In production, use: return fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLAIM_KEY}`, { ... });

        if (token === 'demo-success') {
            return {
                success: true,
                key: 'FREE-ABCD-1234-XYZ9'
            };
        }

        throw new Error('Invalid or expired token. Please complete the Work.ink task again.');
    },

    /**
     * Checks the status of a license key
     */
    async checkLicenseStatus(key) {
        console.log('API call: Checking license status:', key);

        await new Promise(r => setTimeout(r, 1000));

        // DEMO STATE
        const demoKeys = {
            'VALID-KEY': { status: 'Active', expiry: '2026-12-31' },
            'EXPIRED-KEY': { status: 'Expired', expiry: '2023-01-01' },
            'REVOKED-KEY': { status: 'Revoked', expiry: 'N/A' }
        };

        if (demoKeys[key]) {
            return { success: true, ...demoKeys[key] };
        }

        return { success: false, status: 'Invalid' };
    },

    /**
     * Creates a Stripe Checkout Session via backend
     */
    async createCheckoutSession(productId) {
        console.log('API call: Creating checkout session for:', productId);

        // This MUST be handled by your backend to keep Stripe Secret Keys safe.
        // Your backend will return a URL to redirect the user to.

        await new Promise(r => setTimeout(r, 800));

        // Mocking a redirect to Stripe (or success page for demo)
        return {
            success: true,
            url: 'https://checkout.stripe.com/demo' // Replace with your backend's Stripe URL
        };
    }
};
