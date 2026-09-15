/* ============ theme toggle ============ */
(function () {
  const saved = localStorage.getItem("theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = saved || (prefersLight ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", theme);
})();

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateToggleIcon();
  drawVoronoi();
  drawNoteThumbs();
}

function updateToggleIcon() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  btn.textContent = isLight ? "☾" : "☀";
  btn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
}

/* ============ Poisson–Voronoi background ============
   Uniform (Poisson) seeds, then each cell is carved out by clipping the
   viewport rectangle against the perpendicular bisector to every other
   seed. Fresh sample every page load. */
function clipHalfPlane(poly, dx, dy, mx, my) {
  const side = (p) => (p[0] - mx) * dx + (p[1] - my) * dy;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const a = side(A), b = side(B);
    if (a <= 0) out.push(A);
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
      const t = a / (a - b);
      out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]);
    }
  }
  return out;
}

let voronoiPoints = null;

function drawVoronoi(resample) {
  const cv = document.getElementById("bg-voronoi");
  if (!cv) return;

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const light = document.documentElement.getAttribute("data-theme") === "light";
  const edgeColor = light ? "rgba(13, 148, 136, 0.18)" : "rgba(94, 234, 212, 0.17)";
  const seedColor = light ? "rgba(99, 102, 241, 0.28)" : "rgba(129, 140, 248, 0.4)";

  /* resample only on load/resize — a theme flip should recolor, not reshuffle */
  if (resample || !voronoiPoints) {
    const spacing = 132;
    const count = Math.max(40, Math.min(200, Math.round((w * h) / (spacing * spacing))));
    voronoiPoints = [];
    for (let i = 0; i < count; i++) voronoiPoints.push([Math.random() * w, Math.random() * h]);
  }
  const pts = voronoiPoints;
  const n = pts.length;

  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.strokeStyle = edgeColor;

  for (let i = 0; i < n; i++) {
    let poly = [[-40, -40], [w + 40, -40], [w + 40, h + 40], [-40, h + 40]];
    for (let j = 0; j < n && poly.length; j++) {
      if (i === j) continue;
      poly = clipHalfPlane(
        poly,
        pts[j][0] - pts[i][0],
        pts[j][1] - pts[i][1],
        (pts[i][0] + pts[j][0]) / 2,
        (pts[i][1] + pts[j][1]) / 2
      );
    }
    if (poly.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k][0], poly[k][1]);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.fillStyle = seedColor;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ============ course-note thumbnails ============
   Generative panels for the icon view, in the same spirit as the background:
   sampled fresh on load, redrawn (not resampled) when the theme flips.
     "clt" — random walks fanning out under a √t envelope, with the limiting
             Gaussian drawn on the right edge. EE 226A, Donsker/CLT.
     "ito" — sample paths of dX = μX dt + σX dW, stepped with Euler–Maruyama,
             which is the scheme in Lecture 24 of the 226B notes. */
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function thumbPalette() {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  return light
    ? { a: [13, 148, 136], b: [99, 102, 241], faint: "rgba(15, 23, 42, 0.10)" }
    : { a: [94, 234, 212], b: [129, 140, 248], faint: "rgba(255, 255, 255, 0.09)" };
}

function mixRGB(c1, c2, t, alpha) {
  const c = [0, 1, 2].map((i) => Math.round(c1[i] + (c2[i] - c1[i]) * t));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/* size the backing store to DPR; returns null when the canvas is hidden */
function thumbCtx(cv) {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return { ctx, w, h };
}

function simulateWalks() {
  const steps = 64, count = 24;
  const walks = [];
  for (let k = 0; k < count; k++) {
    let s = 0;
    const path = [0];
    for (let i = 0; i < steps; i++) {
      s += Math.random() < 0.5 ? -1 : 1;
      path.push(s);
    }
    walks.push(path);
  }
  return { steps, walks };
}

function drawCLT({ ctx, w, h }, { steps, walks }) {
  const pal = thumbPalette();
  const pad = 10;
  const split = w * 0.78;              /* walks left of here, limit law right */
  const mid = h / 2;
  const half = mid - pad;
  const scale = half / (3.1 * Math.sqrt(steps));   /* ±3.1σ fits the panel */
  const X = (i) => pad + (i / steps) * (split - pad);
  const Y = (v) => mid - v * scale;

  /* ±1σ and ±2σ envelopes — the √t spread the walks live inside */
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const k of [1, 2]) {
    for (const sign of [1, -1]) {
      ctx.strokeStyle = mixRGB(pal.b, pal.b, 0, k === 1 ? 0.5 : 0.26);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const y = Y(sign * k * Math.sqrt(i));
        i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y);
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = pal.faint;
  ctx.beginPath();
  ctx.moveTo(pad, mid);
  ctx.lineTo(split, mid);
  ctx.stroke();

  walks.forEach((path, k) => {
    ctx.strokeStyle = mixRGB(pal.a, pal.b, k / (walks.length - 1), 0.5);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const y = Y(path[i]);
      i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y);
    }
    ctx.stroke();
  });

  /* the Gaussian they converge to, lying on its side */
  const sd = Math.sqrt(steps), bell = w - split - pad * 0.5;
  ctx.beginPath();
  for (let y = pad; y <= h - pad; y++) {
    const z = (mid - y) / (sd * scale);
    const x = split + Math.exp(-(z * z) / 2) * bell;
    y === pad ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = mixRGB(pal.a, pal.b, 0.5, 0.85);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineTo(split, h - pad);
  ctx.lineTo(split, pad);
  ctx.closePath();
  ctx.fillStyle = mixRGB(pal.a, pal.b, 0.5, 0.12);
  ctx.fill();
}

function simulateIto() {
  const steps = 180, count = 7, dt = 1 / steps, mu = 0.6, sigma = 0.62;
  const paths = [];
  for (let p = 0; p < count; p++) {
    let x = 1;
    const path = [x];
    for (let i = 0; i < steps; i++) {
      x += mu * x * dt + sigma * x * Math.sqrt(dt) * gauss();   /* Euler–Maruyama */
      path.push(Math.max(x, 1e-4));
    }
    paths.push(path);
  }
  return { steps, paths };
}

function drawIto({ ctx, w, h }, { steps, paths }) {
  const pal = thumbPalette();
  const pad = 10;
  let lo = Infinity, hi = -Infinity;
  for (const p of paths) for (const v of p) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const X = (i) => pad + (i / steps) * (w - 2 * pad);
  const Y = (v) => h - pad - ((v - lo) / span) * (h - 2 * pad);

  /* X₀ = 1, the common start every path diffuses away from */
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(pad, Y(1));
  ctx.lineTo(w - pad, Y(1));
  ctx.stroke();
  ctx.setLineDash([]);

  paths.forEach((path, k) => {
    ctx.strokeStyle = mixRGB(pal.a, pal.b, k / (paths.length - 1), 0.82);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const y = Y(path[i]);
      i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y);
    }
    ctx.stroke();

    ctx.fillStyle = mixRGB(pal.a, pal.b, k / (paths.length - 1), 0.9);
    ctx.beginPath();
    ctx.arc(X(steps), Y(path[steps]), 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* keep each panel's sample so a theme flip recolors rather than reshuffles */
const thumbSamples = new WeakMap();

function drawNoteThumbs() {
  document.querySelectorAll(".note-row[data-viz]").forEach((row) => {
    const cv = row.querySelector(".note-thumb");
    if (!cv) return;
    const dims = thumbCtx(cv);
    if (!dims) return;                 /* compact view — canvas is display:none */
    const ito = row.dataset.viz === "ito";
    let sample = thumbSamples.get(cv);
    if (!sample) {
      sample = ito ? simulateIto() : simulateWalks();
      thumbSamples.set(cv, sample);
    }
    (ito ? drawIto : drawCLT)(dims, sample);
  });
}

function setNotesView(view, persist) {
  const wrap = document.querySelector(".term-notes");
  if (!wrap) return;
  wrap.classList.toggle("view-grid", view === "grid");
  document.querySelectorAll(".view-btn").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.view === view))
  );
  if (persist) localStorage.setItem("notesView", view);
  /* canvases have no width until the grid class lands, so draw after layout */
  if (view === "grid") requestAnimationFrame(drawNoteThumbs);
}

