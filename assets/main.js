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

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
/* ease in and out — the paths creep off the start, race through the middle,
   then settle as they reach T */
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/* Stroke a polyline up to a fractional index, interpolating the final partial
   segment. Without the interpolation the leading edge would jump a whole step
   at a time, which reads as stuttering at these step counts. Returns the head
   point so callers can put a dot on it. */
function strokeUpTo(ctx, pt, n, f) {
  const i0 = Math.max(0, Math.min(Math.floor(f), n));
  const first = pt(0);
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i <= i0; i++) {
    const p = pt(i);
    ctx.lineTo(p[0], p[1]);
  }
  let head = pt(i0);
  if (i0 < n) {
    const fr = f - i0;
    const a = pt(i0), b = pt(i0 + 1);
    head = [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr];
    if (fr > 0) ctx.lineTo(head[0], head[1]);
  }
  ctx.stroke();
  return head;
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

function drawCLT({ ctx, w, h }, { steps, walks }, prog) {
  const pal = thumbPalette();
  const pad = 10;
  const split = w * 0.78;              /* walks left of here, limit law right */
  const mid = h / 2;
  const half = mid - pad;
  const scale = half / (3.1 * Math.sqrt(steps));   /* ±3.1σ fits the panel */
  const X = (i) => pad + (i / steps) * (split - pad);
  const Y = (v) => mid - v * scale;
  const f = prog.walks * steps;        /* fractional step the sweep has reached */

  /* ±1σ and ±2σ envelopes, growing alongside the walks they contain */
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const k of [1, 2]) {
    for (const sign of [1, -1]) {
      ctx.strokeStyle = mixRGB(pal.b, pal.b, 0, k === 1 ? 0.5 : 0.26);
      strokeUpTo(ctx, (i) => [X(i), Y(sign * k * Math.sqrt(i))], steps, f);
    }
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 1;
  strokeUpTo(ctx, (i) => [X(i), mid], steps, f);

  walks.forEach((path, k) => {
    ctx.strokeStyle = mixRGB(pal.a, pal.b, k / (walks.length - 1), 0.5);
    ctx.lineWidth = 1.1;
    strokeUpTo(ctx, (i) => [X(i), Y(path[i])], steps, f);
  });

  /* the Gaussian they converge to, swelling out of the split line once the
     walks have landed */
  if (prog.bell <= 0) return;
  const sd = Math.sqrt(steps), bell = (w - split - pad * 0.5) * prog.bell;
  ctx.beginPath();
  for (let y = pad; y <= h - pad; y++) {
    const z = (mid - y) / (sd * scale);
    const x = split + Math.exp(-(z * z) / 2) * bell;
    y === pad ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = mixRGB(pal.a, pal.b, 0.5, 0.85 * prog.bell);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineTo(split, h - pad);
  ctx.lineTo(split, pad);
  ctx.closePath();
  ctx.fillStyle = mixRGB(pal.a, pal.b, 0.5, 0.12 * prog.bell);
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

function drawIto({ ctx, w, h }, { steps, paths }, prog) {
  const pal = thumbPalette();
  const pad = 10;
  /* scale to the full sample, not the drawn prefix, so the frame doesn't
     rescale under the paths as they advance */
  let lo = Infinity, hi = -Infinity;
  for (const p of paths) for (const v of p) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const X = (i) => pad + (i / steps) * (w - 2 * pad);
  const Y = (v) => h - pad - ((v - lo) / span) * (h - 2 * pad);
  const f = prog.paths * steps;

  /* X₀ = 1, the common start every path diffuses away from */
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(pad, Y(1));
  ctx.lineTo(pad + (w - 2 * pad) * prog.paths, Y(1));
  ctx.stroke();
  ctx.setLineDash([]);

  paths.forEach((path, k) => {
    const t = k / (paths.length - 1);
    ctx.strokeStyle = mixRGB(pal.a, pal.b, t, 0.82);
    ctx.lineWidth = 1.3;
    const head = strokeUpTo(ctx, (i) => [X(i), Y(path[i])], steps, f);

    /* dot rides the leading edge, and comes to rest at X_T */
    ctx.fillStyle = mixRGB(pal.a, pal.b, t, 0.9);
    ctx.beginPath();
    ctx.arc(head[0], head[1], 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function simulateNbhd() {
  const count = 20;
  /* Strictly decreasing radii, with enough jitter that a resample looks new.
     Decay is deliberately slow: a fast one crams the tail into a few pixels
     and the whole point of the picture is that you can see the tail. */
  const decay = 0.855 + Math.random() * 0.04;
  const turn = 2.0 + Math.random() * 0.9;          /* radians per step */
  const phase = Math.random() * Math.PI * 2;
  const pts = [];
  let r = 1;
  for (let k = 0; k < count; k++) {
    const th = phase + k * turn;
    pts.push({ r, x: r * Math.cos(th), y: r * Math.sin(th) });
    r *= decay * (0.94 + Math.random() * 0.12);    /* worst case 0.895*1.06 < 1 */
  }
  return { pts };
}

function drawNbhd({ ctx, w, h }, { pts }, prog) {
  const pal = thumbPalette();
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.42;
  const px = (p) => cx + p.x * R;
  const py = (p) => cy + p.y * R;
  const n = pts.length;
  const f = prog.seq * (n - 1);
  const shown = Math.min(Math.floor(f), n - 1);

  /* The open ball B(x, eps). It starts wide enough to hold the whole sequence
     and tightens, so the picture reads as "for every eps, a tail lies inside". */
  const eps = R * (1.10 - 0.58 * prog.eps);
  ctx.beginPath();
  ctx.arc(cx, cy, eps, 0, Math.PI * 2);
  ctx.fillStyle = mixRGB(pal.a, pal.b, 0.5, 0.09);
  ctx.fill();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = mixRGB(pal.b, pal.b, 0, 0.75);
  ctx.stroke();
  ctx.setLineDash([]);

  /* the sequence, revealed term by term */
  ctx.strokeStyle = mixRGB(pal.a, pal.b, 0.5, 0.22);
  ctx.lineWidth = 1;
  strokeUpTo(ctx, (i) => [px(pts[i]), py(pts[i])], n - 1, f);

  /* terms inside the ball light up; the finitely many outside stay dim */
  for (let k = 0; k <= shown; k++) {
    const q = pts[k];
    const inside = q.r * R <= eps;
    const t = k / (n - 1);
    ctx.beginPath();
    ctx.arc(px(q), py(q), inside ? 2.6 : 1.8, 0, Math.PI * 2);
    ctx.fillStyle = mixRGB(pal.a, pal.b, t, inside ? 0.95 : 0.32);
    ctx.fill();
  }

  /* the limit */
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = mixRGB(pal.a, pal.b, 0.5, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.strokeStyle = mixRGB(pal.a, pal.b, 0.5, 0.42);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/* Each panel keeps its sample *and* how far through the animation it is, so a
   theme flip or a resize re-renders the current frame rather than snapping to
   the finished drawing. */
const thumbState = new WeakMap();

const ITO_MS = 3200, CLT_WALK_MS = 2600, CLT_BELL_MS = 1100;
const NBHD_SEQ_MS = 2400, NBHD_EPS_MS = 1700;

/* One entry per data-viz value. Adding a fourth visualisation means adding a
   key here and nothing else — the state, render, animation and resample paths
   all read from this table rather than branching on the name. */
const VIZ = {
  ito: {
    simulate: simulateIto,
    draw: drawIto,
    zero: () => ({ paths: 0 }),
    full: () => ({ paths: 1 }),
    duration: ITO_MS,
    step: (p, ms) => { p.paths = easeInOutCubic(clamp01(ms / ITO_MS)); },
  },
  clt: {
    simulate: simulateWalks,
    draw: drawCLT,
    zero: () => ({ walks: 0, bell: 0 }),
    full: () => ({ walks: 1, bell: 1 }),
    duration: CLT_WALK_MS + CLT_BELL_MS,
    /* walks sweep out first, then the limit law appears */
    step: (p, ms) => {
      p.walks = easeInOutCubic(clamp01(ms / CLT_WALK_MS));
      p.bell = easeOutCubic(clamp01((ms - CLT_WALK_MS) / CLT_BELL_MS));
    },
  },
  nbhd: {
    simulate: simulateNbhd,
    draw: drawNbhd,
    zero: () => ({ seq: 0, eps: 0 }),
    full: () => ({ seq: 1, eps: 1 }),
    duration: NBHD_SEQ_MS + NBHD_EPS_MS,
    /* the sequence converges first, then the neighbourhood closes in on it */
    step: (p, ms) => {
      p.seq = easeInOutCubic(clamp01(ms / NBHD_SEQ_MS));
      p.eps = easeInOutCubic(clamp01((ms - NBHD_SEQ_MS) / NBHD_EPS_MS));
    },
  },
};

function thumbStateFor(cv, viz) {
  let st = thumbState.get(cv);
  if (!st) {
    st = {
      sample: VIZ[viz].simulate(),
      prog: VIZ[viz].zero(),
      raf: 0,
    };
    thumbState.set(cv, st);
  }
  return st;
}

function renderThumb(cv, viz) {
  if (!VIZ[viz]) return null;          /* unknown data-viz — leave the panel blank */
  const dims = thumbCtx(cv);
  if (!dims) return null;              /* compact view — canvas is display:none */
  const st = thumbStateFor(cv, viz);
  VIZ[viz].draw(dims, st.sample, st.prog);
  return st;
}

function drawNoteThumbs() {
  document.querySelectorAll(".note-row[data-viz]").forEach((row) => {
    const cv = row.querySelector(".note-thumb");
    if (cv) renderThumb(cv, row.dataset.viz);
  });
}

function animateThumb(cv, viz) {
  const spec = VIZ[viz];
  if (!spec) return;
  const st = thumbStateFor(cv, viz);
  if (st.raf) cancelAnimationFrame(st.raf);
  st.raf = 0;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    st.prog = spec.full();
    renderThumb(cv, viz);
    return;
  }

  /* Browsers freeze rAF in a hidden tab. Rewinding to zero here would leave the
     panel blank for anyone who opens the page in a background tab, so wait for
     the tab to surface and start then — with whatever is drawn left untouched. */
  if (document.hidden) {
    document.addEventListener("visibilitychange", () => animateThumb(cv, viz), { once: true });
    return;
  }

  st.prog = spec.zero();
  const start = performance.now();
  const tick = (now) => {
    const ms = now - start;
    spec.step(st.prog, ms);
    const done = ms >= spec.duration;
    renderThumb(cv, viz);
    st.raf = done ? 0 : requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}

function startThumbAnimations() {
  document.querySelectorAll(".note-row[data-viz]").forEach((row) => {
    const cv = row.querySelector(".note-thumb");
    if (cv && cv.clientWidth) animateThumb(cv, row.dataset.viz);
  });
}

/* Throw away the cached sample and draw a fresh one, so the button gives new
   randomness rather than replaying the same paths. */
function resampleThumbs() {
  document.querySelectorAll(".note-row[data-viz]").forEach((row) => {
    const cv = row.querySelector(".note-thumb");
    if (!cv || !cv.clientWidth) return;
    const viz = row.dataset.viz;
    if (!VIZ[viz]) return;
    thumbStateFor(cv, viz).sample = VIZ[viz].simulate();
    animateThumb(cv, viz);
  });
}

function setNotesView(view, persist) {
  const wrap = document.querySelector(".term-notes");
  if (!wrap) return;
  const wasGrid = wrap.classList.contains("view-grid");
  wrap.classList.toggle("view-grid", view === "grid");
  document.querySelectorAll(".view-btn").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.view === view))
  );
  if (persist) localStorage.setItem("notesView", view);
  if (view !== "grid") return;

  /* Canvases have no width until the grid class lands, so wait for layout.
       compact -> icons : fresh sample, so the panels aren't the ones you left
       icons  -> icons  : replay the same paths
       first load       : just paint; the observer starts it once on screen */
  const arriving = persist && !wasGrid;
  requestAnimationFrame(() => {
    if (!persist) drawNoteThumbs();
    else if (arriving) resampleThumbs();
    else startThumbAnimations();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateToggleIcon();
  drawVoronoi(true);

  if (document.querySelector(".term-notes")) {
    setNotesView(localStorage.getItem("notesView") === "grid" ? "grid" : "compact", false);
    document.querySelectorAll(".view-btn").forEach((btn) =>
      btn.addEventListener("click", () => setNotesView(btn.dataset.view, true))
    );

    const resampleBtn = document.querySelector(".resample-btn");
    if (resampleBtn) {
      resampleBtn.addEventListener("click", () => {
        /* resampling is only visible in icon view — go there rather than doing
           nothing, so the button always does something. The switch resamples on
           its own, so don't also do it here and draw two samples. */
        if (document.querySelector(".term-notes.view-grid")) resampleThumbs();
        else setNotesView("grid", true);
        resampleBtn.classList.remove("spin");
        void resampleBtn.offsetWidth;          /* restart the spin on rapid clicks */
        resampleBtn.classList.add("spin");
      });
      resampleBtn.addEventListener("animationend", () => resampleBtn.classList.remove("spin"));
    }

    /* A thumb has no size until the grid class lands, and its width shifts again
       when the scrollbar appears. Redrawing on the actual box change covers both,
       and is exact where a one-shot rAF can fire at a stale width. Cheap, since
       the sample is cached — this only recolours/rescales. */
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => drawNoteThumbs());
      document.querySelectorAll(".note-thumb").forEach((c) => ro.observe(c));
    }

    /* Observe each panel, not the whole section. The section is tall enough that
       it never drops back under its threshold on a normal screen, so watching it
       fires once on load and can never re-fire — which looks exactly like "it
       doesn't animate". A 156px canvas scrolls in and out easily. */
    if ("IntersectionObserver" in window) {
      const playObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const row = e.target.closest(".note-row[data-viz]");
            if (e.isIntersecting && row && e.target.clientWidth) {
              animateThumb(e.target, row.dataset.viz);
            }
          });
        },
        { threshold: 0.4 }
      );
      document.querySelectorAll(".note-thumb").forEach((c) => playObserver.observe(c));
    } else {
      startThumbAnimations();
    }

    /* Hovering a card replays its panel — a dependable way to actually watch the
       thing, rather than hoping to catch it on load. Ignored mid-run so mouse
       jitter doesn't restart it. */
    document.querySelectorAll(".note-row[data-viz]").forEach((row) => {
      row.addEventListener("mouseenter", () => {
        const cv = row.querySelector(".note-thumb");
        if (!cv || !cv.clientWidth) return;
        const st = thumbState.get(cv);
        if (!st || !st.raf) animateThumb(cv, row.dataset.viz);
      });
    });
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
  /* Trigger on a margin, not a ratio. A ratio threshold is unreachable once an
     element is taller than 1/threshold viewports — a long blog post is ~14
     screens, so `threshold: 0.1` could never fire and the article stayed at
     opacity 0 forever. Shrinking the root's bottom edge instead asks "is it 8%
     of a screen into view", which behaves the same for cards and still fires
     for something arbitrarily tall. */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -8% 0px" }
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
