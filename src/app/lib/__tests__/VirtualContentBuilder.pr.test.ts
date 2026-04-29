/**
 * Unit tests — PR enrichment handling in VirtualContentBuilder.
 *
 * Covers: replace line, remove line, add line, layer structure, and prNumber metadata.
 */

import { DiffType, EnrichmentType } from '@/app/api/wikiTypes';
import { makeContent, makeHunk, makePREnrichment, buildVirtualContent } from './fixtures';

const LINES = ['alpha', 'beta', 'gamma', 'delta'];
const CONTENT = makeContent(LINES);
const PR_NUMBER = 42;

// ---------------------------------------------------------------------------
// PR: replace line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: replace line 1', () => {
  const hunk = makeHunk(1, 1, 1, 1, ['-alpha', '+PR-alpha']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('creates two layers (original + PR)', () => {
    expect(vc.layers).toHaveLength(2);
  });

  it('layer 1 references a PR enrichment', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.PRDiff);
  });

  it('deletion shows "alpha"', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.content).toBe('alpha');
  });

  it('addition shows "PR-alpha"', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.content).toBe('PR-alpha');
  });

  it('deletion carries prNumber', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.prNumber).toBe(PR_NUMBER);
  });

  it('addition carries prNumber', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.prNumber).toBe(PR_NUMBER);
  });

  it('deletion is isFirstInDiffGroup', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.isFirstInDiffGroup).toBe(true);
  });

  it('addition is NOT isFirstInDiffGroup', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.isFirstInDiffGroup).toBe(false);
  });

  it('non-modified original lines are preserved', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['beta', 'gamma', 'delta']);
  });

  it('no conflicts reported', () => {
    expect(vc.hasConflicts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PR: remove line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: remove line 4', () => {
  const hunk = makeHunk(4, 1, 4, 0, ['-delta']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('final line count is 4', () => {
    expect(vc.finalLines).toHaveLength(4);
  });

  it('deleted line shows "delta"', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.content).toBe('delta');
  });

  it('deleted line carries prNumber', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.prNumber).toBe(PR_NUMBER);
  });

  it('deleted line has correct lineNumber', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.lineNumber).toBe(4);
  });

  it('remaining original lines are present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma']);
  });
});

// ---------------------------------------------------------------------------
// PR: remove first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: remove first line', () => {
  const hunk = makeHunk(1, 1, 1, 0, ['-alpha']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('first virtual line is the deletion of "alpha"', () => {
    expect(vc.finalLines[0].content).toBe('alpha');
    expect(vc.finalLines[0].diffType).toBe(DiffType.Deletion);
  });

  it('"beta" becomes the second virtual line and remains original', () => {
    expect(vc.finalLines[1].content).toBe('beta');
    expect(vc.finalLines[1].isOriginalLine).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PR: add line before first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: add line before first line', () => {
  const hunk = makeHunk(1, 1, 1, 2, ['+PR-new', ' alpha']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('"PR-new" is the first virtual line', () => {
    expect(vc.finalLines[0].content).toBe('PR-new');
  });

  it('"PR-new" carries prNumber', () => {
    expect(vc.finalLines[0].prNumber).toBe(PR_NUMBER);
  });

  it('"alpha" is preserved as original after the insertion', () => {
    const alphaLine = vc.finalLines.find(l => l.content === 'alpha');
    expect(alphaLine?.isOriginalLine).toBe(true);
  });

  it('all original lines are present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });
});

// ---------------------------------------------------------------------------
// PR: add line after last line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: add line after last line', () => {
  const hunk = makeHunk(4, 1, 4, 2, [' delta', '+PR-last']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('"delta" is preserved as original', () => {
    const deltaLine = vc.finalLines.find(l => l.content === 'delta');
    expect(deltaLine?.isOriginalLine).toBe(true);
  });

  it('"PR-last" is the last virtual line', () => {
    expect(vc.finalLines[vc.finalLines.length - 1].content).toBe('PR-last');
  });

  it('"PR-last" carries prNumber', () => {
    expect(vc.finalLines[vc.finalLines.length - 1].prNumber).toBe(PR_NUMBER);
  });
});

// ---------------------------------------------------------------------------
// PR: mixed hunk (context + delete + add + context)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: mixed hunk', () => {
  const hunk = makeHunk(2, 3, 2, 3, [' beta', '-gamma', '+PR-gamma', ' delta']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('virtual order is: alpha → beta → deletion → addition → delta', () => {
    expect(vc.finalLines.map(l => l.content)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'PR-gamma',
      'delta',
    ]);
  });

  it('both context lines remain original', () => {
    const betaLine = vc.finalLines.find(l => l.content === 'beta');
    const deltaLine = vc.finalLines.find(l => l.content === 'delta');
    expect(betaLine?.isOriginalLine).toBe(true);
    expect(deltaLine?.isOriginalLine).toBe(true);
  });

  it('deletion is isFirstInDiffGroup', () => {
    const del = vc.finalLines.find(l => l.content === 'gamma');
    expect(del?.isFirstInDiffGroup).toBe(true);
  });

  it('addition is not isFirstInDiffGroup', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-gamma');
    expect(add?.isFirstInDiffGroup).toBe(false);
  });

  it('both diff lines carry prNumber', () => {
    const del = vc.finalLines.find(l => l.content === 'gamma')!;
    const add = vc.finalLines.find(l => l.content === 'PR-gamma')!;
    expect(del.prNumber).toBe(PR_NUMBER);
    expect(add.prNumber).toBe(PR_NUMBER);
  });
});

