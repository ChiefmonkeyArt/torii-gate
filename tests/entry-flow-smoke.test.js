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
