(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize(){
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth = window.innerWidth;
    H = canvas.clientHeight = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // Scene objects
  let buildings = [];
  let trees = [];
  let cars = [];
  let people = [];
  let raindrops = [];
  // rendering caches for parallax layers
  let layerCanvases = [];
  let cameraX = 0;
  // audio
  let audioCtx = null;
  let audioState = { enabled: false, rainGain: null };

  const config = {
    rainIntensity: (typeof SERVER_CONFIG !== 'undefined' ? SERVER_CONFIG.rainIntensity : 220),
    isNight: (typeof SERVER_CONFIG !== 'undefined' ? SERVER_CONFIG.isNight : 0)
  };

  // UI bindings
  const intensityInput = document.getElementById('intensity');
  const toggleNight = document.getElementById('toggleNight');
  const resetBtn = document.getElementById('reset');

  function initUI(){
    intensityInput.value = config.rainIntensity;
    toggleNight.checked = !!config.isNight;
    const toggleSound = document.getElementById('toggleSound');
    if(toggleSound) toggleSound.checked = false;
    const perfMode = document.getElementById('perfMode');
    if(perfMode) perfMode.value = 'detailed';
    toggleNight.addEventListener('change', ()=>{ config.isNight = toggleNight.checked; document.body.classList.toggle('nightBody', config.isNight); });
    intensityInput.addEventListener('input', ()=> config.rainIntensity = Number(intensityInput.value));
    resetBtn.addEventListener('click', ()=>{ config.rainIntensity = (typeof SERVER_CONFIG !== 'undefined' ? SERVER_CONFIG.rainIntensity : 220); intensityInput.value = config.rainIntensity; toggleNight.checked = !!(SERVER_CONFIG && SERVER_CONFIG.isNight); config.isNight = !!(SERVER_CONFIG && SERVER_CONFIG.isNight); document.body.classList.toggle('nightBody', config.isNight); if(toggleSound) { toggleSound.checked = false; setAudioEnabled(false); } });
    if(toggleSound){ toggleSound.addEventListener('change', ()=>{ setAudioEnabled(toggleSound.checked); }); }
    if(perfMode){ perfMode.addEventListener('change', ()=>{ setPerfMode(perfMode.value); }); }
  }

  function seedScene(){
    buildings = [];
    const baseY = H * 0.65;
    let x = 0;
    while(x < W){
      const bw = 70 + Math.random()*140; // building width
      const bh = 140 + Math.random() * (H*0.45); // building height
      // facade base color and minor side shade
      const hue = 200 + Math.floor(Math.random()*60);
      const light = 30 + Math.random()*30;
      const facade = `hsl(${hue},${18+Math.random()*18}%,${light}%)`;
      const side = `hsl(${hue-6},${12+Math.random()*10}%,${Math.max(12, light-12)}%)`;
      // window layout
      const cols = Math.max(2, Math.floor((bw-12) / 18));
      const rows = Math.max(3, Math.floor(bh / 24));
      // assign some buildings to use SVG variants for variety
      const useSVG = Math.random() > 0.7;
      const layer = Math.random() > 0.6 ? 0 : (Math.random() > 0.5 ? 1 : 2); // 0=far,1=mid,2=near
      buildings.push({ x, w: bw, h: bh, y: baseY - bh, facade, side, cols, rows, roofType: Math.random()>0.7? 'peak' : 'flat', useSVG, layer });
      x += bw + (8 + Math.random()*28);
    }

    trees = [];
    for(let i=0;i< Math.max(4, Math.floor(W/180)); i++){
      trees.push({ x: Math.random()*W, y: baseY + 18 + Math.random()*28, size: 18 + Math.random()*28, crownLayers: 2 + Math.floor(Math.random()*3) });
    }

    // place people near some trees holding umbrellas and assign walking properties
    people = [];
    for(const t of trees){
      if(Math.random() < 0.55){
        const px = t.x + (Math.random()-0.5) * (t.size*0.5);
        const footY = t.y + (t.size*0.4) + t.size*0.9; // base on trunk bottom
        const umbrellaColor = ['#c33','#0aa','#ffb74d','#7fc97f'][Math.floor(Math.random()*4)];
        const dir = Math.random() > 0.5 ? 1 : -1; // walking direction
        const speed = 0.3 + Math.random()*0.8; // px per tick factor
        people.push({ x: px, y: footY, treeX: t.x, umbrellaColor, bob: Math.random()*Math.PI*2, size: Math.max(8, t.size*0.38), dir, vx: speed * dir, walkPhase: Math.random()*Math.PI*2, pauseTime: 0 });
      }
    }

    cars = [];
    for(let i=0;i<6;i++){
      cars.push({ x: Math.random()*W, y: baseY + 40 + (i%2)*18, w: 28, h: 14, speed: 0.7 + Math.random()*1.6, color: carColor() });
    }
  }

  function randColor(){
    const n = Math.random();
    if(config.isNight) return `hsl(${200+Math.random()*50},20%,${10+Math.random()*25}%)`;
    return `hsl(${200+Math.random()*40},${30+Math.random()*30}%,${40+Math.random()*25}%)`;
  }
  function carColor(){
    const cs = ['#f04','#0af','#ffb74d','#9ccc65','#fff59d'];
    return cs[Math.floor(Math.random()*cs.length)];
  }

  function spawnRain(){
    while(raindrops.length < config.rainIntensity){
      raindrops.push({ x: Math.random()*W, y: Math.random()*-H, len: 8+Math.random()*18, speed: 4+Math.random()*8, wind: -0.5 + Math.random()*1.0 });
    }
    // trim extra
    if(raindrops.length > config.rainIntensity) raindrops.length = config.rainIntensity;
  }

  function update(dt){
    // cars
    for(const c of cars){
      c.x += c.speed * (dt*0.06);
      if(c.x > W + 60) c.x = -80 - Math.random()*300;
    }

    // people walking
    for(const p of people){
      // if paused, count down
      if(p.pauseTime > 0){ p.pauseTime -= dt * 0.01; continue; }
      p.walkPhase += dt * 0.02 * Math.abs(p.vx);
      p.x += p.vx * (dt * 0.06);
      // slight random pause chance
      if(Math.random() < 0.0008) p.pauseTime = 40 + Math.random()*140;
      // boundary: wrap around
      if(p.x < -60) p.x = W + 40; if(p.x > W + 60) p.x = -40;
    }

    // rain
    for(const r of raindrops){
      r.x += r.wind * (dt*0.06);
      r.y += r.speed * (dt*0.06);
      if(r.y > H + 20){ r.y = -10 - Math.random()*H; r.x = Math.random()*W; }
    }
  }

  function draw(){
    // sky
    if(config.isNight){
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#071428'); g.addColorStop(1,'#1b3856');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#87ceeb'); g.addColorStop(1,'#c1e1ff');
      ctx.fillStyle = g;
    }
    ctx.fillRect(0,0,W,H);

    // spawn/calc raindrops
    // draw background parallax layers (cached)
    ensureLayerCaches();
    const parallaxOffsets = [cameraX * 0.12, cameraX * 0.25, cameraX * 0.45];
    for(let i=0;i<layerCanvases.length;i++){
      const lc = layerCanvases[i];
      if(!lc) continue;
      ctx.drawImage(lc.canvas, -parallaxOffsets[i], 0);
    }

    // rain (behind city slight blur)
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = config.isNight ? 'rgba(200,220,255,0.25)' : 'rgba(120,160,255,0.45)';
    for(const r of raindrops){
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.wind*4, r.y + r.len); ctx.stroke();
    }
    ctx.restore();

    // road
    const roadY = H * 0.65 + 40;
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0, roadY, W, H-roadY);
    ctx.fillStyle = '#444'; ctx.fillRect(0, roadY+24, W, 8);
    // lane markers
    ctx.fillStyle = '#f6e27a';
    for(let i=0;i< W; i += 60) ctx.fillRect(i, roadY+28, 30, 4);

    // trees (draw above cached mid layer so they appear in front)
    for(const t of trees){
      // trunk
      ctx.fillStyle = '#4b2b1f';
      ctx.fillRect(t.x - (t.size*0.12), t.y + (t.size*0.4), t.size*0.24, t.size*0.9);
      // layered crown
      const layers = t.crownLayers || 3;
      for(let L = 0; L < layers; L++){
        const layerSize = t.size * (1 - L*0.18);
        const offsetY = -L * (t.size*0.18);
        const grad = ctx.createRadialGradient(t.x, t.y + offsetY, layerSize*0.15, t.x, t.y + offsetY, layerSize);
        const hue = 100 + Math.floor(Math.random()*40);
        const base = `hsl(${hue},${30+Math.random()*20}%,${25+L*6}%)`;
        grad.addColorStop(0, shadeHex(base, 18));
        grad.addColorStop(1, shadeHex(base, -6));
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(t.x + (Math.random()-0.5)*6, t.y + offsetY, layerSize*1.05, layerSize*0.85, 0, 0, Math.PI*2); ctx.fill();
      }
      // highlight on crown
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.ellipse(t.x - t.size*0.18, t.y - t.size*0.12, t.size*0.45, t.size*0.28, 0, 0, Math.PI*2); ctx.fill();
    }

    // people with umbrellas (near trees)
    for(const p of people){
      drawPerson(p);
    }

    // cars (more types) and play pass sound when car enters screen center
    for(const c of cars){
      drawCar(c);
      // play a whoosh when near center
      if(audioState.enabled && !c._soundPlayed && c.x > W*0.4 && c.x < W*0.6){ playCarWhoosh(); c._soundPlayed = true; }
      if(c.x > W + 120) c._soundPlayed = false;
    }

    // removed wet-road reflection as requested (keeps performance higher and looks simpler)

    // rain foreground (more opaque streaks)
    ctx.save(); ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; ctx.strokeStyle = config.isNight ? 'rgba(220,240,255,0.35)' : 'rgba(140,190,255,0.55)';
    for(let i=0;i< Math.min(160, raindrops.length); i+=2){
      const r = raindrops[Math.floor(Math.random()*raindrops.length)];
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.wind*6, r.y + r.len*1.2); ctx.stroke();
    }
    ctx.restore();
  }

  // main loop
  let last = performance.now();
  function loop(now){
    const dt = now - last; last = now;
    spawnRain();
    update(dt);
    // slowly move camera for parallax effect
    cameraX += 0.02 * (dt*0.06);
    draw();
    requestAnimationFrame(loop);
  }

  // initialization
  function start(){
    resize(); seedScene(); initUI(); document.body.classList.toggle('nightBody', config.isNight); window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
    // fetch weather once at start to apply server-driven defaults
    try{ fetchWeather(); }catch(e){}
  }

  // try fetch weather from local endpoint and apply
  function fetchWeather(){
    fetch('weather.php').then(r=>r.json()).then(j=>{
      if(j.intensity) { config.rainIntensity = j.intensity; if(intensityInput) intensityInput.value = config.rainIntensity; }
      if(typeof j.isNight !== 'undefined'){ config.isNight = !!j.isNight; toggleNight.checked = !!j.isNight; document.body.classList.toggle('nightBody', config.isNight); }
      // rebuild caches
      layerCanvases = [];
    }).catch(()=>{});
  }

  // load SVG building images into Image objects for canvas drawing
  const svgImages = [];
  function loadSVGs(){
    const srcs = ['assets/images/building1.svg','assets/images/building2.svg'];
    for(const s of srcs){ const img = new Image(); img.src = s; svgImages.push(img); }
  }
  loadSVGs();

  // --- new helpers: layer caching, SVG building renderer, cars, audio ---
  function ensureLayerCaches(){
    // create 3 layer canvases: far, mid, near
    if(layerCanvases.length === 0) for(let i=0;i<3;i++) layerCanvases.push(null);
    // if size mismatch or null, rebuild
    for(let layer=0; layer<3; layer++){
      if(!layerCanvases[layer] || layerCanvases[layer].w !== W || layerCanvases[layer].h !== H){
        const oc = document.createElement('canvas'); oc.width = W; oc.height = H; oc.w = W; oc.h = H; const octx = oc.getContext('2d');
        // draw background buildings for this layer
        octx.clearRect(0,0,W,H);
      for(const b of buildings){ if(b.layer !== layer) continue; if(!tryDrawSVGForBuilding(octx, b)) drawBuildingToContext(octx, b); }
        layerCanvases[layer] = { canvas: oc, ctx: octx };
      }
    }
  }

  // Draw a single building into provided context (used for offscreen caching)
  function drawBuildingToContext(octx, b){
    // facade gradient
    const g = octx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, b.facade);
    g.addColorStop(0.7, b.side);
    g.addColorStop(1, shadeHex(b.facade, -8));
    octx.fillStyle = g;
    octx.fillRect(b.x, b.y, b.w, b.h);
    // roof
    if(b.roofType === 'peak'){
      octx.fillStyle = shadeHex(b.facade, -18);
      octx.beginPath();
      octx.moveTo(b.x - 6, b.y);
      octx.lineTo(b.x + b.w/2, b.y - Math.min(30, b.w*0.25));
      octx.lineTo(b.x + b.w + 6, b.y);
      octx.closePath();
      octx.fill();
    } else {
      octx.fillStyle = shadeHex(b.facade, -10);
      octx.fillRect(b.x, b.y - 4, b.w, 4);
    }
    // windows (draw with glow when night)
    const winW = Math.max(6, Math.floor((b.w - 12) / b.cols) - 4);
    const winH = Math.max(8, Math.floor((b.h - 20) / b.rows) - 6);
    const gapX = Math.max(6, (b.w - (b.cols * winW)) / (b.cols + 1));
    const gapY = Math.max(8, (b.h - (b.rows * winH)) / (b.rows + 1));
    for(let ccol = 0; ccol < b.cols; ccol++){
      for(let rrow = 0; rrow < b.rows; rrow++){
        const xx = b.x + gapX + ccol * (winW + gapX);
        const yy = b.y + gapY + rrow * (winH + gapY);
        const isLit = Math.random() > (config.isNight ? 0.4 : 0.86);
          if(isLit){
            // reduced brightness for windows (less glare)
            if(config.isNight){ octx.shadowBlur = 4; octx.shadowColor = 'rgba(255,220,140,0.35)'; }
            octx.fillStyle = config.isNight ? 'rgba(255,230,160,'+ (0.35 + Math.random()*0.25) +')' : 'rgba(255,255,240,0.12)';
            octx.fillRect(xx, yy, winW + (Math.random()>0.985?4:0), winH + (Math.random()>0.995?3:0));
            octx.shadowBlur = 0;
          } else {
            octx.fillStyle = 'rgba(10,10,12,' + (0.06 + Math.random()*0.06) + ')';
            octx.fillRect(xx, yy, winW, winH);
          }
      }
    }
    // right edge shadow
    octx.fillStyle = 'rgba(0,0,0,0.06)';
    octx.fillRect(b.x + b.w - 6, b.y + 6, 6, b.h - 12);
  }

  // if a building has useSVG flag, draw its image instead of programmatic facade
  function tryDrawSVGForBuilding(ctxToDraw, b){
    if(!b.useSVG) return false;
    if(svgImages.length === 0) return false;
    // choose a random loaded svg image and draw scaled to building width/height
    const img = svgImages[Math.floor(Math.random() * svgImages.length)];
    if(!img.complete) return false; // not ready
    try{
      ctxToDraw.drawImage(img, b.x, b.y, b.w, b.h);
      return true;
    }catch(e){ return false; }
  }

  // draw car variants
  function drawCar(c){
    ctx.save();
    // body
    ctx.fillStyle = c.color;
    if(c.type === 'truck'){
      ctx.fillRect(c.x, c.y, c.w*1.4, c.h);
      ctx.fillStyle = shadeHex(c.color, -12);
      ctx.fillRect(c.x + c.w*0.9, c.y - c.h*0.25, c.w*0.5, c.h*0.7);
    } else if(c.type === 'compact'){
      ctx.beginPath(); ctx.roundedRect ? ctx.roundedRect(c.x, c.y, c.w, c.h, 3) : ctx.fillRect(c.x, c.y, c.w, c.h);
      // small roof
      ctx.fillStyle = shadeHex(c.color, -8); ctx.fillRect(c.x + 4, c.y - 6, c.w - 8, 6);
    } else {
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = shadeHex(c.color, -8); ctx.fillRect(c.x + c.w*0.2, c.y - 6, c.w*0.6, 6);
    }
    // wheels
    ctx.fillStyle = '#111'; ctx.fillRect(c.x+4, c.y+c.h-2, 6, 3); ctx.fillRect(c.x + (c.w*0.9)-6, c.y+c.h-2, 6, 3);
    ctx.restore();
    // move
    c.x += c.speed;
    if(c.x > W + 80) c.x = -80 - Math.random()*300;
  }

  // draw a simple person holding an umbrella with walking animation
  function drawPerson(p){
    // walking phase controls leg positions
    const phase = p.walkPhase || 0;
    const sway = Math.sin(phase) * 1.2; // body sway
    const x = p.x + sway;
    const footY = p.y;
    const bodyH = Math.max(10, p.size * 0.9);
    const bodyW = Math.max(6, p.size * 0.45);
    const dir = p.dir || 1;

    // legs — swinging using phase
    const legOffset = Math.sin(phase) * (bodyW * 0.45);
    ctx.fillStyle = '#222';
    // left leg
    ctx.fillRect(x - bodyW*0.25 + legOffset*0.5, footY - 2, bodyW*0.18, 6);
    // right leg (opposite phase)
    ctx.fillRect(x + bodyW*0.05 - legOffset*0.5, footY - 2, bodyW*0.18, 6);

    // body
    ctx.fillStyle = '#2b3b4b';
    ctx.fillRect(x - bodyW*0.5, footY - 2 - bodyH, bodyW, bodyH);

    // head
    ctx.beginPath(); ctx.fillStyle = '#f1d7c7'; ctx.arc(x, footY - bodyH - 6, Math.max(3, bodyW*0.45), 0, Math.PI*2); ctx.fill();

    // umbrella handle (slightly tilted by walking direction)
    const handleTopY = footY - bodyH - 6 - (p.size*0.25);
    const tilt = Math.sin(phase*0.8) * 0.12 * -dir; // tilt small amount
    ctx.strokeStyle = '#3b2b2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, footY - bodyH + 2); ctx.lineTo(x + tilt * p.size * 6, handleTopY); ctx.stroke();

    // umbrella canopy — tilt with walking and wind
    ctx.beginPath();
    ctx.fillStyle = p.umbrellaColor;
    const canopyLeft = x - p.size + tilt * p.size * 6;
    const canopyRight = x + p.size + tilt * p.size * 6;
    ctx.moveTo(canopyLeft, handleTopY);
    ctx.quadraticCurveTo(x + tilt * p.size * 4, handleTopY - p.size*0.9, canopyRight, handleTopY);
    ctx.lineTo(canopyLeft + 4, handleTopY);
    ctx.closePath();
    ctx.fill();
    // canopy rim line
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // simple car whoosh sound
  function initAudio(){
    if(audioCtx) return;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = audioCtx.createGain(); gain.gain.value = 0.2;
      gain.connect(audioCtx.destination);
      // rain noise via buffer
      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * 0.25;
      const src = audioCtx.createBufferSource(); src.buffer = buffer; src.loop = true;
      const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
      src.connect(lp); lp.connect(gain); src.start();
      audioState.rainGain = gain;
      audioState.src = src;
    }catch(e){ console.warn('Audio init failed', e); }
  }

  function setAudioEnabled(v){
    audioState.enabled = !!v;
    if(audioState.enabled){ initAudio(); audioState.rainGain.gain.value = 0.15; if(audioCtx.state === 'suspended') audioCtx.resume(); }
    else if(audioState.rainGain) audioState.rainGain.gain.value = 0.0;
  }

  // performance mode toggles
  function setPerfMode(mode){
    if(mode === 'fast'){
      // reduce raindrops and disable shadows/glow
      config._perf = 'fast';
      config.rainIntensity = Math.max(40, Math.floor(config.rainIntensity * 0.35));
      if(intensityInput) intensityInput.value = config.rainIntensity;
    } else {
      config._perf = 'detailed';
      config.rainIntensity = (typeof SERVER_CONFIG !== 'undefined' ? SERVER_CONFIG.rainIntensity : 220);
      if(intensityInput) intensityInput.value = config.rainIntensity;
    }
    // rebuild caches when toggling
    layerCanvases = [];
  }

  function playCarWhoosh(){
    if(!audioState.enabled || !audioCtx) return;
    const dur = 0.4;
    const o = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length) * 0.4;
    o.buffer = buf;
    const flt = audioCtx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1000 + Math.random()*2000;
    const g = audioCtx.createGain(); g.gain.value = 0.3;
    o.connect(flt); flt.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(()=>{ try{o.stop()}catch(e){}; }, dur*1000);
  }

  // helpers
  function rand(min=0,max=1){ return min + Math.random()*(max-min); }
  // Shade a HSL string by adjusting lightness (approx)
  function shadeHex(hslStr, deltaLight){
    // hsl(hue, sat%, light%)
    try{
      const m = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/.exec(hslStr);
      if(!m) return hslStr;
      const h = +m[1], s = +m[2], l = Math.max(0, Math.min(100, +m[3] + deltaLight));
      return `hsl(${h},${s}%,${l}%)`;
    }catch(e){ return hslStr; }
  }

  // Start after DOM ready
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

})();
