/**
 * Unit tests — conflict detection in VirtualContentBuilder.
 *
 * Covers:
 *   - PR beats commit on same line
 *   - PR beats edit on same line
 *   - Commit beats edit on same line
 *   - Three-way conflict (PR, commit, edit all on same line)
 *   - Partial conflict: only overlapping hunks are blocked, clean hunks render
 *   - Conflict enrichment data (firstEnrichment / secondEnrichment)
 *   - Conflict anchor line attachment
 *   - Non-overlapping hunks from a losing enrichment still render
 */

import { DiffType, EnrichmentType } from '@/app/api/wikiTypes';
import {
  makeContent,
  makeHunk,
  makeEditEnrichment,
  makePREnrichment,
  makeCommitEnrichment,
  buildVirtualContent,
} from './fixtures';

const LINES = ['alpha', 'beta', 'gamma', 'delta'];
const CONTENT = makeContent(LINES);

// ---------------------------------------------------------------------------
// PR beats commit on same line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: PR beats commit on same line', () => {
  const prHunk = makeHunk(2, 1, 2, 1, ['-beta', '+PR-beta']);
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeCommitEnrichment(commitHunk),
  ]);

  it('detects a conflict', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('conflict count is 1', () => {
    expect(vc.stats.conflictCount).toBe(1);
  });

  it('PR addition is present (winner)', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-beta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commit addition is absent (loser)', () => {
    expect(vc.finalLines.find(l => l.content === 'commit-beta')).toBeUndefined();
  });

  it('conflict enrichment is attached to the anchor line', () => {
    const conflictLine = vc.finalLines.find(l =>
      l.enrichments.some(e => e.type === EnrichmentType.Conflict)
    );
    expect(conflictLine).toBeDefined();
  });

  it('conflict anchor line has lineNumber 2', () => {
    const conflictLine = vc.finalLines.find(l =>
      l.enrichments.some(e => e.type === EnrichmentType.Conflict)
    );
    expect(conflictLine?.lineNumber).toBe(2);
  });

  it('conflict data identifies PR as the first (winning) enrichment', () => {
    const conflictEnr = vc.finalLines
      .flatMap(l => l.enrichments)
      .find(e => e.type === EnrichmentType.Conflict);
    expect(conflictEnr?.data.firstEnrichment?.type).toBe(EnrichmentType.PRDiff);
  });

  it('conflict data identifies commit as the second (losing) enrichment', () => {
    const conflictEnr = vc.finalLines
      .flatMap(l => l.enrichments)
      .find(e => e.type === EnrichmentType.Conflict);
    expect(conflictEnr?.data.secondEnrichment?.type).toBe(EnrichmentType.Commit);
  });
});

// ---------------------------------------------------------------------------
// PR beats edit on same line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: PR beats edit on same line', () => {
  const prHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+PR-gamma']);
  const editHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(prHunk), makeEditEnrichment(editHunk)]);

  it('detects a conflict', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('PR addition renders', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition is absent', () => {
    expect(vc.finalLines.find(l => l.content === 'edit-gamma')).toBeUndefined();
  });

  it('conflict names PR as the winner', () => {
    const conflictEnr = vc.finalLines
      .flatMap(l => l.enrichments)
      .find(e => e.type === EnrichmentType.Conflict);
    expect(conflictEnr?.data.firstEnrichment?.type).toBe(EnrichmentType.PRDiff);
  });
});

// ---------------------------------------------------------------------------
// Commit beats edit on same line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: commit beats edit on same line', () => {
  const commitHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+commit-gamma']);
  const editHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']);
  const vc = buildVirtualContent(CONTENT, [
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  it('detects a conflict', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('commit addition renders (winner)', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition is absent (loser)', () => {
    expect(vc.finalLines.find(l => l.content === 'edit-gamma')).toBeUndefined();
  });

  it('conflict names commit as the first (winning) enrichment', () => {
    const conflictEnr = vc.finalLines
      .flatMap(l => l.enrichments)
      .find(e => e.type === EnrichmentType.Conflict);
    expect(conflictEnr?.data.firstEnrichment?.type).toBe(EnrichmentType.Commit);
  });

  it('conflict names edit as the second (losing) enrichment', () => {
    const conflictEnr = vc.finalLines
      .flatMap(l => l.enrichments)
      .find(e => e.type === EnrichmentType.Conflict);
    expect(conflictEnr?.data.secondEnrichment?.type).toBe(EnrichmentType.Edit);
  });
});