document.addEventListener("DOMContentLoaded", () => {
  updateToggleIcon();
  drawVoronoi(true);

  if (document.querySelector(".term-notes")) {
    setNotesView(localStorage.getItem("notesView") === "grid" ? "grid" : "compact", false);
    document.querySelectorAll(".view-btn").forEach((btn) =>
      btn.addEventListener("click", () => setNotesView(btn.dataset.view, true))
    );

    /* A thumb has no size until the grid class lands, and its width shifts again
       when the scrollbar appears. Redrawing on the actual box change covers both,
       and is exact where a one-shot rAF can fire at a stale width. Cheap, since
       the sample is cached — this only recolours/rescales. */
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => drawNoteThumbs());
      document.querySelectorAll(".note-thumb").forEach((c) => ro.observe(c));
    }
  }

  /* redraw only on real viewport changes, not mobile scroll chrome */
  let lastW = window.innerWidth, lastH = window.innerHeight, resizeTimer;
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(w - lastW) < 50 && Math.abs(h - lastH) < 200) return;
    lastW = w;
    lastH = h;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawVoronoi(true);
      drawNoteThumbs();
    }, 180);
  });

  /* ============ scroll reveal ============ */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

  /* ============ card cursor glow ============ */
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - rect.left + "px");
      card.style.setProperty("--my", e.clientY - rect.top + "px");
    });
  });

  /* ============ project filters ============ */
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projects = document.querySelectorAll("[data-tags]");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      projects.forEach((p) => {
        const show = filter === "all" || p.dataset.tags.split(" ").includes(filter);
        p.style.display = show ? "" : "none";
      });
    });
  });
});
