(() => {
  const init = () => {
    const gamesPage = document.querySelector('.games-page');
    if (!gamesPage) return;
    if (document.getElementById('nc-game-fullscreen-style')) return;

    const style = document.createElement('style');
    style.id = 'nc-game-fullscreen-style';
    style.textContent = `
      .games-page .game-card{display:block !important}
      .games-page .game-card.active{display:block !important}
      .nc-fullscreen-btn{width:42px;height:42px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.045);color:#fff;cursor:pointer;transition:.2s}
      .nc-fullscreen-btn:hover{transform:translateY(-2px);background:rgba(184,255,61,.1);border-color:rgba(184,255,61,.35)}
      .game-card.nc-game-fullscreen{position:fixed;inset:0;z-index:99999;max-width:none;width:100vw;height:100vh;margin:0;padding:18px;border-radius:0;box-sizing:border-box;overflow:auto;background:#080a0b}
      .game-card.nc-game-fullscreen .game-wrap,.game-card.nc-game-fullscreen .snake-wrap{height:calc(100vh - 150px);max-height:none;display:flex;align-items:center;justify-content:center}
      .game-card.nc-game-fullscreen .game-wrap canvas,.game-card.nc-game-fullscreen .snake-wrap canvas{width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain}
      .game-card.nc-game-fullscreen .game-hint,.game-card.nc-game-fullscreen .snake-hint{padding-bottom:0}
      body.nc-game-fullscreen-open{overflow:hidden}
      @media(max-width:700px){.game-card.nc-game-fullscreen{padding:10px}.game-card.nc-game-fullscreen .game-wrap,.game-card.nc-game-fullscreen .snake-wrap{height:calc(100vh - 190px)}}
    `;
    document.head.appendChild(style);

    const addButton = (card) => {
      if (!card || card.querySelector('.nc-fullscreen-btn')) return;
      const actions = card.querySelector('.game-actions');
      if (!actions) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nc-fullscreen-btn';
      button.setAttribute('aria-label', 'Open game fullscreen');
      button.title = 'Fullscreen';
      button.innerHTML = '<i class="fas fa-expand"></i>';
      actions.appendChild(button);

      const close = () => {
        card.classList.remove('nc-game-fullscreen');
        document.body.classList.remove('nc-game-fullscreen-open');
        button.setAttribute('aria-label', 'Open game fullscreen');
        button.title = 'Fullscreen';
        button.innerHTML = '<i class="fas fa-expand"></i>';
      };

      const open = async () => {
        card.classList.add('nc-game-fullscreen');
        document.body.classList.add('nc-game-fullscreen-open');
        button.setAttribute('aria-label', 'Exit fullscreen');
        button.title = 'Exit fullscreen';
        button.innerHTML = '<i class="fas fa-compress"></i>';
        try {
          if (card.requestFullscreen) await card.requestFullscreen();
        } catch (_) {
          // The fixed-position fallback still provides a fullscreen game surface.
        }
      };

      button.addEventListener('click', () => {
        if (card.classList.contains('nc-game-fullscreen')) close();
        else open();
      });

      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement !== card && card.classList.contains('nc-game-fullscreen')) close();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && card.classList.contains('nc-game-fullscreen')) close();
      });
    };

    const scan = () => gamesPage.querySelectorAll('.game-card').forEach(addButton);
    scan();
    new MutationObserver(scan).observe(gamesPage, {childList:true, subtree:true});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
