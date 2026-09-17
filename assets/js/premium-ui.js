(() => {
  'use strict';

  const BASE = '/NoContext-website/';
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function addPageChrome() {
    document.documentElement.classList.add('nc-premium-ui');
    const main = document.querySelector('main, .hero, header.hero, .section');
    if (main && !main.classList.contains('page-shell')) main.classList.add('page-shell');

    const body = document.body;
    if (!body.querySelector('.nc-topline')) {
      const bar = document.createElement('div');
      bar.className = 'nc-topline';
      bar.innerHTML = '<div class="container"><span><i></i> NoContext system online</span><span>Independent software · Updated regularly</span></div>';
      body.insertBefore(bar, body.firstChild);
    }
  }

  function upgradeFooter() {
    const footer = document.querySelector('footer');
    if (!footer || footer.dataset.premiumFooter === 'true') return;
    footer.dataset.premiumFooter = 'true';
    footer.innerHTML = `
      <div class="container">
        <div class="nc-pro-footer">
          <div class="nc-pro-footer-brand">
            <h3><i class="fas fa-cube"></i> NoContext</h3>
            <p>Focused software, browser experiences and tools built with a deliberate interface, useful features and minimal noise.</p>
            <span class="nc-footer-status"><i></i> All systems operational</span>
          </div>
          <div class="nc-footer-col"><h4>Products</h4><a href="${BASE}store/">Store</a><a href="${BASE}features/">Features</a><a href="${BASE}browser-games/">Browser Games</a><a href="${BASE}developer-api/">Developer API</a></div>
          <div class="nc-footer-col"><h4>Company</h4><a href="${BASE}about/">About</a><a href="${BASE}updates/">Updates</a><a href="${BASE}faq/">FAQ</a><a href="${BASE}contact/">Contact</a></div>
          <div class="nc-footer-col"><h4>Legal</h4><a href="${BASE}privacy/">Privacy</a><a href="${BASE}terms/">Terms</a><a href="${BASE}acceptable-use/">Acceptable Use</a><a href="${BASE}copyright/">Copyright</a></div>
        </div>
        <div class="nc-footer-bottom">
          <span>© 2026 NoContext. All rights reserved.</span>
          <span><a href="${BASE}status/">System Status</a><a href="https://discord.gg/GrD3C722nC" rel="noopener noreferrer">Discord</a></span>
        </div>
      </div>`;
  }

  function addSectionLabels() {
    document.querySelectorAll('.section-title').forEach((section, index) => {
      if (section.querySelector('.nc-section-label')) return;
      const heading = section.querySelector('h2,h1');
      if (!heading) return;
      const label = document.createElement('div');
      label.className = 'nc-section-label';
      label.textContent = String(index + 1).padStart(2, '0') + ' / NOCONTEXT';
      heading.before(label);
    });
  }

  function improveLinks() {
    document.querySelectorAll('a.btn-primary,a.btn-outline').forEach(a => {
      if (!a.getAttribute('aria-label') && !a.textContent.trim()) a.setAttribute('aria-label','Open link');
    });
  }

  function init() {
    addPageChrome();
    upgradeFooter();
    addSectionLabels();
    improveLinks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
