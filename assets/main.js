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

document.addEventListener("DOMContentLoaded", () => {
  updateToggleIcon();
  drawVoronoi(true);

  /* redraw only on real viewport changes, not mobile scroll chrome */
  let lastW = window.innerWidth, lastH = window.innerHeight, resizeTimer;
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(w - lastW) < 50 && Math.abs(h - lastH) < 200) return;
    lastW = w;
    lastH = h;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawVoronoi(true), 180);
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
