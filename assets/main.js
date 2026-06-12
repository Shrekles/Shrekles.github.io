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
}

function updateToggleIcon() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  btn.textContent = isLight ? "☾" : "☀";
  btn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
}

document.addEventListener("DOMContentLoaded", () => {
  updateToggleIcon();

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

  /* ============ typing effect (homepage) ============ */
  const typeTarget = document.getElementById("typed");
  if (typeTarget) {
    const phrases = JSON.parse(typeTarget.dataset.phrases);
    let pi = 0, ci = 0, deleting = false;

    function tick() {
      const phrase = phrases[pi];
      typeTarget.textContent = phrase.slice(0, ci);
      if (!deleting) {
        ci++;
        if (ci > phrase.length) {
          deleting = true;
          setTimeout(tick, 1800);
          return;
        }
        setTimeout(tick, 65);
      } else {
        ci--;
        if (ci === 0) {
          deleting = false;
          pi = (pi + 1) % phrases.length;
        }
        setTimeout(tick, 35);
      }
    }
    tick();
  }
});
