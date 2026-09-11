async function purchase(productId) {
    const overlay = document.getElementById('payment-overlay');
    overlay.style.display = 'flex';

    try {
        const response = await ApiService.createCheckoutSession(productId);
        if (response.success && typeof response.url === 'string') {
            const checkoutUrl = new URL(response.url, window.location.origin);
            if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
                throw new Error('Invalid checkout destination.');
            }
            window.location.assign(checkoutUrl.href);
        } else {
            throw new Error('Failed to initialize checkout.');
        }
    } catch (err) {
        console.error('Checkout initialization failed.');
        alert('Checkout is temporarily unavailable. Please try again later.');
        overlay.style.display = 'none';
    }
}

function purchaseCrypto(productId) {
    void productId;
    alert('Crypto payments are currently being integrated. Please use Stripe for now or contact support in Discord.');
}
