


<div align="center">
  <img width="200" height="200" src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/682fa8d0d40dcee8ab8c3a17_logo.png" alt="Visual model building interface" />
  <h1>GraphSpace</h1>
  <p><b>Visual Machine Learning. Frictionless Building. Real Understanding.</b></p>

 <p>
  <a href="#"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-red.svg"/></a>
  <a href="#"><img alt="Python Version" src="https://img.shields.io/badge/python-3.12+-yellow.svg"/></a>
  
  <a href="#"><img alt="Frontend" src="https://img.shields.io/badge/frontend-React-61DAFB?logo=react&logoColor=black"/></a>
  <a href="#"><img alt="Graphics" src="https://img.shields.io/badge/graphics-WebGL-990000?logo=webgl&logoColor=white"/></a>
  
  <a href="#"><img alt="API" src="https://img.shields.io/badge/backend-FastAPI-05998b?logo=fastapi&logoColor=white"/></a>
  <a href="#"><img alt="Database" src="https://img.shields.io/badge/database-SQLite-003B57?logo=sqlite&logoColor=white"/></a>

  <a href="#"><img alt="PRs" src="https://img.shields.io/badge/PRs-welcome-blueviolet"/></a>
</p>
</div>

---

## 🧩 Overview

**GraphSpace** is a visual environment for **learning how machine learning works** by building it.
Models are graphs: drag in nodes, connect them, and every value, parameter and gradient is shown
live as the model trains, entirely in your browser.

---

## 🚀 Features

- **Build real models visually**: from adding two numbers to an MLP, an MNIST classifier, a
  character-level transformer and a toy diffusion model. Layers like Linear, Attention, LayerNorm or
  Transformer Block are groups made of simple nodes; double-click to step inside any of them.
- **See everything**: tensors, images, scatter plots, loss curves and the gradient flowing back from
  the loss, updated while training runs. Shape mistakes are explained on the node that made them.
- **Guided lessons**: six lessons with step-by-step instructions and automatic checks (graph
  structure, values, and results after training), hints and worked solutions.
- **Version control**: commit checkpoints, branch from any commit, compare with now and restore.
- **Share and fork**: read-only links anyone can open and run, plus an example gallery.

---

## 🖥️ Visual Walkthrough

<table>
  <tr>
    <td>
      <h3>Build Models Instantly</h3>
      <p>Create and iterate with a drag-and-drop visual interface.</p>
    </td>
    <td>
      <img width="400" height="225" src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/691ccdedaba95a8c8afc3148_build-gif.gif" alt="Visual model building interface" />
    </td>
  </tr>
  <tr>
    <td>
      <h3>Inspect Internals and Data Flow</h3>
      <p>Watch data streams and model parameters update in real-time.</p>
    </td>
    <td>
      <img width="400" height="225" src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/691ccf66695b8b137d9405a7_import-gif.gif" alt="Model introspection view" />
    </td>
  </tr>
  <tr>
    <td>
      <h3>Version Control</h3>
      <p>Track changes, branch experiments, and collaborate with your team seamlessly.</p>
    </td>
    <td>
      <img width="400" height="225" src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/691cd0e1e53a6388ad1d92d1_vcs-gif.gif" alt="Version control interface" />
    </td>
  </tr>
</table>


### Visualize Everything 
<table>
  <tr>
    <td><img src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/691e1516036b91f4f9ae5598_array-gif.gif" width="400"></td>
    <td><img src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/69164b1843c0dde4a06f6981_ezgif-5177e2f7b3e1ee43.gif" width="400"></td>
    <td><img src="https://cdn.prod.website-files.com/6822ca7497b6cc13b9f804c2/691e15063e5b6e0a34561a35_tensor-gif.gif" width="400"></td>
  </tr>
</table>
---

## ⚙️ Development

GraphSpace is a single Next.js app. Models are built and trained in the browser (a small TypeScript tensor and autodiff engine running in a Web Worker); the server only stores accounts, projects, version history and lesson progress in SQLite.

Requires Node 24+.

```bash
git clone https://github.com/joeiannone-gs/GraphSpace
cd GraphSpace
npm ci
cp .env.example .env.local   # set INVITE_CODE
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run lint && npm run typecheck && npm test   # unit tests (Vitest)
npm run e2e                                     # browser tests (Playwright)
```

### Layout

| Path | What |
|---|---|
| `src/app` | Pages and API route handlers |
| `src/engine`, `src/worker` | Tensor/autodiff engine and the worker that runs it |
| `src/doc`, `src/graph`, `src/nodes` | Project document model, graph operations, node registry |
| `src/canvas`, `src/ui`, `src/store` | pixi.js editor, panels, Redux store |
| `src/server` | SQLite, auth, data access |
| `public/datasets` | Bundled datasets (2-D points, 200 MNIST digits) |
| `src/lessons`, `src/gallery`, `src/library` | Lessons, example projects, built-in groups (layers and losses) |
| `deploy/` | One Google Compute Engine VM behind Caddy, deployed with gcloud scripts; see `deploy/README.md` |

<div align="center">
  <sub>Built with ❤️ by the GraphSpace Team</sub>
</div>
