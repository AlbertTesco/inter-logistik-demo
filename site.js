(() => {
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMenu = matchMedia('(max-width: 1000px)');
  const token = name => getComputedStyle(root).getPropertyValue(name).trim();
  const duration = name => Number.parseFloat(token(name));
  let userPaused = false;
  const motionAllowed = () => !userPaused && !reducedMotion.matches;
  const motionControl = document.querySelector('.motion-control');
  const menuControl = document.querySelector('.menu-control');
  const navigation = document.querySelector('#site-nav');
  const header = document.querySelector('.site-header');
  new ResizeObserver(() => {
    root.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
  }).observe(header);

  function closeMenu() {
    menuControl.setAttribute('aria-expanded', 'false');
    menuControl.setAttribute('aria-label', 'Открыть меню');
    navigation.classList.toggle('is-collapsed', mobileMenu.matches);
  }
  function syncMenu() {
    menuControl.hidden = !mobileMenu.matches;
    closeMenu();
  }
  menuControl.addEventListener('click', () => {
    const open = menuControl.getAttribute('aria-expanded') !== 'true';
    menuControl.setAttribute('aria-expanded', String(open));
    menuControl.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    navigation.classList.toggle('is-collapsed', !open);
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuControl.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuControl.focus();
    }
  });
  mobileMenu.addEventListener('change', syncMenu);
  syncMenu();

  function syncMotion() {
    const running = motionAllowed();
    root.classList.toggle('motion-running', running);
    root.classList.toggle('motion-paused', !running);
    const label = reducedMotion.matches ? 'Анимации отключены настройкой устройства'
      : running ? 'Отключить анимации' : 'Включить анимации';
    motionControl.hidden = false;
    motionControl.disabled = reducedMotion.matches;
    motionControl.setAttribute('aria-label', label);
    motionControl.setAttribute('aria-pressed', String(running));
    motionControl.title = label;
    document.dispatchEvent(new CustomEvent('site:motionchange'));
  }
  motionControl.addEventListener('click', () => { userPaused = !userPaused; syncMotion(); });
  reducedMotion.addEventListener('change', syncMotion);
  new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('offscreen', !entry.isIntersecting));
  }).observe(document.querySelector('.hero'));
  const mediaObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('offscreen', !entry.isIntersecting));
  });
  document.querySelectorAll('.media,.stage-player,.editorial-scene').forEach(media => mediaObserver.observe(media));

  // Original flowing line field, layered above the seed image and below the copy.
  const hero = document.querySelector('.hero');
  const waveCanvas = hero.querySelector('.hero-waves');
  const waveContext = waveCanvas.getContext('2d');
  if (waveContext) {
    let width = 0;
    let height = 0;
    let time = 0;
    let lastFrame = 0;
    let frame = null;
    let visible = false;
    const waveColor = token('--color-accent');
    function drawWaves() {
      if (!width || !height) return;
      const compact = width < 680;
      waveContext.clearRect(0, 0, width, height);
      waveContext.strokeStyle = waveColor;
      waveContext.lineWidth = .7;
      for (let line = 0; line < (compact ? 19 : 32); line++) {
        waveContext.beginPath();
        for (let step = 0; step <= 90; step++) {
          const x = step / 90;
          const ridge = Math.exp(-((x - .71) ** 2) / .095);
          const wave = Math.sin(x * 7 + time * .19 + line * .075) * .06;
          const ripple = Math.cos(x * 11 - time * .12 + line * .11) * .025;
          const y = ((compact ? .75 : .68) + line * .009 - ridge * .10 + wave + ripple) * height;
          if (step === 0) waveContext.moveTo(x * width, y);
          else waveContext.lineTo(x * width, y);
        }
        waveContext.globalAlpha = compact ? .18 : .14 + (line % 5) * .02;
        waveContext.stroke();
      }
      waveContext.globalAlpha = 1;
    }
    function waveTick(timestamp) {
      frame = null;
      if (!motionAllowed() || !visible || document.hidden) return;
      if (!lastFrame || timestamp - lastFrame >= (width < 680 ? 42 : 32)) {
        time += Math.min(lastFrame ? (timestamp - lastFrame) / 1000 : .033, .08);
        lastFrame = timestamp;
        drawWaves();
      }
      frame = requestAnimationFrame(waveTick);
    }
    function syncWaves() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      lastFrame = 0;
      if (motionAllowed() && visible && !document.hidden) frame = requestAnimationFrame(waveTick);
      else drawWaves();
    }
    new ResizeObserver(() => {
      const box = hero.getBoundingClientRect();
      width = box.width;
      height = box.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      waveCanvas.width = Math.round(width * ratio);
      waveCanvas.height = Math.round(height * ratio);
      waveContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawWaves();
    }).observe(hero);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncWaves();
    }).observe(hero);
    document.addEventListener('site:motionchange', syncWaves);
    document.addEventListener('visibilitychange', syncWaves);
  }

  // Distinct agricultural scenes share the same wind, but have their own palette.
  document.querySelectorAll('.editorial-scene').forEach((section, scene) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'scene-weather';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const light = section.matches('.warehouse-section,.contact-section');
    const ink = token(light ? '--color-editorial-olive' : '--color-editorial-gold');
    const seedPalette = { light: token('--color-seed-light'), gold: token('--color-seed-gold'), shadow: token('--color-seed-shadow'), shell: token('--color-seed-shell') };
    let width = 0, height = 0, time = scene * 3, last = 0, frame = null, visible = false;
    function stalk(x, bottom, scale, lean, phase) {
      ctx.save(); ctx.translate(x, bottom);
      ctx.rotate(lean + Math.sin(time * .7 + phase) * .09);
      ctx.scale(scale, scale);
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1.4;
      ctx.globalAlpha = light ? .16 : .23;
      ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-12,-100,15,-210,0,-350);ctx.stroke();
      for (let pair = 0; pair < 9; pair++) for (const side of [-1,1]) {
        ctx.save(); ctx.translate(side * 11,-220-pair*14);ctx.rotate(side*.62);
        ctx.beginPath();ctx.ellipse(0,0,6,14,0,0,Math.PI*2);
        ctx.globalAlpha = light ? .07 : .12; ctx.fill();
        ctx.globalAlpha = light ? .18 : .3;ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(side*3,-42);ctx.stroke();ctx.restore();
      }
      for (const side of [-1,1]) {
        ctx.globalAlpha = light ? .06 : .1;
        ctx.beginPath();ctx.moveTo(0,-95);ctx.quadraticCurveTo(side*60,-135,side*70,-210);ctx.quadraticCurveTo(side*15,-175,0,-95);ctx.fill();
      }
      ctx.restore();
    }
    const motif = section.matches('.services-section') ? 'field'
      : section.matches('.warehouse-section') ? 'sunlight'
      : section.matches('.process-section') ? 'seed-flow' : 'grain-table';
    canvas.dataset.motif = motif;
    function kernel(x,y,scale,angle,opacity) {
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
      ctx.fillStyle=ink;ctx.strokeStyle=ink;ctx.lineWidth=.8;
      ctx.globalAlpha=opacity*.42;
      ctx.beginPath();ctx.ellipse(0,0,4,11,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=opacity;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-8);ctx.quadraticCurveTo(-3,0,0,8);ctx.stroke();ctx.restore();
    }
    function macroSeed(x,y,size,angle,type,opacity) {
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);
      const broad=type===1, radius=broad ? 16 : 10, length=broad ? 24 : 29;
      ctx.globalAlpha=opacity*.28;
      const shadow=ctx.createRadialGradient(4,8,0,4,8,38);
      shadow.addColorStop(0,ink);shadow.addColorStop(1,ink+'00');
      ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(4,8,24,37,0,0,Math.PI*2);ctx.fill();
      const shape=()=>{
        ctx.beginPath();ctx.moveTo(0,-length);
        ctx.bezierCurveTo(radius,-length*.72,radius,length*.55,0,length);
        ctx.bezierCurveTo(-radius,length*.55,-radius,-length*.72,0,-length);
        ctx.closePath();
      };
      const body=ctx.createLinearGradient(-radius,0,radius,0);
      body.addColorStop(0,seedPalette.shadow);
      body.addColorStop(.38,type===2 ? seedPalette.shell : seedPalette.light);
      body.addColorStop(.68,type===1 ? seedPalette.light : seedPalette.gold);
      body.addColorStop(1,seedPalette.shadow);
      ctx.globalAlpha=opacity;ctx.fillStyle=body;shape();ctx.fill();
      ctx.strokeStyle=seedPalette.shadow;ctx.lineWidth=.7;ctx.stroke();
      ctx.save();shape();ctx.clip();
      if(type===2) {
        ctx.strokeStyle=seedPalette.light;ctx.globalAlpha=opacity*.65;ctx.lineWidth=1.2;
        for(let stripe=-2;stripe<=2;stripe++) {
          ctx.beginPath();ctx.moveTo(stripe*3,-25);ctx.quadraticCurveTo(stripe*4+2,0,stripe*2,25);ctx.stroke();
        }
      } else {
        ctx.strokeStyle=seedPalette.shadow;ctx.globalAlpha=opacity*.65;ctx.lineWidth=1.1;
        ctx.beginPath();ctx.moveTo(0,-length+5);ctx.bezierCurveTo(-4,-8,3,11,0,length-4);ctx.stroke();
        ctx.strokeStyle=seedPalette.light;ctx.globalAlpha=opacity*.55;
        ctx.beginPath();ctx.moveTo(2,-length+8);ctx.quadraticCurveTo(-1,0,2,length-8);ctx.stroke();
      }
      ctx.restore();ctx.restore();
    }
    function draw() {
      ctx.clearRect(0,0,width,height);
      const compact=width<680;
      const sunX=width*(.5+Math.sin(time*.16+scene)*.6);
      const sunY=height*(.4+Math.cos(time*.12)*.2);
      const glow=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,Math.max(width*.35,400));
      glow.addColorStop(0,ink);glow.addColorStop(1,ink+'00');
      ctx.globalAlpha=motif==='grain-table' ? .055 : .09;
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      if (motif==='field') {
        for(let i=0;i<(compact ? 3 : 7);i++) {
          const right=i%2;
          const edge=compact ? 10+(i%2)*15 : 30+(i%4)*40;
          stalk(right ? width-edge : edge,height*(.45+(i%3)*.27),compact ? .7+(i%2)*.15 : .8+(i%3)*.3,right ? -.2 : .2,i);
        }
        for(let i=0;i<(compact ? 6 : 14);i++) {
          const phase=time*.018+i*.173;
          const x=width*((i%2 ? .82 : .03)+.12*Math.sin(phase*Math.PI*2+i));
          const y=((i*97-time*(10+i%4))%(height+80)+height+80)%(height+80)-40;
          kernel(x,y,1,i*.9+Math.sin(time*.45+i)*.5,.3);
        }
      } else if(motif==='sunlight') {
        // The warehouse has oversized grain shadows and slow slanting light.
        ctx.save();ctx.fillStyle=ink;
        for(let i=0;i<(compact ? 4 : 8);i++) {
          const x=(i%2 ? width*.95 : width*.05)+Math.sin(time*.24+i)*width*.035;
          const y=height*(.12+(i%4)*.25)+Math.cos(time*.2+i)*24;
          ctx.save();ctx.translate(x,y);ctx.rotate(-.5+Math.sin(time*.18+i)*.14);
          const scale=compact ? 2.8 : 4.5+i%2;
          ctx.scale(scale,scale);ctx.filter='blur(1.5px)';ctx.globalAlpha=.1;
          ctx.beginPath();ctx.ellipse(0,0,7,22,0,0,Math.PI*2);ctx.fill();
          ctx.filter='none';ctx.globalAlpha=.14;ctx.strokeStyle=ink;ctx.lineWidth=.5;
          ctx.beginPath();ctx.moveTo(0,-16);ctx.quadraticCurveTo(-4,0,0,16);ctx.stroke();ctx.restore();
        }
        ctx.restore();
      } else if(motif==='seed-flow') {
        // Seeds follow curved paths, with short trails rather than wheat stems.
        for(let i=0;i<(compact ? 8 : 18);i++) {
          const right=i%2;
          const cycle=(time*.032+i*.117)%1;
          const edge=width*(compact ? .055 : .075);
          const path=t=>({x:(right ? width-edge : edge)+Math.sin(t*5+i)*width*(compact ? .055 : .045),y:(1-t)*(height+100)-50});
          ctx.strokeStyle=ink;ctx.globalAlpha=.13;ctx.lineWidth=.8;
          ctx.beginPath();
          for(let trail=0;trail<=12;trail++) {
            const t=Math.max(0,cycle-trail*.004),p=path(t);
            if(trail===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
          }
          ctx.stroke();const p=path(cycle);
          kernel(p.x,p.y,compact ? 1 : 1.35,Math.sin(cycle*5+i)*.65,.38);
        }
      } else {
        // Macro grain on linen: mixed kernels, rolling motion and passing sunlight.
        const roomy=width>=1600;
        const spread=roomy ? Math.min((width-1440)/2,380) : compact ? 24 : 48;
        const count=roomy ? 28 : compact ? 10 : 16;
        for(let i=0;i<count;i++) {
          const right=i%2;
          const band=(i*.618034)%1;
          const inset=12+band*spread;
          const x=(right ? width-inset : inset)+Math.sin(time*.31+i*1.7)*(roomy ? 18 : 7);
          const y=height*(.1+((i*.381966)%1)*.8)+Math.cos(time*.24+i)*18;
          const size=(roomy ? .8 : .45)+(i%4)*.18;
          const angle=i*2.39996+Math.sin(time*.28+i)*.3;
          macroSeed(x,y,size,angle,i%3,roomy ? .64 : .28);
        }
        const lightX=width*(.5+Math.sin(time*.18)*.65);
        const light=ctx.createLinearGradient(lightX-width*.3,0,lightX+width*.3,height);
        const warm=seedPalette.light;
        light.addColorStop(0,warm+'00');light.addColorStop(.5,warm);light.addColorStop(1,warm+'00');
        ctx.globalAlpha=.16;ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
      }
      ctx.globalAlpha=1;
    }
    function tick(stamp) {
      frame=null;
      if (!motionAllowed() || !visible || document.hidden) return;
      if (!last || stamp-last>=40) {
        time+=Math.min(last ? (stamp-last)/1000 : .04,.1);last=stamp;draw();
      }
      frame=requestAnimationFrame(tick);
    }
    function sync() {
      if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;
      if(motionAllowed()&&visible&&!document.hidden)frame=requestAnimationFrame(tick);
      else draw();
    }
    new ResizeObserver(()=>{
      width=section.clientWidth;height=section.clientHeight;
      const ratio=Math.min(devicePixelRatio||1,1.25);
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0);draw();
    }).observe(section);
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(section);
    document.addEventListener('site:motionchange',sync);
    document.addEventListener('visibilitychange',sync);
  });

  // Local editorial entrances do not move or recolor the hero.
  const entranceAnimations = new Set();
  const sceneObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      sceneObserver.unobserve(entry.target);
      if (!motionAllowed()) return;
      const animation = entry.target.animate([
        { opacity: 0, transform: 'translateY(24px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: duration('--duration-enter'), easing: token('--ease-out') });
      entranceAnimations.add(animation);
      animation.finished.catch(() => {}).finally(() => entranceAnimations.delete(animation));
    });
  }, { threshold: .12 });
  document.querySelectorAll('.services-intro,.service-list,.warehouse-section .section-heading,.warehouse-composition,.feature-list,.regions,.process-section .section-heading,.questions-grid,.contact-copy,.form-panel').forEach(element => sceneObserver.observe(element));
  document.addEventListener('site:motionchange', () => {
    if (!motionAllowed()) { entranceAnimations.forEach(animation => animation.cancel()); entranceAnimations.clear(); }
  });

  const stages = [
    { title: 'Согласуем условия', points: ['Какие семена и сколько привезёте', 'Дата поставки и срок хранения', 'Стоимость хранения и складских работ'], image: 'agreement', paper: 'Заявка', note: 'Объём · Дата · Срок' },
    { title: 'Примем на склад', points: ['Выгружаем товар', 'Проверяем целостность упаковки', 'Подписываем акт МХ-1'], image: 'receipt', paper: 'Приёмка', note: 'Акт МХ-1' },
    { title: 'Разместим семена', points: ['Товар храним на паллетах', 'На складе — датчики температуры и влажности', 'Охрана и видеонаблюдение'], image: 'storage', paper: 'Хранение', note: 'На паллетах' },
    { title: 'Выдадим товар', points: ['Проверяем доверенность представителя', 'Оформляем возврат по акту МХ-3', 'Загружаем товар'], image: 'dispatch', paper: 'Выдача', note: 'Акт МХ-3' },
  ];
  // Keep decoded illustrations ready before their first transition.
  const stageImages = stages.map(stage => {
    const image = new Image();
    image.src = `assets/process-${stage.image}.svg`;
    image.decode().catch(() => {});
    return image;
  });
  const player = document.querySelector('.stage-player');
  const tabs = [...player.querySelectorAll('[data-step]')];
  tabs.forEach(tab => {
    const fill = document.createElement('span');
    fill.className = 'stage-fill';
    fill.setAttribute('aria-hidden', 'true');
    tab.append(fill);
  });
  const stageTitle = player.querySelector('#stage-title');
  const stagePoints = player.querySelector('#stage-points');
  let currentStage = 0;
  let transitionVersion = 0;
  let stageAnimations = [];
  let transitioning = false;
  let playerVisible = false;
  let pointerOver = false;
  const interval = duration('--duration-stage-interval');
  let remaining = interval;
  let timer = null;
  let started = 0;
  let buttonFill = null;

  function resetButtonFill() {
    buttonFill?.cancel();
    buttonFill = null;
  }
  function playButtonFill() {
    if (!buttonFill) {
      buttonFill = tabs[currentStage].querySelector('.stage-fill').animate([
        { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' },
      ], { duration: interval, easing: 'linear', fill: 'both' });
      buttonFill.pause();
    }
    buttonFill.currentTime = interval - remaining;
    buttonFill.play();
  }
  function pausePlayback() {
    buttonFill?.pause();
    if (timer === null) return;
    remaining = Math.max(0, remaining - (performance.now() - started));
    clearTimeout(timer);
    timer = null;
  }
  function syncPlayback() {
    const keyboardFocus = player.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    if (!motionAllowed() || !playerVisible || document.hidden || pointerOver || keyboardFocus || transitioning) {
      pausePlayback();
      return;
    }
    if (timer !== null) return;
    started = performance.now();
    playButtonFill();
    timer = setTimeout(() => {
      timer = null;
      selectStage((currentStage + 1) % stages.length, true);
    }, remaining);
  }
  function renderStage(index, automatic) {
    const stage = stages[index];
    player.dataset.activeStage = String(index);
    stageTitle.textContent = stage.title;
    stagePoints.replaceChildren(...stage.points.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    player.querySelector('#stage-image').src = stageImages[index].src;
    player.querySelector('.stage-art-title').textContent = stage.paper;
    player.querySelector('.stage-art-note').textContent = stage.note;
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    if (!automatic) player.querySelector('#stage-status').textContent = `Этап ${index + 1} из 4: ${stage.title}`;
  }
  async function selectStage(index, automatic = false) {
    if (index === currentStage) {
      pausePlayback();
      remaining = interval;
      resetButtonFill();
      syncPlayback();
      return;
    }
    const direction = automatic || index > currentStage ? 1 : -1;
    currentStage = index;
    const version = ++transitionVersion;
    const parts = [stageTitle, stagePoints, player.querySelector('.stage-art')];
    stageAnimations.forEach(animation => animation.cancel());
    stageAnimations = [];
    transitioning = true;
    pausePlayback();
    remaining = interval;
    resetButtonFill();
    // Commit the button, copy and illustration together, before any animation.
    renderStage(index, automatic);
    if (motionAllowed()) {
      stageAnimations = parts.map((element, i) => element.animate([
        { opacity: 0, transform: i === 2
          ? `translateX(${direction * 60}px) rotate(${direction * 3}deg) scale(.94)`
          : `translateX(${direction * 24}px) translateY(6px)` },
        { opacity: 1, transform: 'translateX(0) translateY(0) rotate(0) scale(1)' },
      ], { duration: duration('--duration-stage-change'), easing: token('--ease-out'), fill: 'both' }));
      await Promise.all(stageAnimations.map(animation => animation.finished.catch(() => {})));
    }
    if (version !== transitionVersion) return;
    stageAnimations.forEach(animation => animation.cancel());
    stageAnimations = [];
    transitioning = false;
    syncPlayback();
  }
  tabs.forEach((tab, i) => tab.addEventListener('click', () => selectStage(i)));
  player.querySelector('#next-stage').addEventListener('click', () => selectStage((currentStage + 1) % stages.length));
  player.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') { pointerOver = true; syncPlayback(); }
  });
  player.addEventListener('pointerleave', () => { pointerOver = false; syncPlayback(); });
  player.addEventListener('focusin', syncPlayback);
  player.addEventListener('focusout', () => queueMicrotask(syncPlayback));
  new IntersectionObserver(([entry]) => {
    playerVisible = entry.intersectionRatio >= .25;
    syncPlayback();
  }, { threshold: [0,.25] }).observe(player);
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('page-hidden', document.hidden);
    syncPlayback();
  });
  document.addEventListener('site:motionchange', () => {
    if (!motionAllowed()) {
      transitionVersion++;
      stageAnimations.forEach(animation => animation.cancel());
      stageAnimations = [];
      transitioning = false;
      renderStage(currentStage, true);
    }
    syncPlayback();
  });

  const expanding = new Set();
  const syncAnchoring = () => root.classList.toggle('accordion-animating', expanding.size > 0);
  document.querySelectorAll('.accordion details').forEach(details => {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.answer');
    let desiredOpen = details.open;
    let animation;
    let answerAnimation;
    const finish = () => {
      details.open = desiredOpen;
      summary.dataset.expanded = String(desiredOpen);
      animation?.cancel();
      answerAnimation?.cancel();
      animation = null;
      answerAnimation = null;
      details.style.height = '';
      details.style.overflow = '';
      expanding.delete(details);
      syncAnchoring();
    };
    summary.addEventListener('click', event => {
      event.preventDefault();
      const start = details.getBoundingClientRect().height;
      const answerStyle = getComputedStyle(answer);
      const from = details.open
        ? { opacity: answerStyle.opacity, transform: answerStyle.transform }
        : { opacity: 0, transform: 'translateY(8px)' };
      desiredOpen = !desiredOpen;
      animation?.cancel();
      answerAnimation?.cancel();
      expanding.add(details);
      syncAnchoring();
      details.style.height = `${start}px`;
      details.style.overflow = 'hidden';
      details.open = true;
      summary.dataset.expanded = String(desiredOpen);
      const end = summary.getBoundingClientRect().height + (desiredOpen ? answer.getBoundingClientRect().height : 0);
      if (!motionAllowed()) { finish(); return; }
      animation = details.animate({ height: [`${start}px`,`${end}px`] }, {
        duration: duration('--duration-disclosure'), easing: token('--ease-out'), fill: 'forwards',
      });
      answerAnimation = answer.animate([
        from, desiredOpen ? { opacity: 1, transform: 'translateY(0)' }
          : { opacity: 0, transform: 'translateY(4px)' },
      ], { duration: duration(desiredOpen ? '--duration-panel' : '--duration-ui'), easing: token('--ease-out'), fill: 'both' });
      animation.onfinish = finish;
    });
    document.addEventListener('site:motionchange', () => { if (!motionAllowed() && animation) finish(); });
  });

  const form = document.querySelector('#request-form');
  const name = form.querySelector('#name');
  const phone = form.querySelector('#phone');
  const phoneError = form.querySelector('#phone-error');
  const dialog = document.querySelector('#request-preview');
  const preview = dialog.querySelector('#request-text');
  name.addEventListener('input', () => name.setCustomValidity(''));
  phone.addEventListener('input', () => { phone.removeAttribute('aria-invalid'); phoneError.hidden = true; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!name.value.trim()) {
      name.setCustomValidity('Укажите имя.');
      name.reportValidity();
      return;
    }
    const digits = phone.value.replace(/\D/g,'');
    if (digits.length < 10 || digits.length > 15 || !/^[+\d\s()–-]+$/.test(phone.value)) {
      phone.setAttribute('aria-invalid','true');
      phoneError.hidden = false;
      phone.focus();
      return;
    }
    preview.textContent = `Запрос на хранение семян\n\nИмя: ${name.value.trim()}\nТелефон: ${phone.value.trim()}\n\n${form.querySelector('#message').value.trim() || 'Сведения о партии не указаны.'}`;
    dialog.querySelector('#copy-status').textContent = '';
    dialog.showModal();
  });
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.querySelector('#copy-request').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview.textContent);
      dialog.querySelector('#copy-status').textContent = 'Текст скопирован.';
    } catch {
      dialog.querySelector('#copy-status').textContent = 'Выделите текст запроса и скопируйте его вручную.';
    }
  });
  const backTop = document.querySelector('.back-top');
  new IntersectionObserver(([entry]) => { backTop.hidden = entry.isIntersecting; }).observe(document.querySelector('.hero'));
  backTop.addEventListener('click', () => {
    document.querySelector('.site-header .brand').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: motionAllowed() ? 'smooth' : 'instant' });
  });
  syncMotion();
})();
