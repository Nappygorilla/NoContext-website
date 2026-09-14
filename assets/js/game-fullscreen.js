(() => {
  const init = () => {
    const gamesPage = document.querySelector('.games-page');
    if (!gamesPage) return;
    if (!document.getElementById('nc-game-fullscreen-style')) {
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
    }
    const addButton = (card) => {
      if (!card || card.querySelector('.nc-fullscreen-btn')) return;
      const actions = card.querySelector('.game-actions');
      if (!actions) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'nc-fullscreen-btn';
      button.setAttribute('aria-label','Open game fullscreen'); button.title='Fullscreen';
      button.innerHTML='<i class="fas fa-expand"></i>'; actions.appendChild(button);
      const close=()=>{card.classList.remove('nc-game-fullscreen');document.body.classList.remove('nc-game-fullscreen-open');button.innerHTML='<i class="fas fa-expand"></i>';button.title='Fullscreen';};
      const open=async()=>{card.classList.add('nc-game-fullscreen');document.body.classList.add('nc-game-fullscreen-open');button.innerHTML='<i class="fas fa-compress"></i>';button.title='Exit fullscreen';try{if(card.requestFullscreen)await card.requestFullscreen()}catch(_) {}};
      button.addEventListener('click',()=>card.classList.contains('nc-game-fullscreen')?close():open());
      document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==card&&card.classList.contains('nc-game-fullscreen'))close()});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&card.classList.contains('nc-game-fullscreen'))close()});
    };
    gamesPage.querySelectorAll('.game-card').forEach(addButton);

    // Standalone browser game runtime. This deliberately does not depend on main.js or the older inline game script.
    if (gamesPage.dataset.ncGamesFixed === '1') return;
    gamesPage.dataset.ncGamesFixed = '1';
    const $=id=>document.getElementById(id), has=id=>!!$(id);
    const tabs=[...document.querySelectorAll('.game-tab')],cards=[...document.querySelectorAll('.game-card')];
    function activate(name){tabs.forEach(t=>t.classList.toggle('active',t.dataset.game===name));cards.forEach(c=>c.classList.toggle('active',c.dataset.card===name));}
    tabs.forEach(t=>t.addEventListener('click',()=>activate(t.dataset.game)));

    // Flappy Bird
    if(has('flappy')){
      const c=$('flappy'),ctx=c.getContext('2d'); let bird={x:180,y:260,vy:0},pipes=[],run=false,score=0,last=0,raf=0;
      const bestKey='nc-flappy-best';let best=Number(localStorage.getItem(bestKey)||0);$('best').textContent=best;
      function pipe(){const gap=155,top=70+Math.random()*210;pipes.push({x:720,top,bottom:top+gap,passed:false});}
      function draw(){ctx.fillStyle='#11151f';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#171d2b';ctx.fillRect(0,445,c.width,35);pipes.forEach(p=>{ctx.fillStyle='#8b5cf6';ctx.fillRect(p.x,0,72,p.top);ctx.fillRect(p.x,p.bottom,72,445-p.bottom)});ctx.fillStyle='#c4b5fd';ctx.beginPath();ctx.arc(bird.x,bird.y,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bird.x+6,bird.y-5,4,0,Math.PI*2);ctx.fill();}
      function start(){cancelAnimationFrame(raf);bird={x:180,y:260,vy:0};pipes=[];score=0;run=true;last=performance.now();$('score').textContent='0';$('panelTitle').textContent='Flappy Bird';$('panelText').textContent='Playing';$('overlay').style.display='none';pipe();pipe();raf=requestAnimationFrame(loop)}
      function flap(){if(!run)start();bird.vy=-390;}
      function loop(now){if(!run)return;const dt=Math.min(.03,(now-last)/1000);last=now;bird.vy+=1050*dt;bird.y+=bird.vy*dt;pipes.forEach(p=>p.x-=235*dt);if(pipes.length&&pipes[pipes.length-1].x<430)pipe();pipes.forEach(p=>{if(!p.passed&&p.x+72<bird.x){p.passed=true;score++;$('score').textContent=score}});const dead=bird.y<17||bird.y>445||pipes.some(p=>bird.x+17>p.x&&bird.x-17<p.x+72&&(bird.y-17<p.top||bird.y+17>p.bottom));draw();if(dead){run=false;best=Math.max(best,score);localStorage.setItem(bestKey,best);$('best').textContent=best;$('overlay').style.display='flex';$('panelTitle').textContent='Game Over';$('panelText').textContent='Score '+score+' · press Start to play again';}else raf=requestAnimationFrame(loop)}
      $('startBtn').onclick=start;c.addEventListener('pointerdown',flap);window.addEventListener('keydown',e=>{if(e.code==='Space'&&$('flappy')?.offsetParent!==null){e.preventDefault();flap()}});draw();
    }

    // Snake
    if(has('snakeCanvas')){
      const c=$('snakeCanvas'),ctx=c.getContext('2d');let snake=[],food={x:5,y:5},dir={x:1,y:0},next={x:1,y:0},timer=0,score=0,best=Number(localStorage.getItem('nc-snake-best')||0);$('snakeBest').textContent=best;
      function newFood(){do{food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}while(snake.some(p=>p.x===food.x&&p.y===food.y));}
      function drawSnake(){ctx.fillStyle='#0b0d10';ctx.fillRect(0,0,500,500);ctx.strokeStyle='rgba(255,255,255,.04)';for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(i*25,0);ctx.lineTo(i*25,500);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*25);ctx.lineTo(500,i*25);ctx.stroke();}ctx.fillStyle='#c4b5fd';ctx.fillRect(food.x*25+5,food.y*25+5,15,15);snake.forEach((p,i)=>{ctx.fillStyle=i?'#8b5cf6':'#b8ff3d';ctx.fillRect(p.x*25+2,p.y*25+2,21,21)});}
      function startSnake(){clearInterval(timer);snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];dir={x:1,y:0};next={x:1,y:0};score=0;$('snakeScore').textContent='0';$('snakeMessage').textContent='Playing';newFood();drawSnake();timer=setInterval(stepSnake,120)}
      function stepSnake(){dir=next;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.x>=20||h.y<0||h.y>=20||snake.some(p=>p.x===h.x&&p.y===h.y)){clearInterval(timer);best=Math.max(best,score);localStorage.setItem('nc-snake-best',best);$('snakeBest').textContent=best;$('snakeMessage').textContent='Game over — press Start Snake';return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;$('snakeScore').textContent=score;newFood()}else snake.pop();drawSnake()}
      function setDir(name){const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name];if(m&&!(m.x===-dir.x&&m.y===-dir.y))next=m;}
      $('snakeStart').onclick=startSnake;document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>setDir(b.dataset.dir));window.addEventListener('keydown',e=>{if(!document.querySelector('[data-card="snake"]')?.classList.contains('active'))return;const k=e.key.toLowerCase();if(k==='w'||e.key==='ArrowUp')setDir('up');if(k==='s'||e.key==='ArrowDown')setDir('down');if(k==='a'||e.key==='ArrowLeft')setDir('left');if(k==='d'||e.key==='ArrowRight')setDir('right')});$('snakeMessage').textContent='Press Start Snake';drawSnake();
    }

    // Baseball
    if(has('baseballBall')){
      let active=false,start=0,raf=0,hits=0,runs=0;const ball=$('baseballBall');
      function pitch(){if(active)return;active=true;start=performance.now();ball.style.display='block';$('baseballMessage').textContent='Watch the ball…';const frame=now=>{const t=Math.min(1,(now-start)/850);ball.style.left='calc(50% + '+((t-.5)*34)+'px)';ball.style.bottom=(82+t*250)+'px';if(t<1)raf=requestAnimationFrame(frame);else{active=false;ball.style.display='none';$('baseballMessage').textContent='Strike — pitch again.';}};raf=requestAnimationFrame(frame)}
      function swing(){if(!active){$('baseballMessage').textContent='Pitch first.';return;}const t=Math.min(1,(performance.now()-start)/850);cancelAnimationFrame(raf);active=false;ball.style.display='none';const d=Math.abs(t-.82);if(d<.15){hits++;if(d<.055)runs++;$('baseHits').textContent=hits;$('baseRuns').textContent=runs;$('baseballMessage').textContent=d<.055?'Home run!':'Base hit!';}else $('baseballMessage').textContent='Missed — pitch again.'}
      $('pitchBtn').onclick=pitch;$('swingBtn').onclick=swing;window.addEventListener('keydown',e=>{if(e.code==='Space'&&document.querySelector('[data-card="baseball"]')?.classList.contains('active')){e.preventDefault();swing()}});
    }

    // Tetris
    if(has('tetrisCanvas')){
      const c=$('tetrisCanvas'),ctx=c.getContext('2d'),shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];let board=[],piece=null,x=3,y=0,run=false,paused=false,timer=0,score=0,lines=0;
      function initT(){board=Array.from({length:20},()=>Array(10).fill(0));piece=null;x=3;y=0;score=0;lines=0;$('tetrisScore').textContent='0';$('tetrisLines').textContent='0'}
      function collide(px,py,m){for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]&&(px+c<0||px+c>=10||py+r>=20||(py+r>=0&&board[py+r][px+c])))return true;return false}
      function spawn(){piece=shapes[Math.floor(Math.random()*shapes.length)].map(row=>row.slice());x=Math.floor((10-piece[0].length)/2);y=0;if(collide(x,y,piece)){run=false;clearInterval(timer);$('tetrisMessage').textContent='Game over — press Start Tetris.'}}
      function rotate(m){return m[0].map((_,i)=>m.map(row=>row[i]).reverse())}
      function merge(){piece.forEach((row,r)=>row.forEach((v,c)=>{if(v&&y+r>=0)board[y+r][x+c]=1}))}
      function clearLines(){const keep=board.filter(r=>r.some(v=>!v));const n=20-keep.length;if(n){lines+=n;score+=[0,100,300,500,800][n]||800;$('tetrisLines').textContent=lines;$('tetrisScore').textContent=score}while(keep.length<20)keep.unshift(Array(10).fill(0));board=keep}
      function tetrisDraw(){ctx.fillStyle='#0b0d10';ctx.fillRect(0,0,300,600);for(let r=0;r<20;r++)for(let c=0;c<10;c++){ctx.strokeStyle='rgba(255,255,255,.04)';ctx.strokeRect(c*30,r*30,30,30);if(board[r][c]){ctx.fillStyle='#8b5cf6';ctx.fillRect(c*30+2,r*30+2,26,26)}}if(piece)for(let r=0;r<piece.length;r++)for(let c=0;c<piece[r].length;c++)if(piece[r][c]){ctx.fillStyle='#c4b5fd';ctx.fillRect((x+c)*30+2,(y+r)*30+2,26,26)}}
      function drop(){if(!run||paused)return;if(!collide(x,y+1,piece))y++;else{merge();clearLines();spawn()}tetrisDraw()}
      function startT(){clearInterval(timer);initT();run=true;paused=false;$('tetrisMessage').textContent='Playing';$('tetrisPause').textContent='Pause';spawn();tetrisDraw();timer=setInterval(drop,450)}
      $('tetrisStart').onclick=startT;$('tetrisPause').onclick=()=>{if(run){paused=!paused;$('tetrisPause').textContent=paused?'Resume':'Pause'}};window.addEventListener('keydown',e=>{if(!document.querySelector('[data-card="tetris"]')?.classList.contains('active')||!run||!piece)return;if(e.key==='ArrowLeft'&&!collide(x-1,y,piece)){x--;tetrisDraw()}if(e.key==='ArrowRight'&&!collide(x+1,y,piece)){x++;tetrisDraw()}if(e.key==='ArrowDown')drop();if(e.key==='ArrowUp'){const m=rotate(piece);if(!collide(x,y,m)){piece=m;tetrisDraw()}}if(e.code==='Space'){e.preventDefault();while(!collide(x,y+1,piece))y++;drop()}});initT();tetrisDraw();
    }

    // Minesweeper
    if(has('mineGrid')){
      const grid=$('mineGrid');let size=10,mines=12,cells=[];
      function resetMines(){size=$('mineDifficulty')?.value==='intermediate'?14:10;mines=size===14?28:12;grid.style.gridTemplateColumns=`repeat(${size},1fr)`;cells=Array.from({length:size*size},()=>({mine:false,rev:false,flag:false,n:0}));let p=0;while(p<mines){const i=Math.floor(Math.random()*cells.length);if(!cells[i].mine){cells[i].mine=true;p++}}for(let i=0;i<cells.length;i++){const r=Math.floor(i/size),c=i%size;let n=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(rr>=0&&rr<size&&cc>=0&&cc<size&&cells[rr*size+cc].mine)n++}cells[i].n=n}renderMines();$('mineMessage').textContent='Left click to reveal. Right click to flag.'}
      function renderMines(){grid.innerHTML='';cells.forEach((cell,i)=>{const b=document.createElement('button');b.type='button';b.className='mine-cell'+(cell.rev?' revealed':'')+(cell.flag&&!cell.rev?' flag':'')+(cell.rev&&cell.mine?' mine':'');b.textContent=cell.flag&&!cell.rev?'⚑':cell.rev?(cell.mine?'✹':cell.n||''):'';b.onclick=()=>reveal(i);b.oncontextmenu=e=>{e.preventDefault();if(!cell.rev){cell.flag=!cell.flag;renderMines()}};grid.appendChild(b)})}
      function reveal(i){const cell=cells[i];if(cell.rev||cell.flag)return;if(cell.mine){cells.forEach(c=>{if(c.mine)c.rev=true});renderMines();$('mineMessage').textContent='Board lost — click New Board.';return}const stack=[i],seen=new Set();while(stack.length){const idx=stack.pop();if(seen.has(idx))continue;seen.add(idx);const c=cells[idx];if(c.rev||c.flag||c.mine)continue;c.rev=true;if(c.n===0){const r=Math.floor(idx/size),col=idx%size;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=col+dc;if(rr>=0&&rr<size&&cc>=0&&cc<size)stack.push(rr*size+cc)}}}renderMines();if(cells.every(c=>c.mine||c.rev))$('mineMessage').textContent='You cleared the board!'}
      $('mineNew').onclick=resetMines;$('mineDifficulty').onchange=resetMines;resetMines();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();