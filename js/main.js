// * ============================================================================
// * Portfolio (index.html) — client-side behaviors
// * Theme toggle, mobile nav, active section highlighting, contact mailto, footer
// * ============================================================================

// * ---------------------------------------------------------------------------
// * DOM helpers — thin wrappers so call sites stay short
// * ---------------------------------------------------------------------------

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// * ---------------------------------------------------------------------------
// * Footer — dynamic copyright year (#year in index.html)
// * ---------------------------------------------------------------------------

function setYear() {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

// * ---------------------------------------------------------------------------
// * Theme — <html data-theme="dark|light"> + localStorage("theme")
// * Initial theme is set by an inline script in <head> to avoid flash (FOUC).
// * ---------------------------------------------------------------------------

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyThemeUi(theme) {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  // * aria-label describes what happens on click (next mode), not current mode
  btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function setTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    // * Private mode / disabled storage — page still works for this session
  }
  applyThemeUi(next);
}

function setupThemeToggle() {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;

  applyThemeUi(getTheme());

  btn.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });
}

// * ---------------------------------------------------------------------------
// * Mobile navigation — hamburger toggles #site-nav.is-open
// * Clicks outside the drawer close it; choosing a link closes it too.
// * ---------------------------------------------------------------------------

function setupMobileNav() {
  const toggle = $(".nav-toggle");
  const nav = $("#site-nav");
  if (!toggle || !nav) return;

  function setOpen(nextOpen) {
    nav.classList.toggle("is-open", nextOpen);
    toggle.setAttribute("aria-expanded", String(nextOpen));
  }

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.contains("is-open");
    setOpen(!isOpen);
  });

  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) setOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (e.target === toggle || toggle.contains(e.target)) return;
    if (e.target === nav || nav.contains(e.target)) return;
    setOpen(false);
  });
}

// * ---------------------------------------------------------------------------
// * Active nav link — .nav__link.is-active follows scroll position
// * Uses IntersectionObserver + “closest to sticky header” heuristic (see below).
// * ---------------------------------------------------------------------------

function setupActiveNav() {
  const links = $all(".nav__link");
  if (!links.length) return;

  function setActiveById(id) {
    for (const link of links) link.classList.remove("is-active");
    const next = idToLink.get(id);
    if (next) next.classList.add("is-active");
  }

  const idToLink = new Map();
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#") && href.length > 1) idToLink.set(href.slice(1), link);
  }

  // * Immediate feedback on click (don’t wait for the observer tick)
  for (const link of links) {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#") && href.length > 1) setActiveById(href.slice(1));
    });
  }

  const sections = Array.from(idToLink.keys())
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length) return;

  const header = $(".header");
  const headerOffset = (header ? header.offsetHeight : 0) + 12;

  const obs = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (!visible.length) return;

      // * Pick the visible section whose top edge is nearest the header line.
      // * Works better than “largest intersection ratio” when jumping between anchors.
      const best = visible
        .map((e) => ({
          id: e.target.id,
          delta: Math.abs(e.boundingClientRect.top - headerOffset),
        }))
        .sort((a, b) => a.delta - b.delta)[0];

      if (best?.id) setActiveById(best.id);
    },
    {
      root: null,
      // * rootMargin shrinks the viewport from the top so “active” means “under the sticky header”
      rootMargin: `-${headerOffset}px 0px -55% 0px`,
      threshold: [0, 0.01],
    }
  );

  for (const section of sections) obs.observe(section);
}

// * ---------------------------------------------------------------------------
// * Footer “Back to top” — always scroll (hash-only links can no-op if URL unchanged)
// * Clears the hash with replaceState so repeat clicks still scroll.
// * ---------------------------------------------------------------------------

function setupBackToTop() {
  const link = $(".footer__top");
  if (!link) return;

  link.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const path = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", path);
    } catch {
      // * Very old browsers — scroll already happened above
    }
  });
}

// * ---------------------------------------------------------------------------
// * Contact form — validate client-side, then mailto: (no backend on this site)
// * ---------------------------------------------------------------------------

function setupContactForm() {
  const form = $("#contact-form");
  const note = $("#form-note");
  if (!form || !note) return;

  function setNote(msg, ok = true) {
    note.textContent = msg;
    // ? Consider moving these colors to CSS variables if you theme the form note
    note.style.color = ok ? "rgba(46, 196, 182, 0.78)" : "rgba(255, 120, 120, 0.95)";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const message = String(fd.get("message") || "").trim();

    if (!name || !email || !message) {
      setNote("Please fill out name, email, and message.", false);
      return;
    }

    const subject = encodeURIComponent(`Portfolio message from ${name}`);
    const body = encodeURIComponent(`From: ${name}\nEmail: ${email}\n\n${message}`);

    //! Replace with your real address (must match index.html mailto if you change it there)
    const to = "yourname@example.com";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    setNote("Opening your email app…");
    form.reset();
  });

  form.addEventListener("reset", () => setNote(""));
}

// * ---------------------------------------------------------------------------
// * Boot — safe to call in order; each setup* bails if its markup is missing
// * ---------------------------------------------------------------------------

setYear();
setupThemeToggle();
setupBackToTop();
setupMobileNav();
setupActiveNav();
setupContactForm();
setupParticles();

// * ---------------------------------------------------------------------------
// * Particle Network Background
// * ---------------------------------------------------------------------------

function setupParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  // Insert at the very beginning of body
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  const mouse = { x: null, y: null, radius: 150 };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initParticles();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
  });
  window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
  });

  class Particle {
    constructor() {
      this.size = (Math.random() * 1.5) + 0.5;
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.8;
      this.vy = (Math.random() - 0.5) * 0.8;
      this.baseVx = this.vx;
      this.baseVy = this.vy;
    }
    
    draw(color) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    
    update() {
      // Bounce off edges
      if (this.x > width || this.x < 0) {
        this.vx = -this.vx;
        this.baseVx = -this.baseVx;
      }
      if (this.y > height || this.y < 0) {
        this.vy = -this.vy;
        this.baseVy = -this.baseVy;
      }
      
      this.x += this.vx;
      this.y += this.vy;

      // Friction to return to base speed
      this.vx += (this.baseVx - this.vx) * 0.05;
      this.vy += (this.baseVy - this.vy) * 0.05;
    }
  }

  function initParticles() {
    particles = [];
    // Adjust density based on screen size
    const numberOfParticles = Math.floor((width * height) / 10000);
    for (let i = 0; i < numberOfParticles; i++) {
      particles.push(new Particle());
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, width, height);
    
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    // Using the accent colors from CSS
    const particleRgb = isLight ? '26, 157, 145' : '46, 196, 182';
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.update();
      p.draw(`rgba(${particleRgb}, 0.8)`);
      
      // Check connections
      for (let j = i; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${particleRgb}, ${0.2 - distance/600})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      
      // Mouse interaction
      if (mouse.x != null && mouse.y != null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mouse.radius) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${particleRgb}, ${0.4 - distance/mouse.radius})`;
          ctx.lineWidth = 1;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();

          // Gravity / following effect: particles get pulled towards the mouse slowly
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (mouse.radius - distance) / mouse.radius;
          
          p.vx -= forceDirectionX * force * 0.05;
          p.vy -= forceDirectionY * force * 0.05;
        }
      }
    }
  }

  resize();
  animate();
}
