import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { CSP_VALUE, ENTRY_IMPORT_LINE, headersFileBody } from './tools/csp.mjs';

// CSP via HTTP header (S3, v0.2.266). The policy lives in tools/csp.mjs (single source).
// This plugin: (1) rewrites the BUILT index.html so the trusted classic inline bootstrap
// script `import()`s the pinned entry (assets/torii-entry.js) instead of a static
// <script> tag — letting `strict-dynamic` cover the whole module graph; (2) writes
// dist/_headers for the static host; (3) serves the same header from `vite preview`.
function cspHeaderPlugin() {
  return {
    name: 'torii-csp-http-header',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // Only the built HTML (ctx.bundle present); the dev server keeps the
        // static module tag (no CSP header in dev — strict-dynamic would block
        // Vite's own injected client/HMR scripts).
        if (!ctx.bundle) return html;
        // Drop the parser-inserted entry tag + any modulepreload hint for it; the
        // trusted inline bootstrap loads it via import() so strict-dynamic applies.
        let out = html
          .replace(/\s*<script\b[^>]*\bsrc="\/assets\/torii-entry\.js"[^>]*><\/script>/, '')
          .replace(/\s*<link\b[^>]*\bhref="\/assets\/torii-entry\.js"[^>]*>/g, '');
        // Append the entry import to the single classic inline bootstrap script.
        out = out.replace(/\n<\/script>\n<\/body>/, `\n${ENTRY_IMPORT_LINE}\n</script>\n</body>`);
        return out;
      },
    },
    writeBundle(options) {
      const dir = options.dir || join(process.cwd(), 'dist');
      writeFileSync(join(dir, '_headers'), headersFileBody());
    },
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Content-Security-Policy', CSP_VALUE);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [cspHeaderPlugin()],
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    // Rapier (2.2M) is an intentional LAZY chunk (dynamic import on Enter
    // Arena) and never blocks initial paint, so 700K is the right bar for the
    // UPFRONT chunks (three-vendor + game logic); the lazy physics giant is
    // expected and does not trip a real-size warning.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Pin the entry chunk to a stable filename so the inline bootstrap's
        // import() target (and therefore its sha256 in the CSP) never churns.
        entryFileNames: 'assets/torii-entry.js',
        manualChunks(id) {
          // All three.js core + addons in one vendor chunk. (Addons can't be
          // deferred separately yet: the arena modules that import them are
          // statically imported at startup. Deferring them is a future
          // arena-bundle lazy-load behind Enter Arena — a game-loop refactor.)
          if (id.includes('/three/')) return 'three-vendor';
        }
      }
    }
  },
  // Silence Rolldown codeSplitting suggestion — we're handling it manually
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'] // don't pre-bundle Rapier — it's lazy
  },
  // Vitest config (v0.2.120, perf tuning v0.2.260). Node environment — the unit
  // suite covers pure logic seams (state machine, event bus, headshot classifier)
  // only, so no jsdom/Three/Rapier/browser is needed. `npm test` runs `vitest run`.
  //
  // pool: 'threads' + isolate: false — the suite is 108 files / 1834 tests but
  // every test imports only PURE helpers (no THREE, no Rapier, no DOM, no module-
  // scope mutation). Per-file isolation was costing ~26 s of collect/prepare overhead
  // for ~1.5 s of actual test execution. Sharing the worker module graph drops the
  // full suite from ~28.7 s to ~2.7 s with all 1834 tests still green. If a future
  // test ever needs a fresh module graph (rare for pure-logic seams), move it to a
  // dedicated vitest project with isolate:true rather than reverting this default.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    pool: 'threads',
    poolOptions: { threads: { isolate: false, singleThread: false } },
  },
});
