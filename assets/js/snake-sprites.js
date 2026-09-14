(() => {
  'use strict';

  const SPRITE_URL = 'assets/games/snake/snake-sprites.png';
  const GRID = 20;
  const SOURCE = 64;
  const TICK_MS = 115;

  const start = () => {
    const card = document.getElementById('nc-snake-card');
    if (!card || card.dataset.spriteSnakeReady === 'true') return Boolean(card);
    card.dataset.spriteSnakeReady = 'true';

    card.innerHTML = `
      <div class="game-head">
        <div><h3>Snake</h3><p>Classic Snake with real sprite-sheet artwork.</p></div>
        <div class="game-actions">
          <div class="game-stats">
            <div class="stat"><small>Score</small><strong data-snake-score>0</strong></div>
            <div class="stat"><small>Best</small><strong data-snake-best>0</strong></div>
          </div>
          <button class="icon-btn" type="button" data-snake-restart aria-label="Restart Snake" title="Restart"><i class="fas fa-rotate-right"></i></button>
        </div>
      </div>
      <div class="game-wrap" data-snake-wrap>
        <canvas data-snake-canvas width="640" height="640" aria-label="Snake game"></canvas>
        <div class="game-overlay" data-snake-overlay>
          <div class="game-panel"><h2 data-snake-title>Snake</h2><p data-snake-text>Real sprite artwork loaded.</p><button class="btn btn-primary" type="button" data-snake-start>Start Game</button></div>
        </div>
      </div>
      <div class="game-hint"><kbd>ARROWS</kbd> / <kbd>WASD</kbd> · Swipe on mobile</div>`;

    const canvas = card.querySelector('[data-snake-canvas]');
    const ctx = canvas.getContext('2d');
    const scoreEl = card.querySelector('[data-snake-score]');
    const bestEl = card.querySelector('[data-snake-best]');
    const overlay = card.querySelector('[data-snake-overlay]');
    const title = card.querySelector('[data-snake-title]');
    const text = card.querySelector('[data-snake-text]');
    const startBtn = card.querySelector('[data-snake-start]');
    const restartBtn = card.querySelector('[data-snake-restart]');
    const image = new Image();
    image.src = SPRITE_URL;

    let snake, food, direction, queued, score = 0, best = Number(localStorage.getItem('nc-snake-best') || 0), running = false, timer = 0;
    bestEl.textContent = best;

    const sprite = {
      apple: [0, 191],
      bodyHorizontal: [64, 0],
      bodyVertical: [128, 64],
      corner: [0, 0],
      headUp: [191, 0],
      headRight: [256, 0],
      headDown: [256, 64],
      headLeft: [191, 64],
      tailUp: [191, 128],
      tailRight: [256, 128],
      tailDown: [256, 191],
      tailLeft: [192, 192]
    };

    const reset = () => {
      snake = [{x: 7,y:10},{x:8,y:10},{x:9,y:10}];
      direction = {x:1,y:0};
      queued = {x:1,y:0};
      score = 0;
      scoreEl.textContent = '0';
      food = spawnFood();
      running = false;
      overlay.style.display = 'flex';
      title.textContent = 'Snake';
      text.textContent = image.complete ? 'Real sprite artwork loaded.' : 'Loading sprite artwork…';
      startBtn.textContent = 'Start Game';
      draw();
    };

    const spawnFood = () => {
      let p;
      do { p = {x: Math.floor(Math.random()*GRID), y: Math.floor(Math.random()*GRID)}; }
      while (snake && snake.some(s => s.x === p.x && s.y === p.y));
      return p;
    };

    const keyDirection = key => ({
      ArrowUp:{x:0,y:-1}, w:{x:0,y:-1},
      ArrowDown:{x:0,y:1}, s:{x:0,y:1},
      ArrowLeft:{x:-1,y:0}, a:{x:-1,y:0},
      ArrowRight:{x:1,y:0}, d:{x:1,y:0}
    })[key];

    const setDirection = next => {
      if (!next || (next.x === -direction.x && next.y === -direction.y)) return;
      queued = next;
    };

    const startGame = () => {
      if (!running) {
        reset();
        running = true;
        overlay.style.display = 'none';
        startBtn.textContent = 'Restart';
        timer = window.setInterval(step, TICK_MS);
      }
    };

    const endGame = () => {
      running = false;
      clearInterval(timer);
      best = Math.max(best, score);
      localStorage.setItem('nc-snake-best', String(best));
      bestEl.textContent = best;
      title.textContent = 'Game Over';
      text.textContent = `Score ${score} · Beat your best.`;
      startBtn.textContent = 'Play Again';
      overlay.style.display = 'flex';
      draw(true);
    };

    const step = () => {
      direction = queued;
      const head = {x: snake[snake.length-1].x + direction.x, y: snake[snake.length-1].y + direction.y};
      if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || snake.some(s => s.x === head.x && s.y === head.y)) return endGame();
      snake.push(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        food = spawnFood();
      } else snake.shift();
      draw();
    };

    const drawSprite = (name, gx, gy, angle = 0) => {
      const [sx, sy] = sprite[name];
      const size = canvas.width / GRID;
      const x = gx * size, y = gy * size;
      if (!angle) return ctx.drawImage(image, sx, sy, SOURCE, SOURCE, x, y, size, size);
      ctx.save();
      ctx.translate(x + size/2, y + size/2);
      ctx.rotate(angle);
      ctx.drawImage(image, sx, sy, SOURCE, SOURCE, -size/2, -size/2, size, size);
      ctx.restore();
    };

    const directionName = (dx, dy, prefix) => {
      if (dx === 0 && dy < 0) return prefix + 'Up';
      if (dx === 0 && dy > 0) return prefix + 'Down';
      if (dx < 0) return prefix + 'Left';
      return prefix + 'Right';
    };

    const draw = dead => {
      const size = canvas.width / GRID;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#11151a';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,.035)';
      ctx.lineWidth = 1;
      for (let i=1;i<GRID;i++) { ctx.beginPath();ctx.moveTo(i*size,0);ctx.lineTo(i*size,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*size);ctx.lineTo(canvas.width,i*size);ctx.stroke(); }
      if (image.complete && image.naturalWidth) {
        drawSprite('apple', food.x, food.y);
        for (let i=0;i<snake.length;i++) {
          const cur = snake[i];
          if (i === snake.length-1) {
            const prev = snake[Math.max(0,i-1)];
            drawSprite(directionName(cur.x-prev.x, cur.y-prev.y, 'head'), cur.x, cur.y);
          } else if (i === 0) {
            const next = snake[i+1];
            drawSprite(directionName(next.x-cur.x, next.y-cur.y, 'tail'), cur.x, cur.y);
          } else {
            const prev = snake[i-1], next = snake[i+1];
            const a = {x:cur.x-prev.x,y:cur.y-prev.y}, b = {x:next.x-cur.x,y:next.y-cur.y};
            if (a.x === b.x && a.y === b.y) drawSprite(a.x === 0 ? 'bodyVertical' : 'bodyHorizontal', cur.x, cur.y);
            else {
              let angle = 0;
              if ((a.x === -1 && b.y === 1) || (a.y === -1 && b.x === 1)) angle = 0;
              else if ((a.y === 1 && b.x === 1) || (a.x === -1 && b.y === -1)) angle = Math.PI/2;
              else if ((a.x === 1 && b.y === -1) || (a.y === 1 && b.x === -1)) angle = Math.PI;
              else angle = Math.PI*1.5;
              drawSprite('corner', cur.x, cur.y, angle);
            }
          }
        }
        if (dead) { ctx.fillStyle='rgba(4,5,9,.28)';ctx.fillRect(0,0,canvas.width,canvas.height); }
      } else {
        ctx.fillStyle='#b8ff3d';
        snake.forEach(s=>ctx.fillRect(s.x*size+2,s.y*size+2,size-4,size-4));
      }
    };

    document.addEventListener('keydown', e => { const d = keyDirection(e.key); if (!d) return; e.preventDefault(); setDirection(d); if (!running) startGame(); });
    startBtn.addEventListener('click', () => { reset(); startGame(); });
    restartBtn.addEventListener('click', () => { clearInterval(timer); reset(); startGame(); });
    let touchStart = null;
    canvas.addEventListener('touchstart', e => { const t=e.changedTouches[0]; touchStart={x:t.clientX,y:t.clientY}; }, {passive:true});
    canvas.addEventListener('touchend', e => { if(!touchStart)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;setDirection(Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)});if(!running)startGame(); }, {passive:true});
    image.addEventListener('load', draw);
    reset();
    return true;
  };

  const watch = () => { if (start()) return; window.setTimeout(watch, 150); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, {once:true}); else watch();
})();
