// engine/ui/phaseScreens.js — pure phase→screen-visibility map (v0.2.121).
// Single declarative source for which top-level screens are shown in each game
// phase, so the title/HUD/pause DOM toggles stop being hand-rolled at every
// transition() call site. Pure (no DOM, imports only the PHASE enum), so it is
// unit-testable in node; main.js subscribes to EV.PHASE_CHANGE and applies the
// result to the real elements via applyPhaseScreens().
import { PHASE } from '../../state.js';

// Desired visibility of the three top-level screens for a given phase.
// true = visible. Mirrors EXACTLY the imperative toggles main.js ran before
// v0.2.121:
//   TITLE        → title screen only
//   PLAYING/DEAD → HUD (no title, no pause modal)
//   PAUSED       → HUD + pause modal on top
export function phaseVisibility(phase) {
  return {
    title: phase === PHASE.TITLE,
    hud:   phase !== PHASE.TITLE,
    pause: phase === PHASE.PAUSED,
  };
}

// Apply a visibility result to the real DOM elements. The title/HUD use a
// `hidden` class (present = hidden); the pause modal uses a `show` class
// (present = shown), so the pause toggle is inverted. Any element may be null
// (defensive — the title/HUD/pause nodes are optional in headless contexts).
export function applyPhaseScreens(phase, { elTitle, elHud, elPause }) {
  const vis = phaseVisibility(phase);
  elTitle?.classList.toggle('hidden', !vis.title);
  elHud?.classList.toggle('hidden', !vis.hud);
  elPause?.classList.toggle('show', vis.pause);
  return vis;
}
