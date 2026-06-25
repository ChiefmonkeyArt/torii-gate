// tests/release-meta.test.js — pure RELEASE/UPDATE METADATA logic (tools/releaseMeta.mjs,
// v0.2.192). Covers channel derivation from the version tag, URL shaping, the buildReleaseMeta
// assembly, the validateReleaseMeta safety floor (incl. the no-auto-update contract + degraded
// inputs), and the text formatter. No fs/network — every input is plain data, fully node-
// deterministic.
import { describe, it, expect } from 'vitest';
import {
  RELEASE_META_BADGE, METADATA_SCHEMA_VERSION, RELEASE_META_KIND, RELEASE_META_FILE,
  UPDATE_CHANNELS, DEFAULT_SOURCE,
  channelForVersion, releaseUrlsFor, buildReleaseMeta, validateReleaseMeta, formatReleaseMeta,
} from '../tools/releaseMeta.mjs';

const V = 'v0.2.192-alpha';

describe('channelForVersion', () => {
  it('derives alpha/beta/rc from the prerelease tag', () => {
    expect(channelForVersion('v0.2.192-alpha')).toBe(UPDATE_CHANNELS.ALPHA);
    expect(channelForVersion('v1.0.0-beta')).toBe(UPDATE_CHANNELS.BETA);
    expect(channelForVersion('v1.0.0-rc.1')).toBe(UPDATE_CHANNELS.RC);
  });

  it('treats a tagless version as stable', () => {
    expect(channelForVersion('v1.2.3')).toBe(UPDATE_CHANNELS.STABLE);
  });

  it('returns unknown for an unrecognised tag or bad input', () => {
    expect(channelForVersion('v1.0.0-nightly')).toBe(UPDATE_CHANNELS.UNKNOWN);
    expect(channelForVersion('not-a-version')).toBe(UPDATE_CHANNELS.UNKNOWN);
    expect(channelForVersion(null)).toBe(UPDATE_CHANNELS.UNKNOWN);
    expect(channelForVersion(42)).toBe(UPDATE_CHANNELS.UNKNOWN);
  });
});

describe('releaseUrlsFor', () => {
  it('builds documentation-only https GitHub endpoints', () => {
    const { latestReleaseUrl, releasesPageUrl } = releaseUrlsFor('torii-quest', 'torii-quest');
    expect(latestReleaseUrl).toBe('https://api.github.com/repos/torii-quest/torii-quest/releases/latest');
    expect(releasesPageUrl).toBe('https://github.com/torii-quest/torii-quest/releases');
  });

  it('url-encodes owner/repo', () => {
    expect(releaseUrlsFor('a b', 'c/d').releasesPageUrl).toBe('https://github.com/a%20b/c%2Fd/releases');
  });
});

describe('buildReleaseMeta', () => {
  it('assembles a valid metadata object from a version', () => {
    const meta = buildReleaseMeta({ version: V, commit: 'abc1234', generatedAt: '2026-06-25T00:00:00Z' });
    expect(meta.kind).toBe(RELEASE_META_KIND);
    expect(meta.schemaVersion).toBe(METADATA_SCHEMA_VERSION);
    expect(meta.version).toBe(V);
    expect(meta.channel).toBe(UPDATE_CHANNELS.ALPHA);
    expect(meta.commit).toBe('abc1234');
    expect(meta.generatedAt).toBe('2026-06-25T00:00:00Z');
    expect(meta.source.owner).toBe(DEFAULT_SOURCE.owner);
    expect(meta.update).toEqual(expect.objectContaining({ autoUpdate: false, actionable: false, manual: true }));
    expect(validateReleaseMeta(meta).ok).toBe(true);
  });

  it('defaults commit/generatedAt to null and is deterministic for the same version', () => {
    const a = buildReleaseMeta({ version: V });
    const b = buildReleaseMeta({ version: V });
    expect(a.commit).toBeNull();
    expect(a.generatedAt).toBeNull();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('honours custom owner/repo', () => {
    const meta = buildReleaseMeta({ version: V, owner: 'me', repo: 'fork' });
    expect(meta.source.owner).toBe('me');
    expect(meta.source.releasesPageUrl).toContain('me/fork');
  });

  it('blank commit collapses to null', () => {
    expect(buildReleaseMeta({ version: V, commit: '' }).commit).toBeNull();
  });

  it('records a non-version input as null version with unknown channel', () => {
    const meta = buildReleaseMeta({ version: 42 });
    expect(meta.version).toBeNull();
    expect(meta.channel).toBe(UPDATE_CHANNELS.UNKNOWN);
    expect(validateReleaseMeta(meta).ok).toBe(false);
  });
});

describe('validateReleaseMeta — safety floor + shape', () => {
  it('passes a freshly built object', () => {
    expect(validateReleaseMeta(buildReleaseMeta({ version: V })).ok).toBe(true);
  });

  it('ERRORS when auto-update is enabled (no auto-update contract)', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.update.autoUpdate = true;
    const r = validateReleaseMeta(meta);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/autoUpdate MUST be false/);
  });

  it('ERRORS when the view is made actionable', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.update.actionable = true;
    expect(validateReleaseMeta(meta).ok).toBe(false);
  });

  it('ERRORS on a mismatched channel', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.channel = UPDATE_CHANNELS.STABLE;
    expect(validateReleaseMeta(meta).ok).toBe(false);
  });

  it('ERRORS on a bad version marker', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.version = 'nope';
    expect(validateReleaseMeta(meta).ok).toBe(false);
  });

  it('ERRORS on a non-https source URL', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.source.releasesPageUrl = 'http://insecure.example';
    expect(validateReleaseMeta(meta).ok).toBe(false);
  });

  it('ERRORS on empty required arrays', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.requiredFiles = [];
    expect(validateReleaseMeta(meta).ok).toBe(false);
  });

  it('is safe on degraded inputs (null / non-object / array)', () => {
    expect(validateReleaseMeta(null).ok).toBe(false);
    expect(validateReleaseMeta('x').ok).toBe(false);
    expect(validateReleaseMeta([]).ok).toBe(false);
    expect(validateReleaseMeta({}).ok).toBe(false);
  });

  it('warns (not errors) when channel is unknown but otherwise consistent', () => {
    const meta = buildReleaseMeta({ version: 'v1.0.0-nightly' });
    const r = validateReleaseMeta(meta);
    expect(r.warnings.join(' ')).toMatch(/unknown/);
  });
});

describe('formatReleaseMeta', () => {
  it('renders a block with the badge and validity line', () => {
    const out = formatReleaseMeta(buildReleaseMeta({ version: V, commit: 'abc1234' }));
    expect(out).toContain(RELEASE_META_BADGE);
    expect(out).toContain(V);
    expect(out).toContain('OFF (manual only)');
    expect(out).toContain('✓ metadata valid.');
  });

  it('shows the error line for invalid metadata', () => {
    const meta = buildReleaseMeta({ version: V });
    meta.update.autoUpdate = true;
    expect(formatReleaseMeta(meta)).toMatch(/✗ \d+ error/);
  });

  it('is safe on null', () => {
    expect(formatReleaseMeta(null)).toBe('release-meta: (no metadata)');
  });
});

describe('exported constants', () => {
  it('canonical output path is in-repo under public/', () => {
    expect(RELEASE_META_FILE).toBe('public/release-metadata.json');
  });
});
