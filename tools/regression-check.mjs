// tools/regression-check.mjs — static smoke/regression guardrails (v0.2.110).
// No external deps. Run with: node tools/regression-check.mjs  (or: npm run check)
//
// Catches the regressions the Strategy doc calls out, without needing a browser:
//   1. syntax — `node --check` every src/**/*.js
//   2. godMode must never be committed as true
//   3. setTimeout only in the two approved files (nostr.js WS close, hud.js feed)
//   4. no `new THREE.Vector3` / `new THREE.Matrix4` in foundation/new modules
//   5. version markers agree on EXPECTED_VERSION (config.js + index.html)
//   6. dist marker check (only if dist/ exists) — key behaviours present
//
// Exit code 0 = all green; non-zero = at least one FAIL.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_VERSION = 'v0.2.110-alpha';
const SETTIMEOUT_ALLOWED = new Set(['src/nostr.js', 'src/hud.js']);
// Files where a per-frame hot path must stay allocation-free.
const NO_ALLOC_FILES = [
  'src/dynamicCrates.js',
  'src/engine/physics/bodies.js',
  'src/engine/physics/raycast.js',
  'src/engine/debug/toriiDebug.js',
  'src/world/napZone.js',
  'src/world/handoff.js',
  'src/identity/presence.js',
];

let fails = 0;
const fail = (m) => { console.error(`  ✗ ${m}`); fails++; };
const pass = (m) => console.log(`  ✓ ${m}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === '.js') out.push(p);
  }
  return out;
}

const srcFiles = walk(join(ROOT, 'src')).map((p) => p.slice(ROOT.length + 1));

// 1. syntax
console.log('[1] syntax (node --check)');
for (const f of srcFiles) {
  try { execSync(`node --check ${f}`, { stdio: 'pipe' }); }
  catch (e) { fail(`syntax error in ${f}: ${e.message}`); }
}
if (!fails) pass(`${srcFiles.length} files parse clean`);

// 2. godMode
console.log('[2] godMode never true');
{
  let bad = false;
  for (const f of srcFiles) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    if (/godMode\s*=\s*true/.test(txt)) { fail(`godMode=true in ${f}`); bad = true; }
  }
  const cfg = readFileSync(join(ROOT, 'src/config.js'), 'utf8');
  if (!/godMode\s*=\s*false/.test(cfg)) { fail('config.js godMode is not = false'); bad = true; }
  if (!bad) pass('godMode = false, no godMode=true anywhere');
}

// 3. setTimeout allowlist
console.log('[3] setTimeout allowlist');
{
  let bad = false;
  for (const f of srcFiles) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    const n = (txt.match(/setTimeout\s*\(/g) || []).length;
    if (n > 0 && !SETTIMEOUT_ALLOWED.has(f)) { fail(`${n} setTimeout in non-allowed ${f}`); bad = true; }
  }
  if (!bad) pass('setTimeout only in nostr.js + hud.js');
}

// 4. no hot-path allocations in new/foundation modules
console.log('[4] no new Vector3/Matrix4 in foundation modules');
{
  let bad = false;
  for (const f of NO_ALLOC_FILES) {
    if (!existsSync(join(ROOT, f))) continue;
    const txt = readFileSync(join(ROOT, f), 'utf8');
    if (/new\s+THREE\.(Vector3|Matrix4)\s*\(/.test(txt)) { fail(`allocation in ${f}`); bad = true; }
  }
  if (!bad) pass('foundation modules allocation-free');
}

// 5. version markers
console.log(`[5] version markers == ${EXPECTED_VERSION}`);
{
  const cfg = readFileSync(join(ROOT, 'src/config.js'), 'utf8');
  if (!cfg.includes(`'${EXPECTED_VERSION}'`)) fail(`config.js VERSION != ${EXPECTED_VERSION}`);
  else pass('config.js VERSION matches');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const count = (html.match(new RegExp(EXPECTED_VERSION.replace(/\./g, '\\.'), 'g')) || []).length;
  if (count < 2) fail(`index.html has ${count} ${EXPECTED_VERSION} markers (expected >=2)`);
  else pass(`index.html has ${count} version markers`);
  if (/v0\.2\.109-alpha/.test(html)) fail('index.html still references v0.2.109-alpha');
}

// 6. dist markers (only if built)
console.log('[6] dist markers (skipped if no dist/)');
{
  const distDir = join(ROOT, 'dist');
  if (!existsSync(distDir)) { pass('no dist/ — skipped'); }
  else {
    const assets = existsSync(join(distDir, 'assets')) ? readdirSync(join(distDir, 'assets')) : [];
    const jsName = assets.find((a) => /^index-.*\.js$/.test(a));
    if (!jsName) fail('no dist/assets/index-*.js');
    else {
      const js = readFileSync(join(distDir, 'assets', jsName), 'utf8');
      const markers = ['chiefmonkey-headless.glb', 'triangle', 'Idle_11', 'Stylish_Walk_inplace', 'ToriiDebug'];
      for (const m of markers) {
        if (js.includes(m)) pass(`dist marker present: ${m}`);
        else fail(`dist marker MISSING: ${m}`);
      }
    }
    const distHtml = join(distDir, 'index.html');
    if (existsSync(distHtml) && readFileSync(distHtml, 'utf8').includes(EXPECTED_VERSION)) pass('dist index.html version ok');
    else if (existsSync(distHtml)) fail('dist index.html missing version');
  }
}

console.log(fails === 0 ? '\nALL GREEN' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
