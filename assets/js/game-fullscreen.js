(() => {
  const init = () => {
    const page = document.querySelector('.games-page');
    if (!page || page.dataset.ncGamesRuntime === '1') return;
    page.dataset.ncGamesRuntime = '1';

    const css = document.createElement('style');
    css.textContent = `
      .games-page .game-card{display:none!important}.games-page .game-card.active{display:block!important}
      .luna-fullscreen-btn{width:42px;height:42px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.045);color:#fff;cursor:pointer}
      .game-card.luna-game-fullscreen{position:fixed!important;inset:0!important;z-index:99999!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;padding:18px!important;overflow:auto;background:#080a0b}
      .game-card.luna-game-fullscreen canvas{max-height:calc(100vh - 180px)} body.luna-game-fullscreen-open{overflow:hidden}
    `;
    document.head.appendChild(css);

    const $ = id => document.getElementById(id);
    const text = (id, value) => { const el=$(id); if(el) el.textContent=value; };

    // Game selector
    const tabs=[...page.querySelectorAll('.game-tab')];
    const cards=[...page.querySelectorAll('.game-card')];
    function showGame(name){tabs.forEach(t=>t.classList.toggle('active',t.dataset.game===name));cards.forEach(c=>c.classList.toggle('active',c.dataset.card===name));}
    tabs.forEach(t=>t.addEventListener('click',()=>showGame(t.dataset.game)));

    // Fullscreen buttons
    cards.forEach(card=>{
      const actions=card.querySelector('.game-actions');
      if(!actions||card.querySelector('.luna-fullscreen-btn')) return;
      const b=document.createElement('button'); b.type='button'; b.className='luna-fullscreen-btn'; b.title='Fullscreen'; b.innerHTML='<i class="fas fa-expand"></i>'; actions.appendChild(b);
      const close=()=>{card.classList.remove('luna-game-fullscreen');document.body.classList.remove('luna-game-fullscreen-open');b.innerHTML='<i class="fas fa-expand"></i>';b.title='Fullscreen'};
      b.onclick=async()=>{if(card.classList.contains('luna-game-fullscreen'))return close();card.classList.add('luna-game-fullscreen');document.body.classList.add('luna-game-fullscreen-open');b.innerHTML='<i class="fas fa-compress"></i>';b.title='Exit fullscreen';try{await card.requestFullscreen?.()}catch(_){} };
      document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==card&&card.classList.contains('luna-game-fullscreen'))close()});
    });

    // Flappy Bird
    const fc=$('flappy'), fstart=$('startBtn');
    if(fc&&fc.getContext){
      const ctx=fc.getContext('2d'); let bird={x:180,y:260,vy:0},pipes=[],running=false,score=0,best=Number(localStorage.getItem('luna-flappy-best')||0),raf=0,last=0;
      text('best',best);
      const addPipe=(x)=>{const gap=155,top=65+Math.random()*210;pipes.push({x,top,bottom:top+gap,passed:false})};
      const draw=()=>{ctx.fillStyle='#111525';ctx.fillRect(0,0,fc.width,fc.height);ctx.fillStyle='#171d2b';ctx.fillRect(0,535,fc.width,65);pipes.forEach(p=>{ctx.fillStyle='#8b5cf6';ctx.fillRect(p.x,0,78,p.top);ctx.fillRect(p.x,p.bottom,78,535-p.bottom)});ctx.fillStyle='#c4b5fd';ctx.beginPath();ctx.arc(bird.x,bird.y,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bird.x+7,bird.y-6,4,0,Math.PI*2);ctx.fill()};
      const end=()=>{running=false;best=Math.max(best,score);localStorage.setItem('luna-flappy-best',best);text('best',best);const ov=$('overlay');if(ov)ov.style.display='flex';text('panelTitle','Game Over');text('panelText','Score '+score+' · press Start to play again')};
      const loop=now=>{if(!running)return;const dt=Math.min(.03,(now-last)/1000);last=now;bird.vy+=1100*dt;bird.y+=bird.vy*dt;pipes.forEach(p=>p.x-=240*dt);if(pipes.length&&pipes[pipes.length-1].x<430)addPipe(pipes[pipes.length-1].x+300);pipes=pipes.filter(p=>p.x>-90);pipes.forEach(p=>{if(!p.passed&&p.x+78<bird.x){p.passed=true;score++;text('score',score)}});const dead=bird.y<18||bird.y>535||pipes.some(p=>bird.x+18>p.x&&bird.x-18<p.x+78&&(bird.y-18<p.top||bird.y+18>p.bottom));draw();if(dead)end();else raf=requestAnimationFrame(loop)};
      const start=()=>{cancelAnimationFrame(raf);bird={x:180,y:260,vy:0};pipes=[];score=0;running=true;last=performance.now();text('score',0);const ov=$('overlay');if(ov)ov.style.display='none';text('panelTitle','Flappy Bird');text('panelText','Playing');addPipe(620);addPipe(920);raf=requestAnimationFrame(loop)};
      fstart?.addEventListener('click',start);fc.addEventListener('pointerdown',()=>{if(!running)start();bird.vy=-390});window.addEventListener('keydown',e=>{if(e.code==='Space'&&$('flappy')?.offsetParent!==null){e.preventDefault();if(!running)start();bird.vy=-390}});draw();
    }

    // Snake
    const sc=$('snakeCanvas');
    if(sc&&sc.getContext){
      const ctx=sc.getContext('2d'); let snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}],food={x:4,y:4},dir={x:1,y:0},next={x:1,y:0},timer=null,score=0,best=Number(localStorage.getItem('luna-snake-best')||0);text('snakeBest',best);
      const placeFood=()=>{do{food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}while(snake.some(p=>p.x===food.x&&p.y===food.y))};
      const draw=()=>{ctx.fillStyle='#0b0d12';ctx.fillRect(0,0,500,500);ctx.strokeStyle='rgba(255,255,255,.04)';for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(i*25,0);ctx.lineTo(i*25,500);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*25);ctx.lineTo(500,i*25);ctx.stroke()}ctx.fillStyle='#c4b5fd';ctx.fillRect(food.x*25+5,food.y*25+5,15,15);snake.forEach((p,i)=>{ctx.fillStyle=i?'#8b5cf6':'#b8ff3d';ctx.fillRect(p.x*25+2,p.y*25+2,21,21)})};
      const start=()=>{clearInterval(timer);snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];dir={x:1,y:0};next={x:1,y:0};score=0;text('snakeScore',0);text('snakeMessage','Playing');placeFood();draw();timer=setInterval(step,120)};
      const step=()=>{dir=next;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.x>=20||h.y<0||h.y>=20||snake.some(p=>p.x===h.x&&p.y===h.y)){clearInterval(timer);best=Math.max(best,score);localStorage.setItem('luna-snake-best',best);text('snakeBest',best);text('snakeMessage','Game over — press Start Snake');return}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;text('snakeScore',score);placeFood()}else snake.pop();draw()};
      const setDir=name=>{const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name];if(m&&!(m.x===-dir.x&&m.y===-dir.y))next=m};
      $('snakeStart')?.addEventListener('click',start);page.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>setDir(b.dataset.dir)));window.addEventListener('keydown',e=>{if(!document.querySelector('[data-card="snake"]')?.classList.contains('active'))return;const k=e.key.toLowerCase();if(k==='w'||e.key==='ArrowUp')setDir('up');if(k==='s'||e.key==='ArrowDown')setDir('down');if(k==='a'||e.key==='ArrowLeft')setDir('left');if(k==='d'||e.key==='ArrowRight')setDir('right')});text('snakeMessage','Press Start Snake');draw();
    }

    // Baseball
    const ball=$('baseBall');
    if(ball){
      let active=false,startTime=0,raf=0,hits=0,runs=0;
      const pitch=()=>{if(active)return;active=true;startTime=performance.now();ball.style.display='block';text('baseballMessage','Watch the pitch…');const frame=now=>{const t=Math.min(1,(now-startTime)/850);ball.style.left='calc(50% + '+((t-.5)*80)+'px)';ball.style.bottom=(80+t*280)+'px';if(t<1)raf=requestAnimationFrame(frame);else{active=false;ball.style.display='none';text('baseballMessage','Strike — pitch again.')}};raf=requestAnimationFrame(frame)};
      const swing=()=>{if(!active){text('baseballMessage','Pitch first.');return}const t=Math.min(1,(performance.now()-startTime)/850);cancelAnimationFrame(raf);active=false;ball.style.display='none';const d=Math.abs(t-.82);if(d<.15){hits++;if(d<.055)runs++;text('baseHits',hits);text('baseRuns',runs);text('baseballMessage',d<.055?'Home run!':'Base hit!')}else text('baseballMessage','Missed — pitch again.')};
      $('pitchBtn')?.addEventListener('click',pitch);$('swingBtn')?.addEventListener('click',swing);window.addEventListener('keydown',e=>{if(e.code==='Space'&&document.querySelector('[data-card="baseball"]')?.classList.contains('active')){e.preventDefault();swing()}});
    }

    // Tetris
    const tc=$('tetrisCanvas');
    if(tc&&tc.getContext){
      const ctx=tc.getContext('2d'),shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];let board=[],piece=null,x=3,y=0,running=false,paused=false,timer=null,score=0,lines=0;
      const init=()=>{board=Array.from({length:20},()=>Array(10).fill(0));piece=null;x=3;y=0;score=0;lines=0;text('tetrisScore',0);text('tetrisLines',0)};
      const collide=(px,py,m)=>{for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]&&(px+c<0||px+c>=10||py+r>=20||(py+r>=0&&board[py+r][px+c])))return true;return false};
      const spawn=()=>{piece=shapes[Math.floor(Math.random()*shapes.length)].map(row=>row.slice());x=Math.floor((10-piece[0].length)/2);y=0;if(collide(x,y,piece)){running=false;clearInterval(timer);text('tetrisMsg','Game over — press Start Tetris')}};
      const draw=()=>{ctx.fillStyle='#0b0d12';ctx.fillRect(0,0,300,600);for(let r=0;r<20;r++)for(let c=0;c<10;c++){ctx.strokeStyle='rgba(255,255,255,.04)';ctx.strokeRect(c*30,r*30,30,30);if(board[r][c]){ctx.fillStyle='#8b5cf6';ctx.fillRect(c*30+2,r*30+2,26,26)}}if(piece)for(let r=0;r<piece.length;r++)for(let c=0;c<piece[r].length;c++)if(piece[r][c]){ctx.fillStyle='#c4b5fd';ctx.fillRect((x+c)*30+2,(y+r)*30+2,26,26)}};
      const rotate=m=>m[0].map((_,i)=>m.map(row=>row[i]).reverse());
      const merge=()=>piece.forEach((row,r)=>row.forEach((v,c)=>{if(v&&y+r>=0)board[y+r][x+c]=1}));
      const clearLines=()=>{const keep=board.filter(row=>row.some(v=>!v)),n=20-keep.length;if(n){lines+=n;score+=[0,100,300,500,800][n]||800;text('tetrisLines',lines);text('tetrisScore',score)}while(keep.length<20)keep.unshift(Array(10).fill(0));board=keep};
      const drop=()=>{if(!running||paused)return;if(!collide(x,y+1,piece))y++;else{merge();clearLines();spawn()}draw()};
      const start=()=>{clearInterval(timer);init();running=true;paused=false;text('tetrisMsg','Playing');text('tetrisPause','Pause');spawn();draw();timer=setInterval(drop,450)};
      $('tetrisStart')?.addEventListener('click',start);$('tetrisPause')?.addEventListener('click',()=>{if(running){paused=!paused;text('tetrisPause',paused?'Resume':'Pause')}});window.addEventListener('keydown',e=>{if(!document.querySelector('[data-card="tetris"]')?.classList.contains('active')||!running||!piece)return;if(e.key==='ArrowLeft'&&!collide(x-1,y,piece)){x--;draw()}if(e.key==='ArrowRight'&&!collide(x+1,y,piece)){x++;draw()}if(e.key==='ArrowDown')drop();if(e.key==='ArrowUp'){const m=rotate(piece);if(!collide(x,y,m)){piece=m;draw()}}if(e.code==='Space'){e.preventDefault();while(!collide(x,y+1,piece))y++;drop()}});init();draw();
    }

    // Minesweeper
    const grid=$('mineGrid');
    if(grid){
      let size=10,mines=12,cells=[];
      const reset=()=>{size=$('mineDifficulty')?.value==='intermediate'?14:10;mines=size===14?28:12;grid.style.gridTemplateColumns=`repeat(${size},1fr)`;cells=Array.from({length:size*size},()=>({mine:false,revealed:false,flag:false,n:0}));let placed=0;while(placed<mines){const i=Math.floor(Math.random()*cells.length);if(!cells[i].mine){cells[i].mine=true;placed++}}for(let i=0;i<cells.length;i++){const r=Math.floor(i/size),c=i%size;let n=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc){continue}const rr=r+dr,cc=c+dc;if(rr>=0&&rr<size&&cc>=0&&cc<size&&cells[rr*size+cc].mine)n++}cells[i].n=n}render();text('mineMessage','Left click to reveal. Right click to flag.')};
      const render=()=>{grid.innerHTML='';cells.forEach((cell,i)=>{const b=document.createElement('button');b.type='button';b.className='mine-cell'+(cell.revealed?' revealed':'')+(cell.revealed&&cell.mine?' mine':'')+(cell.flag&&!cell.revealed?' flag':'');b.textContent=cell.flag&&!cell.revealed?'⚑':cell.revealed?(cell.mine?'✹':cell.n||''):'';b.onclick=()=>reveal(i);b.oncontextmenu=e=>{e.preventDefault();if(!cell.revealed){cell.flag=!cell.flag;render()}};grid.appendChild(b)})};
      const reveal=i=>{const first=cells[i];if(first.revealed||first.flag)return;if(first.mine){cells.forEach(c=>{if(c.mine)c.revealed=true});render();text('mineMessage','Board lost — click New Board.');return}const stack=[i],seen=new Set();while(stack.length){const idx=stack.pop();if(seen.has(idx))continue;seen.add(idx);const c=cells[idx];if(c.revealed||c.flag||c.mine)continue;c.revealed=true;if(c.n===0){const r=Math.floor(idx/size),col=idx%size;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=col+dc;if(rr>=0&&rr<size&&cc>=0&&cc<size)stack.push(rr*size+cc)}}}render();if(cells.every(c=>c.mine||c.revealed))text('mineMessage','You cleared the board!')};
      $('mineReset')?.addEventListener('click',reset);$('mineDifficulty')?.addEventListener('change',reset);reset();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
