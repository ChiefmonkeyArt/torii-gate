// tests/continuum-dashboard.test.js — locks the Torii Continuum project-oversight
// DASHBOARD data model + pure renderer (src/engine/dashboard/continuumData.js,
// v0.2.171). Proves the data/model helpers, computed totals/percentages, the
// JSON snapshot shape, render-output SAFETY (no external href, same-origin-only
// fetch, no setTimeout/eval, struck completed-24h, source-of-truth note, donut
// SVG present), and SDK exposure. Pure module → node-safe.
import { describe, it, expect } from 'vitest';
import {
  CONTINUUM_VERSION, CONTINUUM_BADGE, CONTINUUM,
  escapeHtml, clampPct, barCells, ringDash,
  computeTotals, buildContinuumModel, continuumDataJSON, renderContinuumPage,
} from '../src/engine/dashboard/continuumData.js';
import * as SDK from '../src/sdk/index.js';
import { VERSION } from '../src/config.js';

describe('module shape', () => {
  it('pins the version (tracks the build) and the read-only oversight badge', () => {
    expect(CONTINUUM_VERSION).toBe('v0.2.171-alpha');
    expect(CONTINUUM_VERSION).toBe(VERSION);
    expect(CONTINUUM_BADGE).toBe('PROJECT OVERSIGHT · STATIC · READ-ONLY');
  });

  it('curated data is frozen and carries the expected sections', () => {
    expect(Object.isFrozen(CONTINUUM)).toBe(true);
    expect(CONTINUUM.title).toBe('Torii Continuum');
    expect(Array.isArray(CONTINUUM.next12)).toBe(true);
    expect(Array.isArray(CONTINUUM.leanRoute)).toBe(true);
    expect(Array.isArray(CONTINUUM.tracks)).toBe(true);
    expect(CONTINUUM.sourceOfTruth.length).toBe(3);
  });

  it('contributors is a clearly-flagged SEED metric, not live data', () => {
    expect(CONTINUUM.contributors.isSeed).toBe(true);
    expect(CONTINUUM.contributors.humans).toBe(1);
    expect(CONTINUUM.contributors.clankers).toBe(3);
    expect(CONTINUUM.contributors.note).toMatch(/seed/i);
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>"x"&'y'`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
  });
  it('treats null/undefined as empty string, never throws', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('clampPct', () => {
  it('rounds and clamps into 0..100', () => {
    expect(clampPct(46.4)).toBe(46);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(150)).toBe(100);
  });
  it('returns null for null/NaN so an n/a track shows', () => {
    expect(clampPct(null)).toBeNull();
    expect(clampPct(NaN)).toBeNull();
  });
});

describe('barCells', () => {
  it('splits a percent into filled/empty over the width', () => {
    const b = barCells(50, 20);
    expect(b.filled).toBe(10);
    expect(b.empty).toBe(10);
    expect(b.percent).toBe(50);
  });
  it('null percent → all-empty (the n/a Deployment track)', () => {
    const b = barCells(null, 20);
    expect(b.filled).toBe(0);
    expect(b.empty).toBe(20);
    expect(b.percent).toBeNull();
  });
});

describe('ringDash', () => {
  it('filled + rest always equals the circumference', () => {
    const C = 326.726;
    const { filled, rest } = ringDash(73, C);
    expect(filled + rest).toBeCloseTo(C, 3);
    expect(filled).toBeCloseTo(C * 0.73, 3);
  });
});

describe('computeTotals', () => {
  const t = computeTotals(CONTINUUM);
  it('counts list lengths exactly', () => {
    expect(t.tasksAhead).toBe(12);
    expect(t.activeTasks).toBe(3);
    expect(t.completedLast24h).toBe(4);
    expect(t.archivedClusters).toBe(7);
    expect(t.trackCount).toBe(6);
    expect(t.milestoneCount).toBe(5);
  });
  it('milestones achieved counts only state==="done" (honest, currently 0)', () => {
    expect(t.milestonesAchieved).toBe(0);
    expect(t.milestonesAchievedPct).toBe(0);
    expect(t.milestonesInProgress).toBe(4);
  });
  it('directional percentages match the curated data', () => {
    expect(t.pocProgressPct).toBe(46);
    expect(t.buildProgressPct).toBe(74);
  });
});

describe('buildContinuumModel', () => {
  const m = buildContinuumModel();
  it('does not mutate the frozen source', () => {
    expect(Object.isFrozen(CONTINUUM)).toBe(true);
  });
  it('attaches per-track bar cells and computed totals', () => {
    expect(m.badge).toBe(CONTINUUM_BADGE);
    expect(m.tracks.every((tk) => tk.bar && typeof tk.bar.filled === 'number')).toBe(true);
    expect(m.totals.tasksAhead).toBe(12);
  });
});

describe('continuumDataJSON', () => {
  it('is JSON-serialisable and carries totals + the seed contributors', () => {
    const j = continuumDataJSON();
    const round = JSON.parse(JSON.stringify(j));
    expect(round.version).toBe('v0.2.171-alpha');
    expect(round.totals.pocProgressPct).toBe(46);
    expect(round.contributors.isSeed).toBe(true);
  });
});

describe('renderContinuumPage', () => {
  const html = renderContinuumPage();

  it('returns a self-contained HTML document with the version', () => {
    expect(typeof html).toBe('string');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('v0.2.171-alpha');
    expect(html).toContain('Torii Continuum');
  });

  it('renders all 12 next tasks and struck completed-24h items', () => {
    for (const task of CONTINUUM.next12) {
      expect(html).toContain(escapeHtml(task));
    }
    expect(html).toContain('class="done"');
  });

  it('renders donut SVG rings and the source-of-truth note', () => {
    expect(html).toContain('<svg');
    expect(html).toContain('donut-val');
    expect(html).toContain('Source of truth');
    expect(html).toContain('todo.md');
    expect(html).toContain('strategy.md');
    expect(html).toContain('progress.md');
  });

  it('SAFETY: no external navigation, no http(s) href/redirect', () => {
    expect(html).not.toMatch(/href\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/window\.open/);
    expect(html).not.toMatch(/window\.location/);
    expect(html).not.toMatch(/location\.href/);
  });

  it('SAFETY: only same-origin relative fetch, no timers, no eval', () => {
    expect(html).toContain("fetch('./continuum-data.json'");
    expect(html).not.toMatch(/fetch\(\s*["']https?:/i);
    expect(html).not.toMatch(/setTimeout|setInterval/);
    expect(html).not.toMatch(/\beval\(/);
  });
});

describe('SDK exposure', () => {
  it('re-exports the continuum module at the experimental tier', () => {
    expect(SDK.continuum.CONTINUUM_VERSION).toBe('v0.2.171-alpha');
    expect(typeof SDK.continuum.renderContinuumPage).toBe('function');
    expect(SDK.SDK_SURFACE.continuum.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
  });
});
