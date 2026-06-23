// tests/phaseScreens.test.js — locks down the pure phase→screen-visibility map
// (engine/ui/phaseScreens.js) that drives the EV.PHASE_CHANGE subscriber in
// main.js. Pure logic + a tiny fake element for applyPhaseScreens; no DOM/browser.
import { describe, it, expect } from 'vitest';
import { phaseVisibility, applyPhaseScreens } from '../src/engine/ui/phaseScreens.js';
import { PHASE, GAME_EVENT, state, transition } from '../src/state.js';
import { on, off, EV } from '../src/events.js';

describe('phaseVisibility', () => {
  it('TITLE → title only', () => {
    expect(phaseVisibility(PHASE.TITLE)).toEqual({ title: true, hud: false, pause: false });
  });
  it('PLAYING → HUD only', () => {
    expect(phaseVisibility(PHASE.PLAYING)).toEqual({ title: false, hud: true, pause: false });
  });
  it('PAUSED → HUD + pause modal', () => {
    expect(phaseVisibility(PHASE.PAUSED)).toEqual({ title: false, hud: true, pause: true });
  });
  it('DEAD → HUD only (death cam; no title, no pause modal)', () => {
    expect(phaseVisibility(PHASE.DEAD)).toEqual({ title: false, hud: true, pause: false });
  });
  it('the title screen is shown ONLY in TITLE', () => {
    for (const p of Object.values(PHASE)) {
      expect(phaseVisibility(p).title).toBe(p === PHASE.TITLE);
    }
  });
  it('the pause modal is shown ONLY in PAUSED', () => {
    for (const p of Object.values(PHASE)) {
      expect(phaseVisibility(p).pause).toBe(p === PHASE.PAUSED);
    }
  });
});

// Minimal stand-in for an element's classList — records the last toggle(class,on).
function fakeEl() {
  const present = new Set();
  return {
    classList: {
      toggle(name, on) { if (on) present.add(name); else present.delete(name); },
      has(name) { return present.has(name); },
    },
  };
}

describe('applyPhaseScreens (DOM application)', () => {
  it('uses the `hidden` class for title/HUD and `show` for pause, inverted correctly', () => {
    const elTitle = fakeEl(), elHud = fakeEl(), elPause = fakeEl();

    applyPhaseScreens(PHASE.PLAYING, { elTitle, elHud, elPause });
    // PLAYING: title hidden, HUD shown, pause hidden
    expect(elTitle.classList.has('hidden')).toBe(true);
    expect(elHud.classList.has('hidden')).toBe(false);
    expect(elPause.classList.has('show')).toBe(false);

    applyPhaseScreens(PHASE.PAUSED, { elTitle, elHud, elPause });
    // PAUSED: title still hidden, HUD still shown, pause modal now shown
    expect(elTitle.classList.has('hidden')).toBe(true);
    expect(elHud.classList.has('hidden')).toBe(false);
    expect(elPause.classList.has('show')).toBe(true);

    applyPhaseScreens(PHASE.TITLE, { elTitle, elHud, elPause });
    // TITLE: title shown, HUD hidden, pause hidden
    expect(elTitle.classList.has('hidden')).toBe(false);
    expect(elHud.classList.has('hidden')).toBe(true);
    expect(elPause.classList.has('show')).toBe(false);
  });

  it('returns the visibility result and tolerates null elements', () => {
    expect(() => applyPhaseScreens(PHASE.PAUSED, {})).not.toThrow();
    expect(applyPhaseScreens(PHASE.TITLE, {})).toEqual({ title: true, hud: false, pause: false });
  });
});

// Integration: prove the subscriber wiring main.js uses actually reacts to
// transition() — the FSM stays the single source of phase change and the
// PHASE_CHANGE payload's `to` drives the screens. Uses the real events + state
// modules (both pure JS, node-safe).
describe('PHASE_CHANGE subscriber integration', () => {
  it('transition() fires the subscriber with the entered phase and applies it', () => {
    const elTitle = fakeEl(), elHud = fakeEl(), elPause = fakeEl();
    const sub = ({ to }) => applyPhaseScreens(to, { elTitle, elHud, elPause });
    on(EV.PHASE_CHANGE, sub);
    try {
      state.phase = PHASE.TITLE;
      transition(GAME_EVENT.ENTER);  // → PLAYING: HUD shown, title hidden
      expect(elTitle.classList.has('hidden')).toBe(true);
      expect(elHud.classList.has('hidden')).toBe(false);
      expect(elPause.classList.has('show')).toBe(false);

      transition(GAME_EVENT.PAUSE);  // → PAUSED: pause modal shown
      expect(elPause.classList.has('show')).toBe(true);

      transition(GAME_EVENT.HOME);   // → TITLE: title shown, HUD + pause hidden
      expect(elTitle.classList.has('hidden')).toBe(false);
      expect(elHud.classList.has('hidden')).toBe(true);
      expect(elPause.classList.has('show')).toBe(false);
    } finally {
      off(EV.PHASE_CHANGE, sub);
      state.phase = PHASE.TITLE;
    }
  });

  it('an illegal transition does not fire the subscriber', () => {
    let fired = 0;
    const sub = () => { fired++; };
    on(EV.PHASE_CHANGE, sub);
    try {
      state.phase = PHASE.TITLE;
      expect(transition(GAME_EVENT.PAUSE)).toBe(false); // illegal from TITLE
      expect(fired).toBe(0);
    } finally {
      off(EV.PHASE_CHANGE, sub);
      state.phase = PHASE.TITLE;
    }
  });
});
