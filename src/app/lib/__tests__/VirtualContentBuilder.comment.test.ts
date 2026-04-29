/**
 * Unit tests — COMMENT enrichment handling in VirtualContentBuilder.
 *
 * Comments are "reference" enrichments: they attach to existing lines without
 * creating new layers or modifying content. All tests here use a plain file
 * with no diff enrichments so comment behavior is isolated.
 */

import { EnrichmentType } from '@/app/api/wikiTypes';
import { makeContent, makeCommentEnrichment, buildVirtualContent } from './fixtures';

const LINES = ['alpha', 'beta', 'gamma', 'delta'];
const CONTENT = makeContent(LINES);

// ---------------------------------------------------------------------------
// Single comment on one interior line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: single comment on interior line', () => {
  const comment = makeCommentEnrichment(2, 2, 'c1');
  const vc = buildVirtualContent(CONTENT, [comment]);

  it('does not create a new layer', () => {
    expect(vc.layers).toHaveLength(1);
  });

  it('comment is attached to line 2', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 2);
    expect(line?.enrichments.some(e => e.id === 'c1')).toBe(true);
  });

  it('line 2 has exactly one enrichment', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 2);
    expect(line?.enrichments).toHaveLength(1);
  });

  it('other lines have no enrichments', () => {
    const withEnrichments = vc.finalLines.filter(
      l => l.lineNumber !== 2 && l.enrichments.length > 0
    );
    expect(withEnrichments).toHaveLength(0);
  });

  it('commented line is still an original line', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 2);
    expect(line?.isOriginalLine).toBe(true);
  });

  it('commented line content is unchanged', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 2);
    expect(line?.content).toBe('beta');
  });

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('total line count is unchanged', () => {
    expect(vc.finalLines).toHaveLength(LINES.length);
  });
});

// ---------------------------------------------------------------------------
// Comment on first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: on first line', () => {
  const comment = makeCommentEnrichment(1, 1, 'c-first');
  const vc = buildVirtualContent(CONTENT, [comment]);

  it('first line has the comment', () => {
    expect(vc.finalLines[0].enrichments.some(e => e.id === 'c-first')).toBe(true);
  });

  it('remaining lines have no enrichments', () => {
    const withEnrichments = vc.finalLines.slice(1).filter(l => l.enrichments.length > 0);
    expect(withEnrichments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Comment on last line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: on last line', () => {
  const comment = makeCommentEnrichment(4, 4, 'c-last');
  const vc = buildVirtualContent(CONTENT, [comment]);

  it('last line has the comment', () => {
    const last = vc.finalLines[vc.finalLines.length - 1];
    expect(last.enrichments.some(e => e.id === 'c-last')).toBe(true);
  });

  it('other lines have no enrichments', () => {
    const withEnrichments = vc.finalLines.slice(0, -1).filter(l => l.enrichments.length > 0);
    expect(withEnrichments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-line comment range (lineEnd > lineStart)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: multi-line range', () => {
  // Comment spans lines 2–4.
  const comment = makeCommentEnrichment(2, 4, 'c-range');
  const vc = buildVirtualContent(CONTENT, [comment]);

  it('line 2 has the comment', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 2);
    expect(line?.enrichments.some(e => e.id === 'c-range')).toBe(true);
  });

  it('line 3 has the comment', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 3);
    expect(line?.enrichments.some(e => e.id === 'c-range')).toBe(true);
  });

  it('line 4 has the comment', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 4);
    expect(line?.enrichments.some(e => e.id === 'c-range')).toBe(true);
  });

  it('line 1 (outside range) has no comment', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 1);
    expect(line?.enrichments).toHaveLength(0);
  });

  it('all three range lines carry the same enrichment object', () => {
    const enrichedLines = vc.finalLines.filter(l => l.enrichments.some(e => e.id === 'c-range'));
    expect(enrichedLines).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Multiple comments on the same line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: two comments on same line', () => {
  const c1 = makeCommentEnrichment(3, 3, 'c-A');
  const c2 = makeCommentEnrichment(3, 3, 'c-B');
  const vc = buildVirtualContent(CONTENT, [c1, c2]);

  it('line 3 has exactly two enrichments', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 3);
    expect(line?.enrichments).toHaveLength(2);
  });

  it('both comment IDs are present on line 3', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 3);
    const ids = line?.enrichments.map(e => e.id) ?? [];
    expect(ids).toContain('c-A');
    expect(ids).toContain('c-B');
  });

  it('other lines have no enrichments', () => {
    const withEnrichments = vc.finalLines.filter(
      l => l.lineNumber !== 3 && l.enrichments.length > 0
    );
    expect(withEnrichments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Two comments on different lines — no cross-contamination
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: two comments on different lines', () => {
  const c1 = makeCommentEnrichment(1, 1, 'd-1');
  const c2 = makeCommentEnrichment(4, 4, 'd-4');
  const vc = buildVirtualContent(CONTENT, [c1, c2]);

  it('line 1 has comment d-1 only', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 1);
    expect(line?.enrichments.map(e => e.id)).toEqual(['d-1']);
  });

  it('line 4 has comment d-4 only', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 4);
    expect(line?.enrichments.map(e => e.id)).toEqual(['d-4']);
  });

  it('lines 2 and 3 have no enrichments', () => {
    const middle = vc.finalLines.filter(l => l.lineNumber === 2 || l.lineNumber === 3);
    expect(middle.every(l => l.enrichments.length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Comment on a non-existent line (out of file bounds) — silently skipped
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: non-existent line is silently skipped', () => {
  const comment = makeCommentEnrichment(99, 99, 'c-oor');
  const vc = buildVirtualContent(CONTENT, [comment]);

  it('final line count is unchanged', () => {
    expect(vc.finalLines).toHaveLength(LINES.length);
  });

  it('no line has the out-of-bounds comment', () => {
    const withComment = vc.finalLines.filter(l => l.enrichments.some(e => e.id === 'c-oor'));
    expect(withComment).toHaveLength(0);
  });

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enrichmentsByType reflects comments
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment: enrichmentsByType map', () => {
  const c1 = makeCommentEnrichment(1, 1, 'map-c1');
  const c2 = makeCommentEnrichment(3, 3, 'map-c2');
  const vc = buildVirtualContent(CONTENT, [c1, c2]);

  it('enrichmentsByType has a COMMENT entry', () => {
    expect(vc.enrichmentsByType.has(EnrichmentType.Comment)).toBe(true);
  });

  it('COMMENT entry contains both enrichments', () => {
    expect(vc.enrichmentsByType.get(EnrichmentType.Comment)).toHaveLength(2);
  });

  it('enrichmentsByType has no EDIT entry', () => {
    expect(vc.enrichmentsByType.has(EnrichmentType.Edit)).toBe(false);
  });
});
