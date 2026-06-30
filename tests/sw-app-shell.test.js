// tests/sw-app-shell.test.js — entry-flow regression guard (v0.2.226).
//
// The login / ENTER ARENA buttons went inert in the field because a returning player was
// controlled by a service worker that had PRECACHED the HTML app shell ('/'). The shell
// pins a content-hashed `/assets/index-<hash>.js` bundle; after a redeploy mints a new
// hash, the stale precached shell points at a 404'd bundle, the bundle never executes,
// and the title screen renders (static HTML) while every button's click handler — which
// lives in the dead bundle — does nothing.
//
// This suite freezes the fix as a contract (pure file reads, no fs mutation / network):
//   - the SW must NOT precache the HTML shell ('/' or any .html);
//   - the SW cache name must track the app VERSION (so the activate purge can evict it);
//   - HTML/JS must be served network-first (only binary assets are cache-first);
//   - index.html must register the SW with a loop-guarded controllerchange→reload so an
//     already-stranded client auto-heals when the fresh version-named SW claims the page;
//   - the CSP sha256 (in tools/csp.mjs, shipped as an HTTP header) must still match the
//     BUILT inline registration script — i.e. the source inline script + the entry import()
//     line the build plugin appends — else strict-dynamic blocks the bootstrap.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { VERSION } from '../src/config.js';
import { INLINE_SCRIPT_SHA256, ENTRY_IMPORT_LINE } from '../tools/csp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Extract the PRECACHE_ASSETS array literal contents.
function precacheList() {
  const m = SW.match(/PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  return (m[1].match(/'([^']+)'|"([^"]+)"/g) || []).map((s) => s.replace(/['"]/g, ''));
}

// The exact text of the last attribute-less inline <script> (the SW registration).
function inlineRegistrationScript() {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  let last = null;
  while ((m = re.exec(HTML)) !== null) last = m[1];
  return last;
}

describe('service worker — app-shell precache guard (entry-flow regression)', () => {
  it('does NOT precache the HTML app shell', () => {
    const list = precacheList();
    expect(list).not.toBeNull();
    expect(list).not.toContain('/');
    expect(list).not.toContain('/index.html');
    expect(list).not.toContain('index.html');
  });

  it('precaches only immutable binary assets (no .html / .js / .css)', () => {
    const list = precacheList();
    for (const url of list) {
      expect(/\.(glb|webp|jpg|jpeg|png|woff2|wasm)$/i.test(url)).toBe(true);
    }
  });

  it('cache name tracks the app VERSION so activate can purge the old one', () => {
    const m = SW.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain(VERSION);
  });

  it('treats HTML and JS as non-static (so they go network-first)', () => {
    // isStaticAsset must be cache-first ONLY for binary assets, never HTML/JS/CSS.
    const m = SW.match(/function isStaticAsset\(path\)\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m[1];
    expect(body).not.toMatch(/\.html/);
    expect(body).not.toMatch(/\.js'/);
    expect(body).not.toMatch(/\.css/);
  });
});

describe('index.html — service-worker registration self-heal', () => {
  it('registers the service worker', () => {
    const s = inlineRegistrationScript();
    expect(s).not.toBeNull();
    expect(s).toMatch(/serviceWorker\.register\(\s*['"]\/sw\.js['"]\s*\)/);
  });

  it('reloads once on controllerchange, guarded against a reload loop', () => {
    const s = inlineRegistrationScript();
    expect(s).toMatch(/addEventListener\(\s*['"]controllerchange['"]/);
    expect(s).toMatch(/location\.reload\(\)/);
    // A guard flag must short-circuit a second reload.
    expect(s).toMatch(/if\s*\(\s*reloading\s*\)\s*return/);
  });

  it('CSP sha256 (tools/csp.mjs) matches the BUILT inline registration script', () => {
    // The CSP no longer lives in index.html (S3, v0.2.266) — it ships as an HTTP header
    // derived from tools/csp.mjs. The hashed script is the BUILT bootstrap: the source
    // inline script with the entry import() line the vite plugin appends before </script>.
    const s = inlineRegistrationScript();
    const built = s + ENTRY_IMPORT_LINE + '\n';
    const hash = 'sha256-' + createHash('sha256').update(built, 'utf8').digest('base64');
    expect(hash).toBe(INLINE_SCRIPT_SHA256);
  });
});
