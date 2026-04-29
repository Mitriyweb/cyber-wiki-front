/**
 * Unit tests — mixed enrichment combinations in VirtualContentBuilder.
 *
 * Covers:
 *   - Multi-hunk edit session merging (same session ID → single layer)
 *   - PR + commit on different lines
 *   - Commit + edit on different lines
 *   - All three types (PR + commit + edit) on separate lines
 *   - Priority order verification
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
// Multi-hunk edit session: same session ID → one merged layer
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — edit: multi-hunk session merged into one layer', () => {
  // Two edit enrichments from the same session: hunk at line 1 and hunk at line 3.
  // VirtualContentBuilder must merge them into a single EDIT layer.
  const SESSION_ID = 'session-A';
  const hunk1 = makeHunk(1, 1, 1, 1, ['-alpha', '+ALPHA']);
  const hunk3 = makeHunk(3, 1, 3, 1, ['-gamma', '+GAMMA']);
  const vc = buildVirtualContent(CONTENT, [
    makeEditEnrichment(hunk1, SESSION_ID),
    makeEditEnrichment(hunk3, SESSION_ID),
  ]);

  it('creates exactly two layers (original + one merged edit layer)', () => {
    expect(vc.layers).toHaveLength(2);
  });

  it('no conflicts detected', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('edit at line 1 produces deletion of "alpha"', () => {
    const del = vc.finalLines.find(l => l.content === 'alpha' && l.diffType === DiffType.Deletion);
    expect(del).toBeDefined();
  });

  it('edit at line 1 produces addition "ALPHA"', () => {
    const add = vc.finalLines.find(l => l.content === 'ALPHA');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit at line 3 produces deletion of "gamma"', () => {
    const del = vc.finalLines.find(l => l.content === 'gamma' && l.diffType === DiffType.Deletion);
    expect(del).toBeDefined();
  });

  it('edit at line 3 produces addition "GAMMA"', () => {
    const add = vc.finalLines.find(l => l.content === 'GAMMA');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('all diff lines share the same session editId', () => {
    const editIds = [...new Set(vc.finalLines.filter(l => l.editId).map(l => l.editId))];
    expect(editIds).toHaveLength(1);
    expect(editIds[0]).toBe(SESSION_ID);
  });

  it('untouched original lines remain', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['beta', 'delta']);
  });
});

// ---------------------------------------------------------------------------
// PR + commit on different lines (no conflict)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: PR and commit on different lines', () => {
  // PR replaces line 1; Commit replaces line 3. No overlap.
  const prHunk = makeHunk(1, 1, 1, 1, ['-alpha', '+PR-alpha']);
  const commitHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+commit-gamma']);
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeCommitEnrichment(commitHunk),
  ]);

  it('creates three layers (original + PR + commit)', () => {
    expect(vc.layers).toHaveLength(3);
  });

  it('PR is applied before commit (higher priority)', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.PRDiff);
    expect(vc.layers[2].enrichment?.type).toBe(EnrichmentType.Commit);
  });

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('PR addition "PR-alpha" is present', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commit addition "commit-gamma" is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('"PR-alpha" carries prNumber', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-alpha');
    expect(add?.prNumber).toBe(42);
  });

  it('"commit-gamma" carries commitSha', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-gamma');
    expect(add?.commitSha).toBe('abc1234def');
  });

  it('untouched original lines remain', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['beta', 'delta']);
  });
});

// ---------------------------------------------------------------------------
// Commit + edit on different lines (no conflict)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: commit and edit on different lines', () => {
  // Commit replaces line 2; Edit replaces line 4. No overlap.
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const editHunk = makeHunk(4, 1, 4, 1, ['-delta', '+edit-delta']);
  const vc = buildVirtualContent(CONTENT, [
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  it('creates three layers (original + commit + edit)', () => {
    expect(vc.layers).toHaveLength(3);
  });

  it('commit is applied before edit (higher priority)', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.Commit);
    expect(vc.layers[2].enrichment?.type).toBe(EnrichmentType.Edit);
  });

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('commit addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-beta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-delta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });
});

// ---------------------------------------------------------------------------
// PR + edit on different lines (no conflict)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: PR and edit on different lines', () => {
  // PR replaces line 2; Edit replaces line 4. No overlap.
  const prHunk = makeHunk(2, 1, 2, 1, ['-beta', '+PR-beta']);
  const editHunk = makeHunk(4, 1, 4, 1, ['-delta', '+edit-delta']);
  const vc = buildVirtualContent(CONTENT, [makePREnrichment(prHunk), makeEditEnrichment(editHunk)]);

  it('creates three layers (original + PR + edit)', () => {
    expect(vc.layers).toHaveLength(3);
  });

  it('PR is applied before edit (higher priority)', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.PRDiff);
    expect(vc.layers[2].enrichment?.type).toBe(EnrichmentType.Edit);
  });

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('PR addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-beta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-delta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });
});

// ---------------------------------------------------------------------------
// All three types on separate lines — priority order verification
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: PR + commit + edit on separate lines', () => {
  // PR: line 1, Commit: line 2, Edit: line 4. No overlaps.
  const prHunk = makeHunk(1, 1, 1, 1, ['-alpha', '+PR-alpha']);
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const editHunk = makeHunk(4, 1, 4, 1, ['-delta', '+edit-delta']);
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeCommitEnrichment(commitHunk),
    makeEditEnrichment(editHunk),
  ]);

  it('creates four layers (original + PR + commit + edit)', () => {
    expect(vc.layers).toHaveLength(4);
  });

  it('layer order follows PR → commit → edit priority', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.PRDiff);
    expect(vc.layers[2].enrichment?.type).toBe(EnrichmentType.Commit);
    expect(vc.layers[3].enrichment?.type).toBe(EnrichmentType.Edit);
  });

  it('no conflicts', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('PR addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('commit addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-beta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-delta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('only untouched "gamma" remains as original', () => {
    const origContents = vc.finalLines.filter(l => l.isOriginalLine).map(l => l.content);
    expect(origContents).toEqual(['gamma']);
  });
});

// ---------------------------------------------------------------------------
// Submission order does not affect priority
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: enrichment order in input does not affect priority', () => {
  // Pass enrichments in reverse priority order (edit first, PR last).
  const prHunk = makeHunk(1, 1, 1, 1, ['-alpha', '+PR-alpha']);
  const commitHunk = makeHunk(2, 1, 2, 1, ['-beta', '+commit-beta']);
  const editHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']);
  const vc = buildVirtualContent(CONTENT, [
    makeEditEnrichment(editHunk),
    makeCommitEnrichment(commitHunk),
    makePREnrichment(prHunk),
  ]);

  it('PR is still layer 1 regardless of input order', () => {
    expect(vc.layers[1].enrichment?.type).toBe(EnrichmentType.PRDiff);
  });

  it('commit is still layer 2', () => {
    expect(vc.layers[2].enrichment?.type).toBe(EnrichmentType.Commit);
  });

  it('edit is still layer 3', () => {
    expect(vc.layers[3].enrichment?.type).toBe(EnrichmentType.Edit);
  });
});
