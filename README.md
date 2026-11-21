# DevPad

A local-first, offline-ready developer notepad, large-log analyzer, and diagramming studio built as a Progressive Web App (PWA)—designed as a fast, private macOS/Windows Notepad++ alternative with **screen-share privacy controls**.

## Key Features

- **Screen-Share Privacy & Client-Side Encryption**
  - Mark sensitive notes as **Hidden** (masked previews on overview cards, excluded from body search and plaintext exports) or **Password-Protected** using Web Crypto **PBKDF2 (100k iterations) + AES-256-GCM**.
- **Large Log Analyzer (OPFS + Web Workers)**
  - Handles multi-hundred-MB Serilog/JSON logs directly in the browser using Origin Private File System (OPFS), streaming indexing, and exact UTF-8 byte-range slicing (`File.slice`) without loading entire files into RAM.
  - Groups timelines by `RequestId` or `CorrelationId`, supports dual-ID trimmed search, and preserves full request context when filtering by errors or slow SQL.
- **Smart Code & Markdown Editing**
  - Powered by **Monaco Editor** with syntax highlighting, Markdown live preview (with HTML/URL XSS sanitization), and customizable `react-resizable-panels` layouts.
- **Visual Architecture Diagrams**
  - Built-in **React Flow** diagram editor for quick system and ER diagrams.
- **100% Local & Offline (PWA)**
  - Stored locally in IndexedDB (**Dexie.js**) and OPFS. Installable as a desktop PWA with zero cloud lock-in.

## Tech Stack

- **UI:** React 19, TypeScript 5.9, Tailwind CSS v4, React Router v7, Monaco Editor, React Flow, Recharts
- **Storage & Performance:** Dexie.js (IndexedDB), OPFS streaming, Web Workers, Web Crypto API
- **Build & Testing:** Vite 8 (Rolldown), Vitest 5, `vite-plugin-pwa`
- **Supply-Chain Hardening:** Exact-pinned dependencies + `.npmrc` (`ignore-scripts=true`, `min-release-age=7`, `save-exact=true`)

## Getting Started

```bash
git clone https://github.com/ZafarAli110/devpad.git
cd devpad
npm install --legacy-peer-deps
npm run dev
```

### Scripts

```bash
npm test          # Run Vitest unit & security-hygiene suite
npm run build     # Type-check (tsc) and build production PWA bundle
npm run preview   # Preview the production build locally
```

## Roadmap

- Browser-local semantic note search via WebGPU/WASM embeddings (`all-MiniLM-L6-v2`) — 100% offline with zero external API calls.

## License

[MIT](LICENSE)