// ---------------------------------------------------------------------------
// Three-way conflict: PR, commit, and edit all modify the same line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: three-way on same line', () => {
  const prHunk = makeHunk(2, 1, 2, 1, ['-beta', '+PR-beta']);
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const editHunk = makeHunk(2, 1, 2, 1, ['-beta', '+edit-beta']);
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  it('has conflicts', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('generates two conflict enrichments (commit vs PR, edit vs PR)', () => {
    expect(vc.stats.conflictCount).toBe(2);
  });

  it('only PR addition renders', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-beta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commit addition is absent', () => {
    expect(vc.finalLines.find(l => l.content === 'commit-beta')).toBeUndefined();
  });

  it('edit addition is absent', () => {
    expect(vc.finalLines.find(l => l.content === 'edit-beta')).toBeUndefined();
  });

  it('both conflict enrichments are attached to the anchor line', () => {
    const conflicts = vc.finalLines
      .flatMap(l => l.enrichments)
      .filter(e => e.type === EnrichmentType.Conflict);
    expect(conflicts).toHaveLength(2);
  });

  it('conflictLines set contains line 2', () => {
    expect(vc.conflictLines.has(2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partial conflict: only overlapping hunks are blocked; clean hunks render
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: only overlapping hunk is blocked', () => {
  // Commit replaces line 1.
  // Edit session (same ID) has hunk at line 1 (conflict) and hunk at line 3 (clean).
  const commitHunk = makeCommitEnrichment(makeHunk(1, 1, 1, 1, ['-alpha', '+commit-alpha']));
  const editLine1 = makeEditEnrichment(makeHunk(1, 1, 1, 1, ['-alpha', '+edit-alpha']), 'sess-X');
  const editLine3 = makeEditEnrichment(makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']), 'sess-X');
  const vc = buildVirtualContent(CONTENT, [commitHunk, editLine1, editLine3]);

  it('the two edit enrichments are merged into a single edit layer', () => {
    const editLayers = vc.layers.filter(l => l.enrichment?.type === EnrichmentType.Edit);
    expect(editLayers).toHaveLength(1);
  });

  it('exactly 1 conflict (line 1)', () => {
    expect(vc.stats.conflictCount).toBe(1);
  });

  it('commit addition at line 1 renders', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition at line 1 is absent (blocked by conflict)', () => {
    expect(vc.finalLines.find(l => l.content === 'edit-alpha')).toBeUndefined();
  });

  it('edit addition at line 3 renders (no conflict on that line)', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('conflict is anchored at line 1', () => {
    expect(vc.conflictLines.has(1)).toBe(true);
  });

  it('line 3 is not in conflictLines', () => {
    expect(vc.conflictLines.has(3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Conflict on multi-line hunk range: any overlap blocks the whole hunk
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: multi-line hunk overlap', () => {
  // Commit modifies lines 2-3 (beta + gamma).
  // Edit modifies only line 3. Overlap on line 3 → edit hunk is blocked.
  const commitHunk = makeHunk(2, 2, 2, 2, ['-beta', '+commit-beta', '-gamma', '+commit-gamma']);
  const editHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']);
  const vc = buildVirtualContent(CONTENT, [
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  it('detects a conflict', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('commit additions render', () => {
    const adds = vc.finalLines.filter(l => l.diffType === DiffType.Addition).map(l => l.content);
    expect(adds).toContain('commit-beta');
    expect(adds).toContain('commit-gamma');
  });

  it('edit addition for line 3 is absent (line 3 is inside commit range)', () => {
    expect(vc.finalLines.find(l => l.content === 'edit-gamma')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// No conflict when enrichments touch adjacent but non-overlapping lines
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: adjacent hunks do not conflict', () => {
  // Commit modifies line 2 only; edit modifies line 3 only. No shared lines.
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const editHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']);
  const vc = buildVirtualContent(CONTENT, [
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('both additions render', () => {
    const add1 = vc.finalLines.find(l => l.content === 'commit-beta');
    const add2 = vc.finalLines.find(l => l.content === 'edit-gamma');
    expect(add1?.diffType).toBe(DiffType.Addition);
    expect(add2?.diffType).toBe(DiffType.Addition);
  });
});

// ---------------------------------------------------------------------------
// Three-way conflict: validate per-conflict enrichment data
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: three-way data structure per conflict', () => {
  // Priority order: PR (layer 1), COMMIT (layer 2), EDIT (layer 3).
  // PR claims line 2 first.  Commit is blocked → conflict-1 (PR vs commit).
  // Edit is also blocked  → conflict-2 (PR vs edit).
  const prHunk = makeHunk(2, 1, 2, 1, ['-beta', '+PR-beta']);
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const editHunk = makeHunk(2, 1, 2, 1, ['-beta', '+edit-beta']);
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  const conflicts = vc.finalLines
    .flatMap(l => l.enrichments)
    .filter(e => e.type === EnrichmentType.Conflict);

  it('exactly two conflict enrichments are generated', () => {
    expect(conflicts).toHaveLength(2);
  });

  it('first conflict names PR as the winner', () => {
    expect(conflicts[0].data.firstEnrichment?.type).toBe(EnrichmentType.PRDiff);
  });

  it('first conflict names commit as the loser', () => {
    expect(conflicts[0].data.secondEnrichment?.type).toBe(EnrichmentType.Commit);
  });

  it('second conflict names PR as the winner', () => {
    expect(conflicts[1].data.firstEnrichment?.type).toBe(EnrichmentType.PRDiff);
  });

  it('second conflict names edit as the loser', () => {
    expect(conflicts[1].data.secondEnrichment?.type).toBe(EnrichmentType.Edit);
  });

  it('each conflict carries the hunk that caused it', () => {
    expect(conflicts[0].data.hunk).toBeDefined();
    expect(conflicts[1].data.hunk).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Multi-line hunk conflict: lineStart and lineEnd in the generated conflict
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — conflict: multi-line hunk lineEnd in conflict enrichment', () => {
  // Commit covers lines 2–3 (old_count = 2).
  // Edit also covers lines 2–3. Commit claims the range first; edit is blocked.
  const commitHunk = makeHunk(2, 2, 2, 2, ['-beta', '+commit-beta', '-gamma', '+commit-gamma']);
  const editHunk = makeHunk(2, 2, 2, 2, ['-beta', '+edit-beta', '-gamma', '+edit-gamma']);
  const vc = buildVirtualContent(CONTENT, [
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  const conflictEnr = vc.finalLines
    .flatMap(l => l.enrichments)
    .find(e => e.type === EnrichmentType.Conflict);

  it('conflict is detected', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('conflict enrichment lineStart is 2', () => {
    expect(conflictEnr?.lineStart).toBe(2);
  });

  it('conflict enrichment lineEnd is 3 (old_start + old_count - 1)', () => {
    expect(conflictEnr?.lineEnd).toBe(3);
  });

  it('commit additions render (both lines)', () => {
    const adds = vc.finalLines.filter(l => l.diffType === DiffType.Addition).map(l => l.content);
    expect(adds).toContain('commit-beta');
    expect(adds).toContain('commit-gamma');
  });

  it('edit additions are absent', () => {
    expect(vc.finalLines.find(l => l.content === 'edit-beta')).toBeUndefined();
    expect(vc.finalLines.find(l => l.content === 'edit-gamma')).toBeUndefined();
  });

  it('conflictLines contains both overlapping line numbers', () => {
    expect(vc.conflictLines.has(2)).toBe(true);
  });
});
