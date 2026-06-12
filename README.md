# rexhouyang.github.io

Personal research website — homepage, research projects, and resume. Plain HTML/CSS/JS, no build step, designed for GitHub Pages. Flavor: machine learning, optimization, probability.

## Deploy to GitHub Pages

1. Create a repo named **`rexhouyang.github.io`** (must match your GitHub username exactly).
2. Push this folder:
   ```sh
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/rexhouyang/rexhouyang.github.io.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
4. Your site goes live at `https://rexhouyang.github.io` within a minute or two.

## Customizing

| What | Where |
|---|---|
| Name, typing phrases ("I like …") | `index.html` (hero section; phrases are in the `data-phrases` attribute) |
| About me text, title, location | `index.html` (about section + profile card) |
| Profile photo | drop your file at `assets/profile.jpg` (square crop looks best; initials show until then) |
| Selected projects + filters | `projects.html` — duplicate a `<article class="card">` block per project; `data-tags` controls filtering (`ml`, `optimization`, `probability`, `information`) |
| Resume content | `resume.html` — education, experience, skills, awards sections |
| Resume PDF | drop your file at `assets/resume.pdf` (the download buttons already point there) |
| Social links (github / scholar / linkedin / email) | footer of every page |
| Colors / fonts | CSS variables at the top of `assets/style.css` (`--accent`, `--accent-2`, etc.) |

## Features

- Dark/light theme toggle (remembers your choice, respects system preference)
- Animated typing effect, scroll-reveal animations, cursor-glow cards
- Research project filtering by area, no frameworks or dependencies
- Responsive down to mobile widths; respects `prefers-reduced-motion`
