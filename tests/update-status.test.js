// tests/update-status.test.js — in-game UPDATE-STATUS panel (updateStatus.js,
// LEAN-5, v0.2.158). Asserts the panel folds the v0.2.157 release source + the
// inert preview into one render-ready, display-only update-status view that
// reflects update-available / up-to-date / unknown AND the source diagnostics,
// degrades draft/empty/malformed payloads safely, and exposes NO action surface.
import { describe, it, expect } from 'vitest';
import {
  updateStatusPanel, UPDATE_STATUS_BADGE, UPDATE_SURFACE_ID, SAMPLE_RELEASE_FEED,
  UPDATE_STATUS,
} from '../src/engine/update/updateStatus.js';
import { VERSION } from '../src/config.js';
import { RELEASE_SOURCE } from '../src/engine/update/githubReleaseSource.js';
import * as SDK from '../src/sdk/index.js';
import { updateStatusReport } from '../src/engine/debug/shellReport.js';

describe('updateStatusPanel — sample feed (update available)', () => {
  it('selects the newest sample release and reports update-available', () => {
    const p = updateStatusPanel(SAMPLE_RELEASE_FEED, { currentVersion: 'v0.2.138-alpha' });
    expect(p.title).toBe('UPDATE STATUS');
    expect(p.badge).toBe(UPDATE_STATUS_BADGE);
    expect(p.surface).toBe(UPDATE_SURFACE_ID);
    expect(p.step).toBe('UPDATE');
    expect(p.status).toBe(UPDATE_STATUS.UPDATE_AVAILABLE);
    expect(p.statusLabel).toBe('UPDATE AVAILABLE');
    expect(p.updateAvailable).toBe(true);
    expect(p.latestVersion).toBe('0.2.999-alpha');
    expect(p.source.status).toBe('ok');
    expect(p.source.kind).toBe('list');
    expect(p.source.candidates).toBe(2);
    expect(p.source.errors).toEqual([]);
  });

  it('defaults to the local sample feed (no payload, no network)', () => {
    const p = updateStatusPanel(undefined, { currentVersion: 'v0.2.138-alpha' });
    expect(p.status).toBe(UPDATE_STATUS.UPDATE_AVAILABLE);
    expect(p.latestVersion).toBe('0.2.999-alpha');
  });

  it('orders lines Version, Latest, Status, Source, Releases', () => {
    const p = updateStatusPanel(SAMPLE_RELEASE_FEED, { currentVersion: 'v0.2.138-alpha' });
    expect(p.lines.map((l) => l.label)).toEqual(['Version', 'Latest', 'Status', 'Source', 'Releases']);
    expect(p.lines[0].value).toBe('v0.2.138-alpha');
    expect(p.lines[1].value).toBe('0.2.999-alpha');
    expect(p.lines[3].value).toMatch(/2 release\(s\)/);
    expect(p.lines[4].value).toBe(RELEASE_SOURCE.releasesPageUrl);
    expect(p.sourceUrl).toBe(RELEASE_SOURCE.releasesPageUrl);
  });
});

describe('updateStatusPanel — up to date', () => {
  it('reports up-to-date when the runtime equals the latest release', () => {
    const p = updateStatusPanel({ tag_name: 'v0.2.138-alpha' }, { currentVersion: 'v0.2.138-alpha' });
    expect(p.status).toBe(UPDATE_STATUS.UP_TO_DATE);
    expect(p.statusLabel).toBe('UP TO DATE');
    expect(p.updateAvailable).toBe(false);
    expect(p.source.kind).toBe('latest');
    expect(p.lines[3].value).toBe('single release');
  });

  it('reports up-to-date when the runtime is newer than an older release', () => {
    const p = updateStatusPanel({ tag_name: 'v0.2.100-alpha' }, { currentVersion: 'v0.2.200-alpha' });
    expect(p.status).toBe(UPDATE_STATUS.UP_TO_DATE);
    expect(p.updateAvailable).toBe(false);
  });

  it('defaults the running version to the runtime VERSION', () => {
    const p = updateStatusPanel({ tag_name: VERSION });
    expect(p.currentVersion).toBe(VERSION);
    expect(p.status).toBe(UPDATE_STATUS.UP_TO_DATE);
  });
});

describe('updateStatusPanel — unknown / degraded sources', () => {
  it('degrades a draft release to UNKNOWN with empty-source diagnostics', () => {
    const p = updateStatusPanel({ tag_name: 'v9.9.9', draft: true });
    expect(p.status).toBe(UPDATE_STATUS.UNKNOWN);
    expect(p.statusLabel).toBe('UNKNOWN');
    expect(p.updateAvailable).toBe(false);
    expect(p.latestVersion).toBeNull();
    expect(p.source.status).toBe('empty');
    expect(p.lines[1].value).toBe('—');
    expect(p.lines[3].value).toBe('no usable release');
  });

  it('degrades an empty releases array to UNKNOWN', () => {
    const p = updateStatusPanel([]);
    expect(p.status).toBe(UPDATE_STATUS.UNKNOWN);
    expect(p.source.status).toBe('empty');
    expect(p.source.candidates).toBe(0);
  });

  it('degrades a malformed payload to UNKNOWN without throwing', () => {
    const p = updateStatusPanel(null);
    expect(p.status).toBe(UPDATE_STATUS.UNKNOWN);
    expect(p.source.status).toBe('malformed');
    expect(p.source.kind).toBe('unknown');
    expect(p.lines[3].value).toBe('no release data');
  });

  it('skips a prerelease when includePrerelease:false (→ UNKNOWN/empty)', () => {
    const p = updateStatusPanel({ tag_name: 'v0.2.999-alpha', prerelease: true }, { includePrerelease: false });
    expect(p.status).toBe(UPDATE_STATUS.UNKNOWN);
    expect(p.source.status).toBe('empty');
  });
});

describe('updateStatusPanel — inert / no-action invariants', () => {
  it('is read-only and never actionable', () => {
    const p = updateStatusPanel(SAMPLE_RELEASE_FEED);
    expect(p.readOnly).toBe(true);
    expect(p.actionable).toBe(false);
  });

  it('exposes NO fetch/install/update/navigate/href/onClick/autoUpdate key', () => {
    const p = updateStatusPanel(SAMPLE_RELEASE_FEED);
    for (const key of ['fetch', 'install', 'update', 'navigate', 'href', 'onClick', 'autoUpdate', 'sign', 'publish']) {
      expect(p).not.toHaveProperty(key);
    }
  });

  it('is deterministic for the same input', () => {
    expect(updateStatusPanel(SAMPLE_RELEASE_FEED)).toEqual(updateStatusPanel(SAMPLE_RELEASE_FEED));
  });
});

describe('SDK + ToriiDebug.shells exposure', () => {
  it('exposes updateStatus at the experimental SDK tier', () => {
    expect(SDK.SDK_SURFACE.updateStatus.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(typeof SDK.updateStatus.updateStatusPanel).toBe('function');
  });

  it('surfaces a read-only updateStatus shell report', () => {
    const r = updateStatusReport();
    expect(r.title).toBe('UPDATE STATUS');
    expect(r.readOnly).toBe(true);
    expect(r.actionable).toBe(false);
    expect(r.status).toBe(UPDATE_STATUS.UPDATE_AVAILABLE); // sample feed is newer
    expect(r.source.kind).toBe('list');
  });
});
