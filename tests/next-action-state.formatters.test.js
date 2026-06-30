// tests/next-action-state.formatters.test.js — split from next-action-state.test.js (E3, v0.2.267).
// Slice: the text + markdown formatters (null-safe, mirror the JSON state).
import { describe, it, expect } from 'vitest';
import {
  NEXT_ACTION_STATE_BADGE,
  buildNextActionState, formatNextActionState, formatNextActionStateMarkdown,
} from '../tools/nextActionState.mjs';
import { V, handoff, manualPending } from './_next-action-state-helpers.js';

describe('next-action-state — formatters', () => {
  it('renders a text block with badge, release, tests, manual blocker, and next task', () => {
    const s = buildNextActionState({ agentHandoff: handoff(), manualValidation: manualPending, testStatus: { passing: 1417, files: 87 } });
    const txt = formatNextActionState(s);
    expect(txt).toContain(NEXT_ACTION_STATE_BADGE);
    expect(txt).toContain('release: READY');
    expect(txt).toContain('1417 passing / 87 files');
    expect(txt).toContain('manual blocker: PENDING');
    expect(txt).toContain('MVP playtest:');
    expect(txt).toContain('MVP approval gate:');
    expect(txt).toContain('implies approval: no');
    expect(txt).toContain('Next infra slice');
    expect(txt).toContain(V);
    expect(txt).toMatch(/workflow invariants \(\d+; guidance only/);
    expect(txt).toMatch(/cancel a useful in-progress job/i);
  });

  it('renders a markdown export mirroring the JSON state', () => {
    const s = buildNextActionState({ agentHandoff: handoff(), manualValidation: manualPending });
    const md = formatNextActionStateMarkdown(s);
    expect(md).toContain('# Torii Quest — next-action state (generated)');
    expect(md).toContain('do NOT hand-edit');
    expect(md).toContain('**Source commit:**');
    expect(md).toContain('## Next safe task');
    expect(md).toContain('## Docs pointers');
    expect(md).toContain('## Workflow invariants');
    expect(md).toMatch(/implies no approval, deployment, or runtime change/i);
  });

  it('formatters are null-safe', () => {
    expect(formatNextActionState(null)).toBe('next-action-state: (no state)');
    expect(formatNextActionStateMarkdown(null)).toContain('_(no state)_');
  });
});
