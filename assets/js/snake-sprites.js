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

    const sprite = { apple:[0,191], bodyHorizontal:[64,0], bodyVertical:[128,64], corner:[0,0], headUp:[191,0], headRight:[256,0], headDown:[256,64], headLeft:[191,64], tailUp:[191,128], tailRight:[256,128], tailDown:[256,191], tailLeft:[192,192] };

    const reset = () => {
      snake = [{x:7,y:10},{x:8,y:10},{x:9,y:10}]; direction={x:1,y:0}; queued={x:1,y:0}; score=0; scoreEl.textContent='0'; food=spawnFood(); running=false; overlay.style.display='flex'; title.textContent='Snake'; text.textContent=image.complete?'Real sprite artwork loaded.':'Loading sprite artwork…'; startBtn.textContent='Start Game'; draw();
    };
    const spawnFood = () => { let p; do { p={x:Math.floor(Math.random()*GRID),y:Math.floor(Math.random()*GRID)}; } while(snake&&snake.some(s=>s.x===p.x&&s.y===p.y)); return p; };
    const keyDirection = key => ({ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}})[key];
    const setDirection = next => { if(!next||(next.x===-direction.x&&next.y===-direction.y))return; queued=next; };
    const startGame = () => { if(!running){ reset(); running=true; overlay.style.display='none'; startBtn.textContent='Restart'; timer=window.setInterval(step,TICK_MS); } };
    const endGame = () => { running=false; clearInterval(timer); best=Math.max(best,score); localStorage.setItem('nc-snake-best',String(best)); bestEl.textContent=best; title.textContent='Game Over'; text.textContent=`Score ${score} · Beat your best.`; startBtn.textContent='Play Again'; overlay.style.display='flex'; draw(true); };
    const step = () => { direction=queued; const head={x:snake[snake.length-1].x+direction.x,y:snake[snake.length-1].y+direction.y}; if(head.x<0||head.y<0||head.x>=GRID||head.y>=GRID||snake.some(s=>s.x===head.x&&s.y===head.y))return endGame(); snake.push(head); if(head.x===food.x&&head.y===food.y){score++;scoreEl.textContent=score;food=spawnFood();}else snake.shift(); draw(); };
    const drawSprite = (name,gx,gy,angle=0) => { const [sx,sy]=sprite[name],size=canvas.width/GRID,x=gx*size,y=gy*size; if(!angle)return ctx.drawImage(image,sx,sy,SOURCE,SOURCE,x,y,size,size); ctx.save();ctx.translate(x+size/2,y+size/2);ctx.rotate(angle);ctx.drawImage(image,sx,sy,SOURCE,SOURCE,-size/2,-size/2,size,size);ctx.restore(); };
    const directionName = (dx,dy,prefix) => { if(dx===0&&dy<0)return prefix+'Up';if(dx===0&&dy>0)return prefix+'Down';if(dx<0)return prefix+'Left';return prefix+'Right'; };
    const draw = dead => { const size=canvas.width/GRID;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#11151a';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;for(let i=1;i<GRID;i++){ctx.beginPath();ctx.moveTo(i*size,0);ctx.lineTo(i*size,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*size);ctx.lineTo(canvas.width,i*size);ctx.stroke();}if(image.complete&&image.naturalWidth){drawSprite('apple',food.x,food.y);for(let i=0;i<snake.length;i++){const cur=snake[i];if(i===snake.length-1){const prev=snake[Math.max(0,i-1)];drawSprite(directionName(cur.x-prev.x,cur.y-prev.y,'head'),cur.x,cur.y);}else if(i===0){const next=snake[i+1];drawSprite(directionName(next.x-cur.x,next.y-cur.y,'tail'),cur.x,cur.y);}else{const prev=snake[i-1],next=snake[i+1],a={x:cur.x-prev.x,y:cur.y-prev.y},b={x:next.x-cur.x,y:next.y-cur.y};if(a.x===b.x&&a.y===b.y)drawSprite(a.x===0?'bodyVertical':'bodyHorizontal',cur.x,cur.y);else{let angle=0;if((a.x===-1&&b.y===1)||(a.y===-1&&b.x===1))angle=0;else if((a.y===1&&b.x===1)||(a.x===-1&&b.y===-1))angle=Math.PI/2;else if((a.x===1&&b.y===-1)||(a.y===1&&b.x===-1))angle=Math.PI;else angle=Math.PI*1.5;drawSprite('corner',cur.x,cur.y,angle);}}}if(dead){ctx.fillStyle='rgba(4,5,9,.28)';ctx.fillRect(0,0,canvas.width,canvas.height);}}else{ctx.fillStyle='#b8ff3d';snake.forEach(s=>ctx.fillRect(s.x*size+2,s.y*size+2,size-4,size-4));}};
    document.addEventListener('keydown',e=>{const d=keyDirection(e.key);if(!d)return;e.preventDefault();setDirection(d);if(!running)startGame();});
    startBtn.addEventListener('click',()=>{reset();startGame();}); restartBtn.addEventListener('click',()=>{clearInterval(timer);reset();startGame();});
    let touchStart=null;canvas.addEventListener('touchstart',e=>{const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY};},{passive:true});canvas.addEventListener('touchend',e=>{if(!touchStart)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;setDirection(Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)});if(!running)startGame();},{passive:true});
    image.addEventListener('load',draw); reset(); return true;
  };
  const watch=()=>{if(start())return;window.setTimeout(watch,150);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();

  const makeCard = (id,title,desc,html,hint) => { if(document.getElementById(id))return; const container=document.querySelector('.games-page .container'); if(!container)return; const card=document.createElement('div');card.className='game-card';card.id=id;card.innerHTML=`<div class="game-head"><div><h3>${title}</h3><p>${desc}</p></div><div class="game-actions"><div class="game-stats" data-stats></div><button class="icon-btn" type="button" data-restart aria-label="Restart ${title}" title="Restart"><i class="fas fa-rotate-right"></i></button></div></div><div class="game-wrap">${html}</div><div class="game-hint">${hint}</div>`;container.appendChild(card);return card; };

  function initBaseball(){
    const card=makeCard('nc-baseball-card','Baseball','An original timing-based arcade baseball game.','<canvas data-baseball width="900" height="520" aria-label="Baseball game"></canvas><div class="game-overlay" data-overlay><div class="game-panel"><h2>Baseball</h2><p>Watch the pitch and swing at the right moment.</p><button class="btn btn-primary" data-start>Play Ball</button></div></div>','<kbd>SPACE</kbd> / <kbd>CLICK</kbd> / <kbd>TAP</kbd> to swing');
    if(!card)return; const c=card.querySelector('canvas'),x=c.getContext('2d'),overlay=card.querySelector('[data-overlay]'),start=card.querySelector('[data-start]'),restart=card.querySelector('[data-restart]');
    const stats=card.querySelector('[data-stats]');stats.innerHTML='<div class="stat"><small>Runs</small><strong data-runs>0</strong></div><div class="stat"><small>Outs</small><strong data-outs>0</strong></div><div class="stat"><small>Best</small><strong data-best>0</strong></div>';
    const runsEl=card.querySelector('[data-runs]'),outsEl=card.querySelector('[data-outs]'),bestEl=card.querySelector('[data-best]');let run=0,outs=0,best=Number(localStorage.getItem('nc-baseball-best')||0),ball=null,playing=false,last=0,raf=0;bestEl.textContent=best;
    const reset=()=>{run=0;outs=0;ball=null;playing=false;runsEl.textContent='0';outsEl.textContent='0';overlay.style.display='flex';};
    const pitch=()=>{if(!playing){run=0;outs=0;playing=true;overlay.style.display='none';}if(ball)return;ball={x:850,y:285,t:performance.now(),start:performance.now()};};
    const swing=()=>{if(!playing){pitch();return;}if(!ball)return;const age=performance.now()-ball.start;const ideal=900;const diff=Math.abs(age-ideal);if(diff<115){const value=diff<38?4:diff<72?2:1;run+=value;runsEl.textContent=run;best=Math.max(best,run);localStorage.setItem('nc-baseball-best',best);bestEl.textContent=best;}else{outs++;outsEl.textContent=outs;}ball=null;if(outs>=3){playing=false;overlay.querySelector('h2').textContent='Inning Over';overlay.querySelector('p').textContent=`You scored ${run} run${run===1?'':'s'}.`;start.textContent='Play Again';overlay.style.display='flex';}};
    const draw=now=>{x.clearRect(0,0,c.width,c.height);x.fillStyle='#b9d6e8';x.fillRect(0,0,c.width,c.height);x.fillStyle='#5f9b52';x.fillRect(0,330,c.width,190);x.fillStyle='#d8b277';x.beginPath();x.ellipse(450,350,235,110,0,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.beginPath();x.moveTo(450,360);x.lineTo(475,375);x.lineTo(450,390);x.lineTo(425,375);x.closePath();x.fill();x.strokeStyle='#513a2c';x.lineWidth=7;x.beginPath();x.moveTo(275,335);x.lineTo(345,270);x.stroke();x.lineWidth=5;x.beginPath();x.moveTo(345,270);x.lineTo(375,300);x.stroke();x.fillStyle='#222';x.beginPath();x.arc(310,250,28,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.fillRect(295,270,34,70);x.fillStyle='#e34b4b';x.beginPath();x.arc(305,285,5,0,Math.PI*2);x.fill();x.fillStyle='#222';x.beginPath();x.arc(740,235,26,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.fillRect(722,260,36,68);x.fillStyle='#e34b4b';x.beginPath();x.arc(730,278,5,0,Math.PI*2);x.fill();x.fillStyle='#fff';if(ball){const age=now-ball.start,p=Math.min(1,age/1200);ball.x=850-(760*p);ball.y=285+Math.sin(p*Math.PI)*70;x.beginPath();x.arc(ball.x,ball.y,8,0,Math.PI*2);x.fill();if(age>1200){outs++;outsEl.textContent=outs;ball=null;if(outs>=3){playing=false;overlay.querySelector('h2').textContent='Inning Over';overlay.querySelector('p').textContent=`You scored ${run} run${run===1?'':'s'}.`;start.textContent='Play Again';overlay.style.display='flex';}}}x.fillStyle='#17202a';x.font='700 22px system-ui';x.fillText(`RUNS ${run}   OUTS ${outs}/3`,30,45);if(playing)raf=requestAnimationFrame(draw);};
    const begin=()=>{if(raf)cancelAnimationFrame(raf);pitch();last=performance.now();raf=requestAnimationFrame(draw);};start.addEventListener('click',begin);restart.addEventListener('click',()=>{reset();begin();});c.addEventListener('click',swing);document.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();swing();}});c.addEventListener('touchstart',e=>{e.preventDefault();swing();},{passive:false});reset();
  }

  function initBlockBreaker(){
    const card=makeCard('nc-block-breaker-card','Block Breaker','Break every block with the paddle and ball.','<canvas data-breaker width="900" height="520" aria-label="Block Breaker game"></canvas><div class="game-overlay" data-overlay><div class="game-panel"><h2>Block Breaker</h2><p>Move the paddle and clear the board.</p><button class="btn btn-primary" data-start>Start Game</button></div></div>','<kbd>ARROWS</kbd> / <kbd>A D</kbd> / <kbd>MOUSE</kbd> to move');
    if(!card)return;const c=card.querySelector('canvas'),x=c.getContext('2d'),overlay=card.querySelector('[data-overlay]'),start=card.querySelector('[data-start]'),restart=card.querySelector('[data-restart]'),stats=card.querySelector('[data-stats]');stats.innerHTML='<div class="stat"><small>Score</small><strong data-score>0</strong></div><div class="stat"><small>Lives</small><strong data-lives>3</strong></div>';const scoreEl=card.querySelector('[data-score]'),livesEl=card.querySelector('[data-lives]');let paddle,ball,blocks,playing=false,raf=0;
    const reset=()=>{paddle={x:380,w:140};ball={x:450,y:450,vx:260,vy:-300,r:9};blocks=[];for(let r=0;r<5;r++)for(let col=0;col<10;col++)blocks.push({x:55+col*80,y:55+r*30,w:68,h:18,alive:true});scoreEl.textContent='0';livesEl.textContent='3';playing=false;overlay.style.display='flex';};
    const begin=()=>{reset();playing=true;overlay.style.display='none';loop();};
    const loop=()=>{if(!playing)return;const dt=1/60;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;if(ball.x<ball.r||ball.x>c.width-ball.r)ball.vx*=-1;if(ball.y<ball.r)ball.vy=Math.abs(ball.vy);if(ball.y>c.height+30){let lives=Number(livesEl.textContent)-1;livesEl.textContent=lives;if(lives<=0){playing=false;overlay.querySelector('h2').textContent='Game Over';overlay.querySelector('p').textContent=`Score ${scoreEl.textContent}`;start.textContent='Play Again';overlay.style.display='flex';return;}ball={x:450,y:450,vx:260,vy:-300};}if(ball.y+ball.r>=c.height-38&&ball.y<c.height-20&&ball.x>paddle.x&&ball.x<paddle.x+paddle.w){ball.vy=-Math.abs(ball.vy);ball.vx+=(ball.x-(paddle.x+paddle.w/2))*2.2;}for(const b of blocks)if(b.alive&&ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){b.alive=false;ball.vy*=-1;scoreEl.textContent=Number(scoreEl.textContent)+10;break;}x.clearRect(0,0,c.width,c.height);x.fillStyle='#101722';x.fillRect(0,0,c.width,c.height);x.fillStyle='#8fcf43';for(const b of blocks)if(b.alive)x.fillRect(b.x,b.y,b.w,b.h);x.fillStyle='#f2f4f7';x.fillRect(paddle.x,c.height-32,paddle.w,12);x.beginPath();x.arc(ball.x,ball.y,ball.r,0,Math.PI*2);x.fill();if(blocks.every(b=>!b.alive)){playing=false;overlay.querySelector('h2').textContent='Board Cleared';overlay.querySelector('p').textContent=`Score ${scoreEl.textContent}`;start.textContent='Play Again';overlay.style.display='flex';return;}raf=requestAnimationFrame(loop);};
    const move=e=>{const rect=c.getBoundingClientRect();const px=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;paddle.x=Math.max(0,Math.min(c.width-paddle.w,px*(c.width/rect.width)-paddle.w/2));};document.addEventListener('keydown',e=>{if(!playing)return;if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')paddle.x=Math.max(0,paddle.x-35);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')paddle.x=Math.min(c.width-paddle.w,paddle.x+35);});c.addEventListener('mousemove',move);c.addEventListener('touchmove',e=>{e.preventDefault();move(e);},{passive:false});start.addEventListener('click',begin);restart.addEventListener('click',begin);reset();
  }

  function initTetris(){
    const card=makeCard('nc-tetris-card','Tetris','Fit falling pieces together and clear lines.','<canvas data-tetris width="360" height="600" aria-label="Tetris game"></canvas><div class="game-overlay" data-overlay><div class="game-panel"><h2>Tetris</h2><p>Stack pieces, clear lines, keep going.</p><button class="btn btn-primary" data-start>Start Game</button></div></div>','<kbd>← →</kbd> move · <kbd>↑</kbd> rotate · <kbd>↓</kbd> drop');
    if(!card)return;const c=card.querySelector('canvas'),x=c.getContext('2d'),overlay=card.querySelector('[data-overlay]'),start=card.querySelector('[data-start]'),restart=card.querySelector('[data-restart]'),stats=card.querySelector('[data-stats]');stats.innerHTML='<div class="stat"><small>Lines</small><strong data-lines>0</strong></div><div class="stat"><small>Score</small><strong data-score>0</strong></div>';const linesEl=card.querySelector('[data-lines]'),scoreEl=card.querySelector('[data-score]');const cols=10,rows=20,cell=30,shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];let board,piece,playing=false,drop=0,raf=0;
    const clone=s=>s.map(r=>r.slice());const rotate=s=>{const out=s[0].map((_,i)=>s.map(r=>r[i]).reverse());return out;};const collide=(p,dx=0,dy=0,shape=p.shape)=>shape.some((r,y)=>r.some((v,xx)=>v&&(p.x+xx+dx<0||p.x+xx+dx>=cols||p.y+y+dy>=rows||(p.y+y+dy>=0&&board[p.y+y+dy][p.x+xx+dx]))));const spawn=()=>{piece={shape:clone(shapes[Math.floor(Math.random()*shapes.length)]),x:3,y:-1};if(collide(piece)){playing=false;overlay.querySelector('h2').textContent='Game Over';overlay.querySelector('p').textContent=`Score ${scoreEl.textContent}`;start.textContent='Play Again';overlay.style.display='flex';}};const lock=()=>{piece.shape.forEach((r,y)=>r.forEach((v,xx)=>{if(v&&piece.y+y>=0)board[piece.y+y][piece.x+xx]=1;}));let cleared=0;board=board.filter(r=>{if(r.every(Boolean)){cleared++;return false;}return true;});while(board.length<rows)board.unshift(Array(cols).fill(0));linesEl.textContent=Number(linesEl.textContent)+cleared;scoreEl.textContent=Number(scoreEl.textContent)+[0,100,300,500,800][cleared];spawn();};const dropOne=()=>{if(!collide(piece,0,1))piece.y++;else lock();};const draw=()=>{x.clearRect(0,0,c.width,c.height);x.fillStyle='#10131b';x.fillRect(0,0,c.width,c.height);x.strokeStyle='rgba(255,255,255,.08)';for(let i=0;i<=cols;i++){x.beginPath();x.moveTo(i*cell,0);x.lineTo(i*cell,rows*cell);x.stroke();}for(let i=0;i<=rows;i++){x.beginPath();x.moveTo(0,i*cell);x.lineTo(cols*cell,i*cell);x.stroke();}x.fillStyle='#b8ff3d';board.forEach((r,y)=>r.forEach((v,xx)=>{if(v)x.fillRect(xx*cell+2,y*cell+2,cell-4,cell-4);}));if(piece)piece.shape.forEach((r,y)=>r.forEach((v,xx)=>{if(v&&piece.y+y>=0){x.fillStyle='#c7a6ff';x.fillRect((piece.x+xx)*cell+2,(piece.y+y)*cell+2,cell-4,cell-4);}}));};const loop=now=>{if(!playing)return;drop+=now-(loop.last||now);loop.last=now;if(drop>550){drop=0;dropOne();}draw();raf=requestAnimationFrame(loop);};const begin=()=>{if(raf)cancelAnimationFrame(raf);board=Array.from({length:rows},()=>Array(cols).fill(0));piece=null;linesEl.textContent='0';scoreEl.textContent='0';overlay.style.display='none';playing=true;spawn();loop.last=performance.now();raf=requestAnimationFrame(loop);};document.addEventListener('keydown',e=>{if(!playing||!piece)return;if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft'&&!collide(piece,-1))piece.x--;if(e.key==='ArrowRight'&&!collide(piece,1))piece.x++;if(e.key==='ArrowDown')dropOne();if(e.key==='ArrowUp'){const s=rotate(piece.shape);if(!collide(piece,0,0,s))piece.shape=s;}});start.addEventListener('click',begin);restart.addEventListener('click',begin);reset=()=>{board=Array.from({length:rows},()=>Array(cols).fill(0));piece=null;playing=false;linesEl.textContent='0';scoreEl.textContent='0';overlay.style.display='flex';draw();};reset();
  }

  const extras=()=>{if(!document.querySelector('.games-page'))return;initBaseball();initBlockBreaker();initTetris();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(extras,250),{once:true});else setTimeout(extras,250);
})();