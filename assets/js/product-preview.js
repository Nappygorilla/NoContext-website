(() => {
  'use strict';

  const initProductPreview = () => {
    const timing = document.getElementById('timing-demo');
    if (!timing || document.getElementById('nc-product-preview')) return;

    const style = document.createElement('style');
    style.textContent = `
      .nc-preview-shell{overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:#080a0b;box-shadow:0 35px 100px rgba(0,0,0,.32)}
      .nc-preview-topbar,.nc-preview-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07);font:600 .66rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
      .nc-preview-footer{border-top:1px solid rgba(255,255,255,.07);border-bottom:0;color:#59615e}
      .nc-preview-brand{display:flex;align-items:center;gap:10px;color:#e9eeeb}
      .nc-preview-mark{display:grid;place-items:center;width:25px;height:25px;border:1px solid rgba(184,255,61,.45);border-radius:7px;color:#b8ff3d;font-size:.55rem}
      .nc-preview-status{color:#b8ff3d}.nc-preview-status i{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:#b8ff3d;box-shadow:0 0 12px rgba(184,255,61,.45)}.nc-preview-status span{margin-left:8px;color:#59615e}
      .nc-preview-layout{display:grid;grid-template-columns:170px minmax(0,1fr);min-height:390px}.nc-preview-sidebar{padding:18px 12px;border-right:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.012)}
      .nc-preview-tab{display:block;width:100%;padding:11px 12px;margin-bottom:5px;border:1px solid transparent;border-radius:9px;background:transparent;color:#69716e;text-align:left;font:600 .72rem ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;transition:.2s}
      .nc-preview-tab:hover{color:#e7ece9;background:rgba(255,255,255,.035)}.nc-preview-tab.active{color:#b8ff3d;background:rgba(184,255,61,.065);border-color:rgba(184,255,61,.12)}
      .nc-preview-main{padding:24px;min-width:0}.nc-preview-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.nc-preview-kicker{display:block;color:#59615e;font:600 .6rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.nc-preview-heading h3{margin:7px 0 0;color:#eef2ef;font-size:1.35rem;letter-spacing:-.03em}.nc-preview-live{color:#65706b;font:600 .58rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}
      .nc-preview-content{display:grid;gap:9px}.nc-preview-card{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:68px;padding:15px 16px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.nc-preview-card strong{display:block;color:#e9eeeb;font-size:.78rem}.nc-preview-card small{display:block;margin-top:5px;color:#606965;font-size:.66rem}
      .nc-toggle{position:relative;width:38px;height:22px;flex:0 0 auto;border:1px solid #343b38;border-radius:999px;background:#151918;cursor:pointer;transition:.2s}.nc-toggle span{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#6a736f;transition:.2s}.nc-toggle.active{border-color:rgba(184,255,61,.35);background:rgba(184,255,61,.12)}.nc-toggle.active span{left:19px;background:#b8ff3d;box-shadow:0 0 12px rgba(184,255,61,.35)}
      @media(max-width:700px){.nc-preview-layout{grid-template-columns:1fr}.nc-preview-sidebar{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07);padding:10px}.nc-preview-tab{margin:0;padding:9px 6px;text-align:center;font-size:.6rem}.nc-preview-main{padding:16px}.nc-preview-footer span:nth-child(2){display:none}}
    `;
    document.head.appendChild(style);

    const section = document.createElement('section');
    section.className = 'section nc-product-section';
    section.id = 'nc-product-preview';
    section.innerHTML = `
      <div class="container">
        <div class="section-title">
          <h2>See the product.</h2>
          <p>An interactive preview of the NoContext External interface.</p>
        </div>
        <div class="nc-preview-shell">
          <div class="nc-preview-topbar">
            <div class="nc-preview-brand"><span class="nc-preview-mark">NC</span><span>NoContext External</span></div>
            <div class="nc-preview-status"><i></i> RUNNING <span>v1.0</span></div>
          </div>
          <div class="nc-preview-layout">
            <aside class="nc-preview-sidebar">
              <button class="nc-preview-tab active" data-tab="combat">Combat</button>
              <button class="nc-preview-tab" data-tab="visuals">Visuals</button>
              <button class="nc-preview-tab" data-tab="misc">Misc</button>
              <button class="nc-preview-tab" data-tab="settings">Settings</button>
            </aside>
            <main class="nc-preview-main">
              <div class="nc-preview-heading"><div><span class="nc-preview-kicker">NO_CONTEXT / EXTERNAL</span><h3 id="nc-preview-title">Combat</h3></div><span class="nc-preview-live">LIVE PREVIEW</span></div>
              <div class="nc-preview-content" data-panel="combat">
                <div class="nc-preview-card"><div><strong>Aim Assist</strong><small>Targeting assistance</small></div><button class="nc-toggle active" type="button"><span></span></button></div>
                <div class="nc-preview-card"><div><strong>Trigger Assist</strong><small>Input response control</small></div><button class="nc-toggle" type="button"><span></span></button></div>
              </div>
              <div class="nc-preview-content" data-panel="visuals" hidden>
                <div class="nc-preview-card"><div><strong>ESP</strong><small>On-screen player information</small></div><button class="nc-toggle active" type="button"><span></span></button></div>
                <div class="nc-preview-card"><div><strong>Overlay</strong><small>Preview visual settings</small></div><button class="nc-toggle" type="button"><span></span></button></div>
              </div>
              <div class="nc-preview-content" data-panel="misc" hidden>
                <div class="nc-preview-card"><div><strong>Performance Mode</strong><small>Reduce visual overhead</small></div><button class="nc-toggle active" type="button"><span></span></button></div>
                <div class="nc-preview-card"><div><strong>Notifications</strong><small>Product status messages</small></div><button class="nc-toggle" type="button"><span></span></button></div>
              </div>
              <div class="nc-preview-content" data-panel="settings" hidden>
                <div class="nc-preview-card"><div><strong>Interface Scale</strong><small>Adjust the desktop surface</small></div><input type="range" min="80" max="120" value="100" aria-label="Interface Scale"></div>
                <div class="nc-preview-card"><div><strong>Configuration</strong><small>Current profile</small></div><strong>Default</strong></div>
              </div>
            </main>
          </div>
          <div class="nc-preview-footer"><span>DESKTOP / WINDOWS</span><span>INTERFACE PREVIEW</span><span id="nc-preview-interaction">Select a section</span></div>
        </div>
      </div>`;

    timing.parentNode.insertBefore(section, timing);

    const tabs = Array.from(section.querySelectorAll('.nc-preview-tab'));
    const panels = Array.from(section.querySelectorAll('.nc-preview-content'));
    const title = section.querySelector('#nc-preview-title');
    const interaction = section.querySelector('#nc-preview-interaction');
    const names = { combat: 'Combat', visuals: 'Visuals', misc: 'Misc', settings: 'Settings' };

    const selectTab = (tab) => {
      const name = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
      title.textContent = names[name] || 'Preview';
      interaction.textContent = `${names[name] || 'Preview'} selected`;
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
    section.querySelectorAll('.nc-toggle').forEach((toggle) => {
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
