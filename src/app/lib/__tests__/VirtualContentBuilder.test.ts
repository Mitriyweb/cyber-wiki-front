/**
 * Unit tests for VirtualContentBuilder.
 *
 * Each describe block covers one scenario. Tests are ordered from simplest
 * (no enrichments) to most complex (conflict detection). Each it() checks a
 * single observable property so failures point to the exact mismatch.
 *
 * File under test:
 *   src/frontend/components/main-view/content/virtual-content/VirtualContentBuilder.ts
 */

import { DiffType, EnrichmentType } from '@/app/api/wikiTypes';
import {
  makeContent,
  makeHunk,
  makeEditEnrichment,
  makePREnrichment,
  makeCommitEnrichment,
  makeCommentEnrichment,
  buildVirtualContent,
} from './fixtures';

// ---------------------------------------------------------------------------
// Shared fixture: a 4-line file used by most tests
// ---------------------------------------------------------------------------

const LINES = ['alpha', 'beta', 'gamma', 'delta'];
const CONTENT = makeContent(LINES);

// ---------------------------------------------------------------------------
// 1. No enrichments
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — no enrichments', () => {
  const vc = buildVirtualContent(CONTENT, []);

  it('creates exactly one layer', () => {
    expect(vc.layers).toHaveLength(1);
  });

  it('final line count equals original line count', () => {
    expect(vc.finalLines).toHaveLength(LINES.length);
  });

  it('every final line is marked as original', () => {
    expect(vc.finalLines.every(l => l.isOriginalLine)).toBe(true);
  });

  it('no final line is marked as inserted', () => {
    expect(vc.finalLines.every(l => !l.isInsertedLine)).toBe(true);
  });

  it('no final line has a diffType', () => {
    expect(vc.finalLines.every(l => l.diffType === undefined)).toBe(true);
  });

  it('line numbers run 1-4 in order', () => {
    expect(vc.finalLines.map(l => l.lineNumber)).toEqual([1, 2, 3, 4]);
  });

  it('virtual line numbers run 1-4 in order', () => {
    expect(vc.finalLines.map(l => l.virtualLineNumber)).toEqual([1, 2, 3, 4]);
  });

  it('content matches original lines', () => {
    expect(vc.finalLines.map(l => l.content)).toEqual(LINES);
  });

  it('reports no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('stats.conflictCount is 0', () => {
    expect(vc.stats.conflictCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Edit: replace line (deletion + addition at same position)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: replace line 2', () => {
  // @@ -2,1 +2,1 @@
  //  -beta
  //  +new-beta
  const hunk = makeHunk(2, 1, 2, 1, ['-beta', '+new-beta']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('creates two layers (original + edit)', () => {
    expect(vc.layers).toHaveLength(2);
  });

  it('final line count is 5 (4 original + 1 extra diff line)', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('line 1 content is unchanged', () => {
    expect(vc.finalLines[0].content).toBe('alpha');
  });

  it('line 1 is original', () => {
    expect(vc.finalLines[0].isOriginalLine).toBe(true);
  });

  it('diff line 1 shows deletion of "beta"', () => {
    expect(vc.finalLines[1].content).toBe('beta');
  });

  it('diff line 1 has DELETION diffType', () => {
    expect(vc.finalLines[1].diffType).toBe(DiffType.Deletion);
  });

  it('deletion line is isFirstInDiffGroup', () => {
    expect(vc.finalLines[1].isFirstInDiffGroup).toBe(true);
  });

  it('deletion line is not an original line', () => {
    expect(vc.finalLines[1].isOriginalLine).toBe(false);
  });

  it('deletion line lineNumber is 2', () => {
    expect(vc.finalLines[1].lineNumber).toBe(2);
  });

  it('diff line 2 shows addition "new-beta"', () => {
    expect(vc.finalLines[2].content).toBe('new-beta');
  });

  it('diff line 2 has ADDITION diffType', () => {
    expect(vc.finalLines[2].diffType).toBe(DiffType.Addition);
  });

  it('addition line is NOT isFirstInDiffGroup', () => {
    expect(vc.finalLines[2].isFirstInDiffGroup).toBe(false);
  });

  it('both diff lines have editId set', () => {
    expect(vc.finalLines[1].editId).toBe('test-edit-id');
    expect(vc.finalLines[2].editId).toBe('test-edit-id');
  });

  it('original lines after the hunk are preserved', () => {
    const origLines = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origLines).toEqual(['alpha', 'gamma', 'delta']);
  });

  it('virtual line numbers are sequential', () => {
    const vls = vc.finalLines.map(l => l.virtualLineNumber);
    expect(vls).toEqual([1, 2, 3, 4, 5]);
  });

  it('stats report 1 inserted line', () => {
    expect(vc.stats.insertedLines).toBe(2); // deletion + addition
  });
});

// ---------------------------------------------------------------------------
// 3. Edit: remove line (deletion only)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: remove line 2', () => {
  // @@ -2,1 +2,0 @@
  //  -beta
  const hunk = makeHunk(2, 1, 2, 0, ['-beta']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('creates two layers', () => {
    expect(vc.layers).toHaveLength(2);
  });

  it('final line count is 4 (deletion shown as a line)', () => {
    expect(vc.finalLines).toHaveLength(4);
  });

  it('deleted line content is "beta"', () => {
    const deletion = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(deletion?.content).toBe('beta');
  });

  it('deleted line has correct lineNumber', () => {
    const deletion = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(deletion?.lineNumber).toBe(2);
  });

  it('deleted line is isFirstInDiffGroup', () => {
    const deletion = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(deletion?.isFirstInDiffGroup).toBe(true);
  });

  it('deleted line has editId', () => {
    const deletion = vc.finalLines.find(l => l.diffType === DiffType.Deletion);
    expect(deletion?.editId).toBe('test-edit-id');
  });

  it('non-deleted original lines are preserved', () => {
    const origLines = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origLines).toEqual(['alpha', 'gamma', 'delta']);
  });

  it('virtual line numbers are sequential', () => {
    const vls = vc.finalLines.map(l => l.virtualLineNumber);
    expect(vls).toEqual([1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// 4. Edit: add line after line 2 (pure insertion with context)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: add line after line 2', () => {
  // @@ -2,1 +2,2 @@
  //   beta       (context — must be preserved)
  //  +new-line
  const hunk = makeHunk(2, 1, 2, 2, [' beta', '+new-line']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('creates two layers', () => {
    expect(vc.layers).toHaveLength(2);
  });

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('context line "beta" is preserved as an original line', () => {
    const betaLine = vc.finalLines.find(l => l.content === 'beta');
    expect(betaLine?.isOriginalLine).toBe(true);
  });

  it('"beta" retains lineNumber 2', () => {
    const betaLine = vc.finalLines.find(l => l.content === 'beta');
    expect(betaLine?.lineNumber).toBe(2);
  });

  it('addition line content is "new-line"', () => {
    const addition = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(addition?.content).toBe('new-line');
  });

  it('addition appears immediately after "beta" in virtual order', () => {
    const betaIdx = vc.finalLines.findIndex(l => l.content === 'beta');
    expect(vc.finalLines[betaIdx + 1].diffType).toBe(DiffType.Addition);
  });

  it('addition line is isFirstInDiffGroup', () => {
    const addition = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(addition?.isFirstInDiffGroup).toBe(true);
  });

  it('addition line has editId', () => {
    const addition = vc.finalLines.find(l => l.diffType === DiffType.Addition);
    expect(addition?.editId).toBe('test-edit-id');
  });

  it('"gamma" follows the addition', () => {
    const addIdx = vc.finalLines.findIndex(l => l.diffType === DiffType.Addition);
    expect(vc.finalLines[addIdx + 1].content).toBe('gamma');
  });

  it('all original lines are still present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('virtual line numbers are sequential', () => {
    const vls = vc.finalLines.map(l => l.virtualLineNumber);
    expect(vls).toEqual([1, 2, 3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// 5. Edit: add line before first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: add line before first line', () => {
  // @@ -1,1 +1,2 @@
  //  +new-first
  //   alpha      (context — must be preserved)
  const hunk = makeHunk(1, 1, 1, 2, ['+new-first', ' alpha']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('insertion "new-first" is the first virtual line', () => {
    expect(vc.finalLines[0].content).toBe('new-first');
  });

  it('insertion has ADDITION diffType', () => {
    expect(vc.finalLines[0].diffType).toBe(DiffType.Addition);
  });

  it('insertion is isFirstInDiffGroup', () => {
    expect(vc.finalLines[0].isFirstInDiffGroup).toBe(true);
  });

  it('"alpha" is preserved as original line after the insertion', () => {
    expect(vc.finalLines[1].content).toBe('alpha');
    expect(vc.finalLines[1].isOriginalLine).toBe(true);
  });

  it('all original lines are present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('virtual line numbers are sequential', () => {
    const vls = vc.finalLines.map(l => l.virtualLineNumber);
    expect(vls).toEqual([1, 2, 3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// 6. Edit: add line after last line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: add line after last line', () => {
  // @@ -4,1 +4,2 @@
  //   delta      (context — must be preserved)
  //  +new-last
  const hunk = makeHunk(4, 1, 4, 2, [' delta', '+new-last']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('"delta" is preserved as an original line', () => {
    const deltaLine = vc.finalLines.find(l => l.content === 'delta');
    expect(deltaLine?.isOriginalLine).toBe(true);
  });

  it('"new-last" is the last virtual line', () => {
    expect(vc.finalLines[4].content).toBe('new-last');
  });

  it('"new-last" has ADDITION diffType', () => {
    expect(vc.finalLines[4].diffType).toBe(DiffType.Addition);
  });

  it('all original lines are present', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });
});

// ---------------------------------------------------------------------------
// 7. Edit: remove first line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: remove first line', () => {
  const hunk = makeHunk(1, 1, 1, 0, ['-alpha']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('final line count is 4', () => {
    expect(vc.finalLines).toHaveLength(4);
  });

  it('first virtual line is the deletion of "alpha"', () => {
    expect(vc.finalLines[0].content).toBe('alpha');
    expect(vc.finalLines[0].diffType).toBe(DiffType.Deletion);
  });

  it('"beta" is the second virtual line and remains original', () => {
    expect(vc.finalLines[1].content).toBe('beta');
    expect(vc.finalLines[1].isOriginalLine).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Edit: remove last line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: remove last line', () => {
  const hunk = makeHunk(4, 1, 4, 0, ['-delta']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('final line count is 4', () => {
    expect(vc.finalLines).toHaveLength(4);
  });

  it('last virtual line is the deletion of "delta"', () => {
    expect(vc.finalLines[3].content).toBe('delta');
    expect(vc.finalLines[3].diffType).toBe(DiffType.Deletion);
  });

  it('"gamma" precedes the deletion and remains original', () => {
    expect(vc.finalLines[2].content).toBe('gamma');
    expect(vc.finalLines[2].isOriginalLine).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Edit: mixed hunk (context + delete + add + context)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: mixed hunk (context around diff)', () => {
  // @@ -2,3 +2,3 @@
  //   beta        (context)
  //  -gamma
  //  +new-gamma
  //   delta       (context)
  const hunk = makeHunk(2, 3, 2, 3, [' beta', '-gamma', '+new-gamma', ' delta']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('final line count is 5', () => {
    expect(vc.finalLines).toHaveLength(5);
  });

  it('"beta" context is preserved as original', () => {
    const betaLine = vc.finalLines.find(l => l.content === 'beta');
    expect(betaLine?.isOriginalLine).toBe(true);
  });

  it('"gamma" is shown as deletion', () => {
    const del = vc.finalLines.find(l => l.content === 'gamma');
    expect(del?.diffType).toBe(DiffType.Deletion);
  });

  it('"new-gamma" is shown as addition', () => {
    const add = vc.finalLines.find(l => l.content === 'new-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('"delta" context is preserved as original', () => {
    const deltaLine = vc.finalLines.find(l => l.content === 'delta');
    expect(deltaLine?.isOriginalLine).toBe(true);
  });

  it('deletion is isFirstInDiffGroup, addition is not', () => {
    const del = vc.finalLines.find(l => l.content === 'gamma')!;
    const add = vc.finalLines.find(l => l.content === 'new-gamma')!;
    expect(del.isFirstInDiffGroup).toBe(true);
    expect(add.isFirstInDiffGroup).toBe(false);
  });

  it('virtual order is: alpha → beta → deletion → addition → delta', () => {
    expect(vc.finalLines.map(l => l.content)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'new-gamma',
      'delta',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 10. Layer structure
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — layer structure', () => {
  const hunk = makeHunk(2, 1, 2, 1, ['-beta', '+new-beta']);
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk)]);

  it('layer 0 has no enrichment reference', () => {
    expect(vc.layers[0].enrichment).toBeUndefined();
  });

  it('layer 1 references the edit enrichment', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.Edit);
  });

  it('layer 0 contains all original lines', () => {
    expect(vc.layers[0].lines.map(l => l.content)).toEqual(LINES);
  });

  it('finalLines come from the last layer', () => {
    expect(vc.finalLines).toBe(vc.layers[vc.layers.length - 1].lines);
  });

  it('stats.totalLayers matches layer array length', () => {
    expect(vc.stats.totalLayers).toBe(vc.layers.length);
  });
});

// ---------------------------------------------------------------------------
// 11. Reference enrichment: comment attached to original line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — comment enrichment', () => {
  const comment = makeCommentEnrichment(3, 3, 'c1');
  const vc = buildVirtualContent(CONTENT, [comment]);

  it('creates one layer (comments do not create new layers)', () => {
    expect(vc.layers).toHaveLength(1);
  });

  it('comment is attached to the line with lineNumber 3', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 3 && l.isOriginalLine);
    expect(line?.enrichments.some(e => e.id === 'c1')).toBe(true);
  });

  it('other lines have no enrichments', () => {
    const linesWithEnrichments = vc.finalLines.filter(
      l => l.enrichments.length > 0 && !l.enrichments.some(e => e.id === 'c1')
    );
    expect(linesWithEnrichments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Multiple non-conflicting enrichments (edit + PR on different lines)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — two non-conflicting enrichments', () => {
  // Edit modifies line 1; PR modifies line 3. No overlap.
  const editHunk = makeHunk(1, 1, 1, 1, ['-alpha', '+ALPHA']);
  const prHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+GAMMA']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(prHunk), makeEditEnrichment(editHunk)]);

  it('creates three layers (original + PR + edit)', () => {
    expect(vc.layers).toHaveLength(3);
  });

  it('no conflicts detected', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('PR deletion of "gamma" is present', () => {
    const del = vc.finalLines.find(l => l.content === 'gamma' && l.diffType === DiffType.Deletion);
    expect(del).toBeDefined();
  });

  it('edit deletion of "alpha" is present', () => {
    const del = vc.finalLines.find(l => l.content === 'alpha' && l.diffType === DiffType.Deletion);
    expect(del).toBeDefined();
  });

  it('PR addition "GAMMA" is present', () => {
    const add = vc.finalLines.find(l => l.content === 'GAMMA');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition "ALPHA" is present', () => {
    const add = vc.finalLines.find(l => l.content === 'ALPHA');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('PR badge line has prNumber set', () => {
    const prLine = vc.finalLines.find(l => l.prNumber !== undefined);
    expect(prLine?.prNumber).toBe(42);
  });

  it('edit badge line has editId set', () => {
    const editLine = vc.finalLines.find(l => l.editId !== undefined);
    expect(editLine?.editId).toBe('test-edit-id');
  });
});

// ---------------------------------------------------------------------------
// 13. Conflict detection: two enrichments modify the same original lines
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: PR and edit both modify line 2', () => {
  // PR: replaces "beta" with "PR-beta"
  const prHunk = makeHunk(2, 1, 2, 1, ['-beta', '+PR-beta']);
  // Edit: also replaces "beta" with "edit-beta"  ← CONFLICT
  const editHunk = makeHunk(2, 1, 2, 1, ['-beta', '+edit-beta']);

  const vc = buildVirtualContent(CONTENT, [makePREnrichment(prHunk), makeEditEnrichment(editHunk)]);

  it('detects a conflict', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('stats.conflictCount is 1', () => {
    expect(vc.stats.conflictCount).toBe(1);
  });

  it('PR diff lines are present (higher priority wins)', () => {
    const prAdd = vc.finalLines.find(l => l.content === 'PR-beta');
    expect(prAdd).toBeDefined();
  });

  it('edit diff lines are NOT present (lower priority lost to conflict)', () => {
    const editAdd = vc.finalLines.find(l => l.content === 'edit-beta');
    expect(editAdd).toBeUndefined();
  });

  it('a conflict enrichment is attached to the anchor line', () => {
    const conflictLine = vc.finalLines.find(l =>
      l.enrichments.some(e => e.type === EnrichmentType.Conflict)
    );
    expect(conflictLine).toBeDefined();
  });

  it('conflict enrichment carries both original enrichments in data', () => {
    const conflictEnr = vc.finalLines
      .flatMap(l => l.enrichments)
      .find(e => e.type === EnrichmentType.Conflict);
    expect(conflictEnr?.data.firstEnrichment?.type).toBe(EnrichmentType.PRDiff);
    expect(conflictEnr?.data.secondEnrichment?.type).toBe(EnrichmentType.Edit);
  });
});

// ---------------------------------------------------------------------------
// 14. Conflict detection: non-conflicting hunks in the same pair of enrichments
//     still render normally
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: only overlapping hunks are blocked', () => {
  // Commit changes lines 1 and 3.
  // Edit changes line 1 (conflict) and line 4 (no conflict).
  const commitHunkLine1 = makeCommitEnrichment(makeHunk(1, 1, 1, 1, ['-alpha', '+commit-alpha']));
  const editHunkLine1 = makeEditEnrichment(
    makeHunk(1, 1, 1, 1, ['-alpha', '+edit-alpha']),
    'edit-id'
  );
  const editHunkLine4 = makeEditEnrichment(
    makeHunk(4, 1, 4, 1, ['-delta', '+edit-delta']),
    'edit-id'
  );

  const vc = buildVirtualContent(CONTENT, [commitHunkLine1, editHunkLine1, editHunkLine4]);

  it('conflict detected for line 1', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('exactly 1 conflict generated (line 4 edit is clean)', () => {
    expect(vc.stats.conflictCount).toBe(1);
  });

  it('edit at line 4 renders its addition', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-delta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commit addition at line 1 is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition at line 1 is absent (conflict)', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-alpha');
    expect(add).toBeUndefined();
  });
});
