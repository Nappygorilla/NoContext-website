async function checkStatus() {
    const keyInput = document.getElementById('license-key');
    const resultDiv = document.getElementById('status-result');
    const loading = document.getElementById('loading-status');
    const statusLabel = document.getElementById('status-label');
    const expiryLabel = document.getElementById('expiry-label');

    const key = keyInput.value.trim();
    if (!key) return alert('Please enter a key.');

    // Reset UI
    resultDiv.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await ApiService.checkLicenseStatus(key);
        loading.style.display = 'none';

        statusLabel.innerText = response.status;
        expiryLabel.innerText = response.expiry || 'N/A';

        // Styling based on status
        if (response.status === 'Active') {
            statusLabel.style.color = 'var(--success)';
        } else if (response.status === 'Expired' || response.status === 'Revoked') {
            statusLabel.style.color = 'var(--error)';
        } else {
            statusLabel.style.color = 'var(--text-muted)';
        }

        resultDiv.style.display = 'block';
    } catch (err) {
        loading.style.display = 'none';
        alert('Error communicating with the license server.');
    }
}