// ---------------------------------------------------------------------------
// Two separate PRs (different numbers) on non-overlapping lines
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: two PRs on non-overlapping lines', () => {
  const hunkA = makeHunk(1, 1, 1, 1, ['-alpha', '+PR10-alpha']);
  const hunkB = makeHunk(3, 1, 3, 1, ['-gamma', '+PR99-gamma']);
  const prA = makePREnrichment(hunkA, 10);
  const prB = makePREnrichment(hunkB, 99);
  const vc = buildVirtualContent(CONTENT, [prA, prB]);

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('creates three layers (original + PR10 + PR99)', () => {
    expect(vc.layers).toHaveLength(3);
  });

  it('PR10 addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'PR10-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('PR99 addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'PR99-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('PR10 diff lines carry prNumber 10', () => {
    const add = vc.finalLines.find(l => l.content === 'PR10-alpha');
    expect(add?.prNumber).toBe(10);
  });

  it('PR99 diff lines carry prNumber 99', () => {
    const add = vc.finalLines.find(l => l.content === 'PR99-gamma');
    expect(add?.prNumber).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// stats fields
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: stats fields', () => {
  // Replace line 1 (1 deletion + 1 addition = 2 inserted lines; 3 original remain).
  const hunk = makeHunk(1, 1, 1, 1, ['-alpha', '+PR-alpha']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(hunk)]);

  it('stats.totalLines equals finalLines length', () => {
    expect(vc.stats.totalLines).toBe(vc.finalLines.length);
  });

  it('stats.totalLines is 5', () => {
    expect(vc.stats.totalLines).toBe(5);
  });

  it('stats.insertedLines is 2 (deletion + addition)', () => {
    expect(vc.stats.insertedLines).toBe(2);
  });

  it('stats.totalLayers is 2', () => {
    expect(vc.stats.totalLayers).toBe(2);
  });

  it('enrichmentsByType has a PR entry', () => {
    expect(vc.enrichmentsByType.has(EnrichmentType.PRDiff)).toBe(true);
  });

  it('PR entry contains 1 enrichment', () => {
    expect(vc.enrichmentsByType.get(EnrichmentType.PRDiff)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PR: single hunk with two change groups separated by context
// (regression: second group must also get isFirstInDiffGroup=true)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — PR: hunk with two separate change groups', () => {
  // Content: line1..line6
  // Hunk: replace line2, context line3, replace line4
  const LINES6 = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6'];
  const hunk = makeHunk(2, 3, 2, 3, ['-line2', '+line2-pr', ' line3', '-line4', '+line4-pr']);
  const vc = buildVirtualContent(makeContent(LINES6), [makePREnrichment(hunk)]);

  it('first deletion (line2) is isFirstInDiffGroup', () => {
    const del = vc.finalLines.find(l => l.content === 'line2');
    expect(del?.isFirstInDiffGroup).toBe(true);
  });

  it('first addition (line2-pr) is NOT isFirstInDiffGroup', () => {
    const add = vc.finalLines.find(l => l.content === 'line2-pr');
    expect(add?.isFirstInDiffGroup).toBe(false);
  });

  it('second deletion (line4) is isFirstInDiffGroup', () => {
    const del = vc.finalLines.find(l => l.content === 'line4');
    expect(del?.isFirstInDiffGroup).toBe(true);
  });

  it('second addition (line4-pr) is NOT isFirstInDiffGroup', () => {
    const add = vc.finalLines.find(l => l.content === 'line4-pr');
    expect(add?.isFirstInDiffGroup).toBe(false);
  });

  it('both deletions carry prNumber', () => {
    const del2 = vc.finalLines.find(l => l.content === 'line2');
    const del4 = vc.finalLines.find(l => l.content === 'line4');
    expect(del2?.prNumber).toBe(PR_NUMBER);
    expect(del4?.prNumber).toBe(PR_NUMBER);
  });

  it('original lines line1, line3, line5, line6 are preserved', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['line1', 'line3', 'line5', 'line6']);
  });
});
