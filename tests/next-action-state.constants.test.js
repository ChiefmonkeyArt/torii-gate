// tests/next-action-state.constants.test.js — split from next-action-state.test.js (E3, v0.2.267).
// Slice: the stable constants surface (badge, schema, write filename, required-keys).
import { describe, it, expect } from 'vitest';
import {
  NEXT_ACTION_STATE_BADGE, NEXT_ACTION_STATE_SCHEMA, NEXT_ACTION_STATE_SCHEMA_VERSION,
  NEXT_ACTION_STATE_WRITE_FILENAME, NEXT_ACTION_STATE_REQUIRED_KEYS,
} from '../tools/nextActionState.mjs';

describe('next-action-state — constants', () => {
  it('exposes a stable badge, schema, write filename, and required-keys list', () => {
    expect(NEXT_ACTION_STATE_BADGE).toBe('NEXT-ACTION STATE · LOCAL · READ-ONLY');
    expect(NEXT_ACTION_STATE_SCHEMA).toBe('torii.next-action-state');
    expect(NEXT_ACTION_STATE_SCHEMA_VERSION).toBe(1);
    expect(NEXT_ACTION_STATE_WRITE_FILENAME).toBe('NEXT_ACTION_STATE.json');
    expect(Object.isFrozen(NEXT_ACTION_STATE_REQUIRED_KEYS)).toBe(true);
  });
});
