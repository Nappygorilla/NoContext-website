(() => {
  const install = () => {
    const card = document.getElementById('nc-snake-card');
    const canvas = document.getElementById('snakeCanvas');
    if (!card || !canvas || card.dataset.renderFixInstalled) return;
    card.dataset.renderFixInstalled = '1';

    const wrap = card.querySelector('.snake-wrap');
    if (wrap) {
      wrap.style.background = '#090c0d';
      wrap.style.boxShadow = 'inset 0 0 0 2px rgba(184,255,61,.25)';
    }

    // Keep the board boundary obvious after entering fullscreen.
    const syncFullscreen = () => {
      const full = document.fullscreenElement === card || document.fullscreenElement === wrap;
      card.classList.toggle('snake-fullscreen', full);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
  new MutationObserver(install).observe(document.documentElement, {childList:true, subtree:true});
})();
