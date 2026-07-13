(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches; // Detecta telas de toque

  /* =========================================================
     1. SCROLL REVEAL & STAGGER DINÂMICO
  ========================================================= */
  // Injeta uma variável CSS com o índice do elemento para animações em cascata
  document.querySelectorAll('.why-grid, .service-grid, .method-list').forEach(grid => {
    const children = grid.querySelectorAll('.why-card, .service-card, .method-item');
    children.forEach((child, index) => {
      child.style.setProperty('--stagger-idx', index);
    });
  });

  const revealEls = document.querySelectorAll('.reveal');
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => revealIO.observe(el));

  /* =========================================================
     2. TILT 3D NOS CARDS (Desabilitado em Touch)
  ========================================================= */
  if (!reduceMotion && !isTouch) {
    const MAX_TILT = 6; 
    document.querySelectorAll('.tilt').forEach(card => {
      let raf = null;
      card.style.transformStyle = 'preserve-3d';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * MAX_TILT * 2;
        const ry = (px - 0.5) * MAX_TILT * 2;

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
        });
      });

      card.addEventListener('mouseleave', () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateY(0)';
      });
    });
  }

  /* =========================================================
     3. BOTÕES MAGNÉTICOS (Desabilitado em Touch)
  ========================================================= */
  if (!reduceMotion && !isTouch) {
    const PULL = 0.28;
    document.querySelectorAll('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const mx = e.clientX - (rect.left + rect.width / 2);
        const my = e.clientY - (rect.top + rect.height / 2);
        btn.style.transform = `translate(${mx * PULL}px, ${my * PULL}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0,0)';
      });
    });
  }

  /* =========================================================
     4. SPOTLIGHT NO HERO E PAUSA DO CANVAS
  ========================================================= */
  const hero = document.querySelector('.hero');
  let canvasVisible = true;
  let rafId = null; // populado depois que frame() é declarada, mais abaixo

  if (hero) {
    if (!reduceMotion) {
      hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 100;
        const my = ((e.clientY - rect.top) / rect.height) * 100;
        hero.style.setProperty('--mx', mx + '%');
        hero.style.setProperty('--my', my + '%');
      });
    }

    // Performance: fora da viewport, cancela o rAF de vez em vez de só
    // pular o desenho — economiza o callback inteiro, não só o trabalho.
    const heroObserver = new IntersectionObserver((entries) => {
      canvasVisible = entries[0].isIntersecting;
      if (canvasVisible && rafId === null) {
        rafId = requestAnimationFrame(frame);
      } else if (!canvasVisible && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }, { threshold: 0 });
    heroObserver.observe(hero);
  }

  /* =========================================================
     5. GRÁFICO DO MOCKUP — Traço e Preenchimento
  ========================================================= */
  const dashLine = document.getElementById('dash-line');
  const dashFill = document.querySelector('.dash-chart .dash-fill');

  if (dashLine && dashFill) {
    const len = dashLine.getTotalLength();
    dashLine.style.strokeDasharray = len;
    dashLine.style.strokeDashoffset = reduceMotion ? 0 : len;
    dashFill.style.opacity = reduceMotion ? 1 : 0; // Esconde o fundo

    if (!reduceMotion) {
      requestAnimationFrame(() => {
        // Anima a linha
        dashLine.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1) 0.5s';
        dashLine.style.strokeDashoffset = 0;
        
        // Anima o preenchimento sincronizado com o fim do desenho da linha
        dashFill.style.transition = 'opacity 1.2s ease 1.7s';
        dashFill.style.opacity = 1;
      });
    }
  }

  /* =========================================================
     6. CANVAS — rede de dados viva (sem formar nenhuma figura)
     Partículas ambientes conectadas por linhas, com pulsos de
     "informação" viajando ao longo das conexões. Puramente
     abstrato: nenhum ponto converge para uma forma reconhecível.
  ========================================================= */
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  const COL_A = [36, 97, 255];
  const COL_B = [53, 208, 245];
  function gradColor(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const rr = Math.round(lerp(COL_A[0], COL_B[0], r));
    const gg = Math.round(lerp(COL_A[1], COL_B[1], r));
    const bb = Math.round(lerp(COL_A[2], COL_B[2], r));
    return `${rr},${gg},${bb}`;
  }

  // -------- partículas --------
  let nodes = [];
  let linkDist = 150;
  function initNodes() {
    nodes = [];
    const isNarrow = W < 900;
    const count = isNarrow ? 42 : 110;
    linkDist = isNarrow ? 100 : 160;
    for (let i = 0; i < count; i++) {
      const isFeature = i % 12 === 0;
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        r: isFeature ? Math.random() * 1.1 + 1.8 : Math.random() * 1.2 + 0.4,
        depth: Math.random() * 0.6 + 0.4,
        feature: isFeature,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.02 + 0.01
      });
    }
  }

  // -------- névoa de fundo (glow lento, dá atmosfera ao hero) --------
  const auras = [
    { baseX: 0.18, baseY: 0.28, r: 0.55, hue: [36, 97, 255], speed: 0.00016, phase: 0 },
    { baseX: 0.82, baseY: 0.78, r: 0.6, hue: [53, 208, 245], speed: 0.00021, phase: 2.1 }
  ];
  function drawAuras(now) {
    auras.forEach(a => {
      const driftX = Math.sin(now * a.speed + a.phase) * 0.05;
      const driftY = Math.cos(now * a.speed * 0.8 + a.phase) * 0.05;
      const cx = W * (a.baseX + driftX);
      const cy = H * (a.baseY + driftY);
      const r = Math.max(W, H) * a.r;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${a.hue[0]},${a.hue[1]},${a.hue[2]},0.10)`);
      g.addColorStop(1, `rgba(${a.hue[0]},${a.hue[1]},${a.hue[2]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
  }

  // -------- pulsos de dado viajando pelas conexões --------
  let pulses = [];
  function maybeSpawnPulse(edges) {
    if (reduceMotion) return;
    if (pulses.length > 26) return;
    if (Math.random() > 0.02) return;
    if (!edges.length) return;
    const e = edges[Math.floor(Math.random() * edges.length)];
    pulses.push({ a: e.a, b: e.b, t: 0, speed: 0.006 + Math.random() * 0.01 });
  }

  resize();
  initNodes();
  window.addEventListener('resize', () => {
    resize();
    initNodes();
  });

  // paralaxe do mouse sobre o canvas
  let mouseX = 0, mouseY = 0, mouseActive = false;
  if (!reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.clientY < rect.bottom && e.clientY > rect.top) {
        mouseX = (e.clientX - rect.left - W / 2) / (W / 2); // -1..1
        mouseY = (e.clientY - rect.top - H / 2) / (H / 2);  // -1..1
        mouseActive = true;
      } else {
        mouseActive = false;
      }
    });
  }

  function frame(now) {
    ctx.clearRect(0, 0, W, H);

    if (!reduceMotion) drawAuras(now);

    // -------- movimento --------
    nodes.forEach(p => {
      if (!reduceMotion) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
        p.twinklePhase += p.twinkleSpeed;
      }
    });

    // -------- conexões --------
    ctx.lineWidth = 1;
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < linkDist) {
          const ratio = ((a.depth + b.depth) / 2 - 0.4) / 0.6;
          ctx.strokeStyle = `rgba(${gradColor(ratio * 0.7)},${(1 - d / linkDist) * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          edges.push({ a, b });
        }
      }
    }

    // -------- pulsos de dado --------
    maybeSpawnPulse(edges);
    pulses = pulses.filter(p => p.t < 1);
    pulses.forEach(p => {
      p.t += p.speed;
      const x = lerp(p.a.x, p.b.x, p.t);
      const y = lerp(p.a.y, p.b.y, p.t);
      const fade = Math.sin(Math.min(p.t, 1) * Math.PI); // entra e sai suave
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${gradColor(0.8)},0.9)`;
      ctx.fillStyle = `rgba(${gradColor(0.8)},${0.85 * fade})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // -------- nós --------
    nodes.forEach(p => {
      const parX = mouseActive ? mouseX * 9 * p.depth : 0;
      const parY = mouseActive ? mouseY * 9 * p.depth : 0;
      const twinkle = reduceMotion ? 1 : (Math.sin(p.twinklePhase) * 0.3 + 0.7);
      const color = gradColor((p.depth - 0.4) / 0.6 * 0.7);
      ctx.beginPath();
      if (p.feature) {
        ctx.save();
        ctx.shadowBlur = 7;
        ctx.shadowColor = `rgba(${color},0.85)`;
        ctx.fillStyle = `rgba(${color},${0.75 * twinkle})`;
        ctx.arc(p.x + parX, p.y + parY, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(${color},${0.55 * twinkle})`;
        ctx.arc(p.x + parX, p.y + parY, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  /* =========================================================
     7. BARRA DE PROGRESSO DE SCROLL + HEADER RETRÁTIL
  ========================================================= */
  const progressBar = document.getElementById('scroll-progress-bar');
  const header = document.getElementById('site-header');
  let scrollTicking = false;

  function onScrollUpdate() {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const scrollH = (doc.scrollHeight - doc.clientHeight) || 1;
    if (progressBar) progressBar.style.width = ((scrollTop / scrollH) * 100).toFixed(2) + '%';
    if (header) header.classList.toggle('scrolled', scrollTop > 40);
    scrollTicking = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(onScrollUpdate);
      scrollTicking = true;
    }
  }, { passive: true });
  onScrollUpdate();

  /* =========================================================
     8. NAV ATIVA CONFORME A SEÇÃO VISÍVEL
  ========================================================= */
  const navLinks = document.querySelectorAll('#nav-links a[data-nav]');
  if (navLinks.length) {
    const navMap = new Map();
    navLinks.forEach(a => {
      const id = a.getAttribute('data-nav');
      const section = document.getElementById(id);
      if (section) navMap.set(section, a);
    });
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const link = navMap.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    navMap.forEach((_, section) => navIO.observe(section));
  }

  /* =========================================================
     9. CONTADORES ANIMADOS (data-counter)
  ========================================================= */
  const counterEls = document.querySelectorAll('[data-counter]');
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function animateCounter(el) {
    const target = parseFloat(el.getAttribute('data-target') || '0');
    const suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const val = Math.round(target * easeOutExpo(t));
      el.textContent = val + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (counterEls.length) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counterEls.forEach(el => counterIO.observe(el));
  }

  /* =========================================================
     10. FAQ ACCORDION
  ========================================================= */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-q');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(other => {
        other.classList.remove('open');
        const otherBtn = other.querySelector('.faq-q');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* =========================================================
     11. FORMULÁRIO DE LEAD → DEEP LINK WHATSAPP
     Sem backend: valida os campos, monta a mensagem e abre o
     WhatsApp já preenchido. Loga localmente (localStorage) pra
     o dono do site ter um histórico simples enquanto não houver
     um CRM/planilha integrados.
  ========================================================= */
  const leadForm = document.getElementById('lead-form');
  if (leadForm) {
    const WHATSAPP_NUMBER = '5551993368040';
    const nameInput = document.getElementById('lead-name');
    const phoneInput = document.getElementById('lead-phone');
    const challengeInput = document.getElementById('lead-challenge');

    function setFieldError(input, message) {
      const field = input.closest('.lead-field');
      const errorEl = leadForm.querySelector(`[data-error-for="${input.id}"]`);
      if (field) field.classList.toggle('invalid', !!message);
      if (errorEl) errorEl.textContent = message || '';
    }

    function validatePhone(value) {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    }

    // Máscara (XX) XXXXX-XXXX (celular) / (XX) XXXX-XXXX (fixo), formatando
    // enquanto a pessoa digita — sem libs externas, só regex progressiva.
    function maskPhoneBR(raw) {
      const d = raw.replace(/\D/g, '').slice(0, 11);
      if (!d) return '';
      if (d.length <= 2) return `(${d}`;
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    phoneInput.addEventListener('input', () => {
      const cursorAtEnd = phoneInput.selectionEnd === phoneInput.value.length;
      phoneInput.value = maskPhoneBR(phoneInput.value);
      if (cursorAtEnd) phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    });

    leadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      if (!nameInput.value.trim()) {
        setFieldError(nameInput, 'Informe seu nome.');
        valid = false;
      } else {
        setFieldError(nameInput, '');
      }

      if (!validatePhone(phoneInput.value)) {
        setFieldError(phoneInput, 'Informe um WhatsApp válido, com DDD.');
        valid = false;
      } else {
        setFieldError(phoneInput, '');
      }

      if (!valid) {
        const firstInvalid = leadForm.querySelector('.lead-field.invalid input');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const challenge = challengeInput.value.trim();

      let message = `Olá, sou ${name}. Quero começar pelo Gauss Scan.`;
      if (challenge) message += ` Meu maior desafio com dados hoje: ${challenge}.`;
      message += ` (Meu WhatsApp: ${phone})`;

      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      // histórico local simples — não é enviado a lugar nenhum, fica só no navegador do visitante
      try {
        const log = JSON.parse(localStorage.getItem('gaussdata_leads') || '[]');
        log.push({ name, phone, challenge, ts: new Date().toISOString() });
        localStorage.setItem('gaussdata_leads', JSON.stringify(log.slice(-20)));
      } catch (err) { /* localStorage indisponível — segue sem log local */ }

      const fallbackLink = document.getElementById('lead-fallback-link');
      if (fallbackLink) fallbackLink.href = waUrl;
      const successName = document.getElementById('lead-success-name');
      if (successName) successName.textContent = name.split(' ')[0];

      leadForm.classList.add('sent');
      trackEvent('lead_submit', { tem_desafio: !!challenge });
      window.open(waUrl, '_blank', 'noopener');
    });

    [nameInput, phoneInput].forEach(input => {
      input.addEventListener('input', () => setFieldError(input, ''));
    });
  }

  /* =========================================================
     12. RIPPLE NOS BOTÕES
  ========================================================= */
  if (!reduceMotion) {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.6;
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  }

  /* =========================================================
     13. PARALLAX SUTIL NO VISUAL DO HERO (scroll)
  ========================================================= */
  const heroVisual = document.querySelector('.hero-visual');
  // Só roda em telas largas: abaixo de 900px o CSS usa .hero-visual como
  // marca d'água posicionada via transform, e sobrescrever isso via JS
  // quebraria aquele layout.
  const isWideScreen = window.matchMedia('(min-width: 900px)').matches;
  if (heroVisual && hero && !reduceMotion && isWideScreen) {
    let parallaxTicking = false;
    function updateParallax() {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
      heroVisual.style.transform = `translateY(${progress * 40}px)`;
      heroVisual.style.opacity = String(1 - progress * 0.6);
      parallaxTicking = false;
    }
    window.addEventListener('scroll', () => {
      if (!parallaxTicking) {
        requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    }, { passive: true });
  }

  /* =========================================================
     14. RASTREAMENTO DE EVENTOS (GA4 / Meta Pixel — plug-and-play)
     Não faz nada sozinho: só dispara de verdade quando você
     instalar o gtag.js (GA4) e/ou o Pixel da Meta na página.
     Até lá, os eventos ficam disponíveis no console pra você
     testar (?debug=1 na URL) e comparar variantes do outreach.
  ========================================================= */
  function trackEvent(name, params) {
    params = params || {};
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
      if (typeof window.fbq === 'function') window.fbq('trackCustom', name, params);
      const debugOn = window.location.search.indexOf('debug=1') !== -1 || window.location.hostname === 'localhost';
      if (debugOn) console.log('[gauss:event]', name, params);
    } catch (err) { /* provedor de analytics indisponível — não deve quebrar a página */ }
  }
  window.gaussTrackEvent = trackEvent; // acessível no console pra debug manual

  // Clique em qualquer CTA que leva ao WhatsApp — identifica de qual
  // seção veio, útil pra saber qual bloco da página realmente converte.
  document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
    link.addEventListener('click', () => {
      const section = link.closest('section, header, footer');
      trackEvent('whatsapp_click', {
        origem: (section && section.id) || 'wa_float',
        rotulo: link.textContent.trim().slice(0, 60)
      });
    });
  });

  // Profundidade de scroll — sinaliza engajamento real com o conteúdo,
  // não só visita rápida que sai no primeiro dobra.
  (function trackScrollDepth() {
    const marks = [25, 50, 75, 100];
    const fired = new Set();
    let depthTicking = false;
    function checkDepth() {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollH = (doc.scrollHeight - doc.clientHeight) || 1;
      const pct = (scrollTop / scrollH) * 100;
      marks.forEach(m => {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          trackEvent('scroll_depth', { porcentagem: m });
        }
      });
      depthTicking = false;
    }
    window.addEventListener('scroll', () => {
      if (!depthTicking) {
        requestAnimationFrame(checkDepth);
        depthTicking = true;
      }
    }, { passive: true });
  })();

  /* =========================================================
     15. BOTÃO FLUTUANTE DO WHATSAPP
     Aparece depois que a hero sai da tela, some quando o
     visitante volta pro topo — evita competir com os CTAs
     principais da primeira dobra.
  ========================================================= */
  const waFloat = document.getElementById('wa-float');
  if (waFloat && hero) {
    const waFloatIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        waFloat.classList.toggle('visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    waFloatIO.observe(hero);
  }
})();