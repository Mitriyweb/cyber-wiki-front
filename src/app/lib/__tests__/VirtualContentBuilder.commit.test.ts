/**
 * Unit tests — commit enrichment handling in VirtualContentBuilder.
 *
 * Covers: replace line, remove line, add line, layer structure, and commitSha metadata.
 */

import { DiffType, EnrichmentType } from '@/app/api/wikiTypes';
import { makeContent, makeHunk, makeCommitEnrichment, buildVirtualContent } from './fixtures';

const LINES = ['alpha', 'beta', 'gamma', 'delta'];
const CONTENT = makeContent(LINES);
const COMMIT_SHA = 'abc1234def';

// ---------------------------------------------------------------------------
// Commit: replace line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: replace line 2', () => {
  const hunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('creates two layers (original + commit)', () => {
    expect(vc.layers).toHaveLength(2);
  });

  it('layer 1 references a commit enrichment', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.Commit);
  });

  it('deletion shows original "beta"', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.content).toBe('beta');
  });

  it('addition shows "commit-beta"', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.content).toBe('commit-beta');
  });

  it('deletion carries commitSha', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.commitSha).toBe(COMMIT_SHA);
  });

  it('addition carries commitSha', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.commitSha).toBe(COMMIT_SHA);
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
    expect(origContents).toEqual(['alpha', 'gamma', 'delta']);
  });

  it('virtual line numbers are sequential', () => {
    expect(vc.finalLines.map(l => l.virtualLineNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('no conflicts reported', () => {
    expect(vc.hasConflicts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Commit: remove line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: remove line 3', () => {
  const hunk = makeHunk(3, 1, 3, 0, ['-gamma']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('final line count is 4', () => {
    expect(vc.finalLines).toHaveLength(4);
  });

  it('deleted line shows "gamma"', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.content).toBe('gamma');
  });

  it('deleted line has correct lineNumber', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.lineNumber).toBe(3);
  });

  it('deleted line carries commitSha', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.commitSha).toBe(COMMIT_SHA);
  });

  it('deleted line is isFirstInDiffGroup', () => {
    const del = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(del?.isFirstInDiffGroup).toBe(true);
  });

  it('surrounding original lines are preserved', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'delta']);
  });

  it('virtual line numbers are sequential', () => {
    expect(vc.finalLines.map(l => l.virtualLineNumber)).toEqual([1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// Commit: remove first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: remove first line', () => {
  const hunk = makeHunk(1, 1, 1, 0, ['-alpha']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

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
// Commit: remove last line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: remove last line', () => {
  const hunk = makeHunk(4, 1, 4, 0, ['-delta']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('last virtual line is the deletion of "delta"', () => {
    const last = vc.finalLines[vc.finalLines.length - 1];
    expect(last.content).toBe('delta');
    expect(last.diffType).toBe(DiffType.Deletion);
  });

  it('"gamma" precedes the deletion and remains original', () => {
    const gammaIdx = vc.finalLines.findIndex(l => l.content === 'gamma');
    expect(vc.finalLines[gammaIdx].isOriginalLine).toBe(true);
    expect(vc.finalLines[gammaIdx + 1].diffType).toBe(DiffType.Deletion);
  });
});

// ---------------------------------------------------------------------------
// Commit: add line after existing line (pure insertion with context)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: add line after line 2', () => {
  // @@ -2,1 +2,2 @@
  //   beta       (context — must be preserved)
  //  +commit-new
  const hunk = makeHunk(2, 1, 2, 2, [' beta', '+commit-new']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('context line "beta" is preserved as original', () => {
    const betaLine = vc.finalLines.find(l => l.content === 'beta');
    expect(betaLine?.isOriginalLine).toBe(true);
  });

  it('added line content is "commit-new"', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.content).toBe('commit-new');
  });

  it('added line carries commitSha', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.commitSha).toBe(COMMIT_SHA);
  });

  it('added line is isFirstInDiffGroup', () => {
    const add = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(add?.isFirstInDiffGroup).toBe(true);
  });

  it('"commit-new" appears immediately after "beta"', () => {
    const betaIdx = vc.finalLines.findIndex(l => l.content === 'beta');
    expect(vc.finalLines[betaIdx + 1].content).toBe('commit-new');
  });

  it('all original lines are present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });
});

// ---------------------------------------------------------------------------
// Commit: add line before first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: add line before first line', () => {
  const hunk = makeHunk(1, 1, 1, 2, ['+commit-first', ' alpha']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('"commit-first" is the first virtual line', () => {
    expect(vc.finalLines[0].content).toBe('commit-first');
  });

  it('"commit-first" has ADDITION diffType', () => {
    expect(vc.finalLines[0].diffType).toBe(DiffType.Addition);
  });

  it('"alpha" is preserved as original after the insertion', () => {
    expect(vc.finalLines[1].content).toBe('alpha');
    expect(vc.finalLines[1].isOriginalLine).toBe(true);
  });

  it('all original lines are present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });
});

// ---------------------------------------------------------------------------
// Commit: mixed hunk (context + delete + add + context)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: mixed hunk', () => {
  // @@ -2,3 +2,3 @@
  //   beta        (context)
  //  -gamma
  //  +commit-gamma
  //   delta       (context)
  const hunk = makeHunk(2, 3, 2, 3, [' beta', '-gamma', '+commit-gamma', ' delta']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('virtual order is: alpha → beta → deletion → addition → delta', () => {
    expect(vc.finalLines.map(l => l.content)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'commit-gamma',
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
    const add = vc.finalLines.find(l => l.content === 'commit-gamma');
    expect(add?.isFirstInDiffGroup).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Two separate commits on different lines
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: two commits on non-overlapping lines', () => {
  // Two distinct commits (different SHAs) each modifying a different line.
  const hunkA = makeHunk(1, 1, 1, 1, ['-alpha', '+commit-A-alpha']);
  const hunkB = makeHunk(3, 1, 3, 1, ['-gamma', '+commit-B-gamma']);
  const commitA = makeCommitEnrichment(hunkA, 'sha-commit-A');
  const commitB = makeCommitEnrichment(hunkB, 'sha-commit-B');
  const vc = buildVirtualContent(CONTENT, [commitA, commitB]);

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('creates three layers (original + commitA + commitB)', () => {
    expect(vc.layers).toHaveLength(3);
  });

  it('commitA addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-A-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commitB addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-B-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commitA diff lines carry sha-commit-A', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-A-alpha');
    expect(add?.commitSha).toBe('sha-commit-A');
  });

  it('commitB diff lines carry sha-commit-B', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-B-gamma');
    expect(add?.commitSha).toBe('sha-commit-B');
  });
});

// ---------------------------------------------------------------------------
// stats fields
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — commit: stats fields', () => {
  // Replace line 2 (1 deletion + 1 addition = 2 inserted lines; 3 original lines remain).
  const hunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk)]);

  it('stats.totalLines equals finalLines length', () => {
    expect(vc.stats.totalLines).toBe(vc.finalLines.length);
  });

  it('stats.totalLines is 5 (4 original + 1 extra diff line)', () => {
    expect(vc.stats.totalLines).toBe(5);
  });

  it('stats.insertedLines is 2 (deletion + addition)', () => {
    expect(vc.stats.insertedLines).toBe(2);
  });

  it('stats.totalLayers is 2', () => {
    expect(vc.stats.totalLayers).toBe(2);
  });

  it('stats.conflictCount is 0', () => {
    expect(vc.stats.conflictCount).toBe(0);
  });
});
