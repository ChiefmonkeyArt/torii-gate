// tests/entry-flow-smoke.test.js — entry-flow binding contract (v0.2.227).
//
// Companion to sw-app-shell.test.js. That suite freezes the SERVICE-WORKER side of the
// v0.2.226 "dead login / ENTER ARENA button" blocker (no stale HTML-shell precache, cache
// version tracks the app, network-first HTML/JS, self-heal reload). THIS suite freezes the
// SOURCE side: that the two title-screen entry buttons actually exist in the shipped
// index.html AND are looked up + click-bound in main.js. A silent id rename / typo on
// EITHER side would unbind a button (it renders but does nothing) without failing any other
// test — exactly the "buttons don't respond" symptom, just from a different cause. Pure file
// reads, no DOM / network.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const MAIN = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const HUD  = readFileSync(join(ROOT, 'src/hud.js'), 'utf8');

// The title-screen entry buttons: DOM id ↔ the main.js handle each is assigned to.
const ENTRY_BUTTONS = [
  { id: 'btn-enter', handle: 'elEnterBtn', label: 'ENTER ARENA' },
  { id: 'btn-nostr-centre', handle: 'elNostrCentreBtn', label: 'LOGIN WITH NOSTR' },
];

describe('entry-flow smoke — title-screen buttons exist and are bound (regression)', () => {
  for (const { id, label } of ENTRY_BUTTONS) {
    it(`index.html declares the ${label} button (id="${id}")`, () => {
      expect(HTML).toContain(`id="${id}"`);
    });
  }

  for (const { id, handle, label } of ENTRY_BUTTONS) {
    it(`main.js resolves #${id} into ${handle} (${label})`, () => {
      const re = new RegExp(`${handle}\\s*=\\s*document\\.getElementById\\(\\s*['"]${id}['"]\\s*\\)`);
      expect(MAIN).toMatch(re);
    });

    it(`main.js binds a click handler to ${handle} (${label} responds)`, () => {
      // Tolerate optional-chaining (`handle?.addEventListener`) and whitespace.
      const re = new RegExp(`${handle}\\??\\.addEventListener\\(\\s*['"]click['"]`);
      expect(MAIN).toMatch(re);
    });
  }

  it('the ENTER handler is gated to the title screen (no fire mid-game)', () => {
    // The click handler must early-return when not on the title screen, so a stray
    // click can never re-bootstrap the arena from PLAYING/HOME.
    expect(MAIN).toMatch(/elEnterBtn\??\.addEventListener\(\s*['"]click['"]/);
    expect(MAIN).toMatch(/if\s*\(\s*!isTitle\(\)\s*\)\s*return/);
  });
});

// v0.2.228: the v0.2.226 SW fix made the buttons reachable, but a cloud/no-extension
// smoke still showed silent no-ops: (a) login feedback was written to #nostr-status,
// an element that never existed in index.html, so it was dropped; (b) the ENTER catch
// only console.error'd and reset the button, and the model-load steps lived OUTSIDE the
// try (a throw there froze the button on "LOADING PHYSICS…"). These contracts freeze the
// "no silent no-op" guarantee: a visible status line exists, and both buttons write to it.
describe('entry-flow no-silent-noop — visible feedback on every click (v0.2.228 regression)', () => {
  it('index.html declares the visible #entry-status feedback line', () => {
    expect(HTML).toMatch(/id="entry-status"/);
  });

  it('main.js routes feedback through the real #entry-status element (not the dead #nostr-status)', () => {
    expect(MAIN).toMatch(/getElementById\(\s*['"]entry-status['"]\s*\)/);
    // The old null target must be gone — writing to it was the silent-login bug.
    expect(MAIN).not.toMatch(/getElementById\(\s*['"]nostr-status['"]\s*\)/);
  });

  it('the ENTER catch surfaces a user-facing message AND re-enables the button (no silent reset)', () => {
    // Grab the ENTER click handler body up to the LOGIN handler that follows it.
    const block = MAIN.slice(
      MAIN.indexOf("elEnterBtn?.addEventListener('click'"),
      MAIN.indexOf('_doNostrLogin'),
    );
    expect(block).toMatch(/catch\s*\(/);
    expect(block).toMatch(/showEntryStatus\(/);          // visible message, not just console.error
    expect(block).toMatch(/elEnterBtn\.disabled\s*=\s*false/); // button recovers for a retry
  });

  it('the LOGIN handler shows its result on the visible status line', () => {
    const block = MAIN.slice(MAIN.indexOf('async function _doNostrLogin'));
    expect(block).toMatch(/showEntryStatus\(\s*result\s*\)/);
  });
});

// v0.2.229: the v0.2.228 #entry-status line shipped, but a cloud/no-extension smoke
// STILL saw no visible ENTER/LOGIN feedback, plus "YOU DIED"/"Respawning..." leaking
// into the accessibility tree on the TITLE screen. Two residual causes: (a) the ENTER
// click CLEARED the status line and relied on the disabled-button text, so a stalled
// (never-settling) Rapier WASM bootstrap looked like a silent no-op with no status;
// (b) #death-msg is always in the DOM with no aria-hidden, so its text reached AT/smoke
// before any arena entry; (c) a THROW from nostrLogin() left the interim "Connecting…"
// stuck. These contracts freeze the fixes.
describe('entry-flow visibility — immediate feedback + clean a11y tree (v0.2.229 regression)', () => {
  it('the ENTER click shows an IMMEDIATE visible status (not a clear) before awaiting bootstrap', () => {
    const block = MAIN.slice(
      MAIN.indexOf("elEnterBtn?.addEventListener('click'"),
      MAIN.indexOf('_doNostrLogin'),
    );
    // A non-empty message must be set before the `try`/`await initPhysics()` so a
    // stalled bootstrap is never an apparent silent no-op.
    const beforeTry = block.slice(0, block.indexOf('try {'));
    expect(beforeTry).toMatch(/showEntryStatus\(\s*['"][^'"]+['"]\s*\)/);
  });

  it('#death-msg is aria-hidden by default in index.html (no YOU DIED on the title a11y tree)', () => {
    expect(HTML).toMatch(/id="death-msg"[^>]*aria-hidden="true"/);
  });

  it('hud.js toggles aria-hidden in lockstep with the .show class', () => {
    const block = HUD.slice(HUD.indexOf('PLAYER_KILLED'), HUD.indexOf('}', HUD.indexOf('PLAYER_RESPAWN')));
    expect(block).toMatch(/classList\.add\(\s*['"]show['"]\s*\)[\s\S]*setAttribute\(\s*['"]aria-hidden['"]\s*,\s*['"]false['"]\s*\)/);
    expect(block).toMatch(/classList\.remove\(\s*['"]show['"]\s*\)[\s\S]*setAttribute\(\s*['"]aria-hidden['"]\s*,\s*['"]true['"]\s*\)/);
  });

  it('the LOGIN handler guards the nostrLogin await so a throw still surfaces a message', () => {
    const block = MAIN.slice(MAIN.indexOf('async function _doNostrLogin'), MAIN.indexOf('elNostrCentreBtn?.addEventListener'));
    expect(block).toMatch(/try\s*\{/);
    expect(block).toMatch(/catch\s*\(/);
    // The catch path must show a visible message, not just console.error.
    const catchPart = block.slice(block.indexOf('catch'));
    expect(catchPart).toMatch(/showEntryStatus\(/);
  });
});
