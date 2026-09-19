(() => {
  'use strict';

  const initProductPreview = () => {
    const timing = document.getElementById('timing-demo');
    if (!timing || document.getElementById('luna-product-preview')) return;

    const style = document.createElement('style');
    style.textContent = `
      .luna-preview-shell{overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:#080a0b;box-shadow:0 35px 100px rgba(0,0,0,.32)}
      .luna-preview-topbar,.luna-preview-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07);font:600 .66rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
      .luna-preview-footer{border-top:1px solid rgba(255,255,255,.07);border-bottom:0;color:#59615e}
      .luna-preview-brand{display:flex;align-items:center;gap:10px;color:#e9eeeb}
      .luna-preview-mark{display:grid;place-items:center;width:25px;height:25px;border:1px solid rgba(255,255,255,.45);border-radius:7px;color:#ffffff;font-size:.55rem}
      .luna-preview-status{color:#ffffff}.luna-preview-status i{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:#ffffff;box-shadow:0 0 12px rgba(255,255,255,.45)}.luna-preview-status span{margin-left:8px;color:#59615e}
      .luna-preview-layout{display:grid;grid-template-columns:170px minmax(0,1fr);min-height:390px}.luna-preview-sidebar{padding:18px 12px;border-right:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.012)}
      .luna-preview-tab{display:block;width:100%;padding:11px 12px;margin-bottom:5px;border:1px solid transparent;border-radius:9px;background:transparent;color:#69716e;text-align:left;font:600 .72rem ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;transition:.2s}
      .luna-preview-tab:hover{color:#e7ece9;background:rgba(255,255,255,.035)}.luna-preview-tab.active{color:#ffffff;background:rgba(255,255,255,.065);border-color:rgba(255,255,255,.12)}
      .luna-preview-main{padding:24px;min-width:0}.luna-preview-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.luna-preview-kicker{display:block;color:#59615e;font:600 .6rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.luna-preview-heading h3{margin:7px 0 0;color:#eef2ef;font-size:1.35rem;letter-spacing:-.03em}.luna-preview-live{color:#65706b;font:600 .58rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}
      .luna-preview-content{display:grid;gap:9px}.luna-preview-card{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:68px;padding:15px 16px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.luna-preview-card strong{display:block;color:#e9eeeb;font-size:.78rem}.luna-preview-card small{display:block;margin-top:5px;color:#606965;font-size:.66rem}
      .luna-toggle{position:relative;width:38px;height:22px;flex:0 0 auto;border:1px solid #343b38;border-radius:999px;background:#151918;cursor:pointer;transition:.2s}.luna-toggle span{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#6a736f;transition:.2s}.luna-toggle.active{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.12)}.luna-toggle.active span{left:19px;background:#ffffff;box-shadow:0 0 12px rgba(255,255,255,.35)}
      @media(max-width:700px){.luna-preview-layout{grid-template-columns:1fr}.luna-preview-sidebar{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07);padding:10px}.luna-preview-tab{margin:0;padding:9px 6px;text-align:center;font-size:.6rem}.luna-preview-main{padding:16px}.luna-preview-footer span:nth-child(2){display:none}}
    `;
    document.head.appendChild(style);

    const section = document.createElement('section');
    section.className = 'section luna-product-section';
    section.id = 'luna-product-preview';
    section.innerHTML = `
      <div class="container">
        <div class="section-title">
          <h2>See the product.</h2>
          <p>An interactive preview of the luna.win External interface.</p>
        </div>
        <div class="luna-preview-shell">
          <div class="luna-preview-topbar">
            <div class="luna-preview-brand"><span class="luna-preview-mark">NC</span><span>luna.win External</span></div>
            <div class="luna-preview-status"><i></i> RUNNING <span>v1.0</span></div>
          </div>
          <div class="luna-preview-layout">
            <aside class="luna-preview-sidebar">
              <button class="luna-preview-tab active" data-tab="combat">Combat</button>
              <button class="luna-preview-tab" data-tab="visuals">Visuals</button>
              <button class="luna-preview-tab" data-tab="misc">Misc</button>
              <button class="luna-preview-tab" data-tab="settings">Settings</button>
            </aside>
            <main class="luna-preview-main">
              <div class="luna-preview-heading"><div><span class="luna-preview-kicker">NO_CONTEXT / EXTERNAL</span><h3 id="luna-preview-title">Combat</h3></div><span class="luna-preview-live">LIVE PREVIEW</span></div>
              <div class="luna-preview-content" data-panel="combat">
                <div class="luna-preview-card"><div><strong>Aim Assist</strong><small>Targeting assistance</small></div><button class="luna-toggle active" type="button"><span></span></button></div>
                <div class="luna-preview-card"><div><strong>Trigger Assist</strong><small>Input response control</small></div><button class="luna-toggle" type="button"><span></span></button></div>
              </div>
              <div class="luna-preview-content" data-panel="visuals" hidden>
                <div class="luna-preview-card"><div><strong>ESP</strong><small>On-screen player information</small></div><button class="luna-toggle active" type="button"><span></span></button></div>
                <div class="luna-preview-card"><div><strong>Overlay</strong><small>Preview visual settings</small></div><button class="luna-toggle" type="button"><span></span></button></div>
              </div>
              <div class="luna-preview-content" data-panel="misc" hidden>
                <div class="luna-preview-card"><div><strong>Performance Mode</strong><small>Reduce visual overhead</small></div><button class="luna-toggle active" type="button"><span></span></button></div>
                <div class="luna-preview-card"><div><strong>Notifications</strong><small>Product status messages</small></div><button class="luna-toggle" type="button"><span></span></button></div>
              </div>
              <div class="luna-preview-content" data-panel="settings" hidden>
                <div class="luna-preview-card"><div><strong>Interface Scale</strong><small>Adjust the desktop surface</small></div><input type="range" min="80" max="120" value="100" aria-label="Interface Scale"></div>
                <div class="luna-preview-card"><div><strong>Configuration</strong><small>Current profile</small></div><strong>Default</strong></div>
              </div>
            </main>
          </div>
          <div class="luna-preview-footer"><span>DESKTOP / WINDOWS</span><span>INTERFACE PREVIEW</span><span id="luna-preview-interaction">Select a section</span></div>
        </div>
      </div>`;

    timing.parentNode.insertBefore(section, timing);

    const tabs = Array.from(section.querySelectorAll('.luna-preview-tab'));
    const panels = Array.from(section.querySelectorAll('.luna-preview-content'));
    const title = section.querySelector('#luna-preview-title');
    const interaction = section.querySelector('#luna-preview-interaction');
    const names = { combat: 'Combat', visuals: 'Visuals', misc: 'Misc', settings: 'Settings' };

    const selectTab = (tab) => {
      const name = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
      title.textContent = names[name] || 'Preview';
      interaction.textContent = `${names[name] || 'Preview'} selected`;
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
    section.querySelectorAll('.luna-toggle').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        interaction.textContent = toggle.classList.contains('active') ? 'Enabled' : 'Disabled';
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductPreview, { once: true });
  } else {
    initProductPreview();
  }
})();
