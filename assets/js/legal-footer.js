(() => {
  const base = '/NoContext-website/';
  const links = [
    ['Privacy', 'privacy'],
    ['Terms', 'terms'],
    ['Refund Policy', 'refunds'],
    ['Acceptable Use', 'acceptable-use'],
    ['Copyright', 'copyright']
  ];

  function addStyles() {
    if (document.getElementById('luna-legal-footer-style')) return;
    const style = document.createElement('style');
    style.id = 'luna-legal-footer-style';
    style.textContent = `
      .luna-legal-links{margin-top:12px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:7px 12px;color:#626a67;font-size:.72rem;line-height:1.6}
      .luna-legal-links a{color:#7d8581;text-decoration:none;transition:color .2s ease}
      .luna-legal-links a:hover{color:var(--accent,#b8ff3d)}
      .luna-legal-links .sep{color:#39403d;user-select:none}
      @media(max-width:520px){.luna-legal-links{gap:5px 9px;font-size:.68rem}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    addStyles();
    let footer = document.querySelector('footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.innerHTML = '<div class="container"></div>';
      document.body.appendChild(footer);
    }
    const container = footer.querySelector('.container') || footer;
    if (container.querySelector('.luna-legal-links')) return;

    const row = document.createElement('div');
    row.className = 'luna-legal-links';
    links.forEach(([label, route], index) => {
      if (index) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '·';
        row.appendChild(sep);
      }
      const a = document.createElement('a');
      a.href = base + route;
      a.textContent = label;
      row.appendChild(a);
    });
    container.appendChild(row);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
