async function purchase(productId) {
    const overlay = document.getElementById('payment-overlay');
    overlay.style.display = 'flex';

    try {
        const response = await ApiService.createCheckoutSession(productId);

        if (response.success && response.url) {
            // In a real app, this redirects the user to Stripe Checkout
            window.location.href = response.url;
        } else {
            alert('Failed to initialize checkout. Please try again later.');
            overlay.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
        alert('An error occurred connecting to the backend.');
        overlay.style.display = 'none';
    }
}

function purchaseCrypto(productId) {
    alert('Crypto payments are currently being integrated. Please use Stripe for now or contact support in Discord.');
    // In production, this would call ApiService.createCryptoInvoice(productId)
    // and show a modal with the wallet address or redirect to a crypto gateway.
}
