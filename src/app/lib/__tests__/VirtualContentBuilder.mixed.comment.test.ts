/**
 * Unit tests — comment enrichments interacting with diff enrichments.
 *
 * Covers how COMMENT (reference) enrichments coexist with EDIT, COMMIT, and PR
 * diff layers. Key questions: does a comment survive layer composition? Does it
 * attach to the right virtual line when the original line has been diffed?
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

const LINES = ['alpha', 'beta', 'gamma', 'delta'];
const CONTENT = makeContent(LINES);

// ---------------------------------------------------------------------------
// Comment on a line replaced by an edit
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: comment on edit-replaced line', () => {
  // Edit replaces "beta" (line 2) with "new-beta".
  // Comment is also on line 2.
  // applyReferenceEnrichments finds the first finalLine with lineNumber === 2,
  // which will be the DELETION diff line after the edit is applied.
  const hunk = makeHunk(2, 1, 2, 1, ['-beta', '+new-beta']);
  const comment = makeCommentEnrichment(2, 2, 'c-on-replaced');
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk), comment]);

  it('edit produces its deletion and addition', () => {
    const del = vc.finalLines.find(l => l.content === 'beta' && l.diffType === DiffType.Deletion);
    expect(del).toBeDefined();
  });

  it('comment is attached to the deletion line (first line with lineNumber 2)', () => {
    const del = vc.finalLines.find(l => l.content === 'beta' && l.diffType === DiffType.Deletion);
    expect(del?.enrichments.some(e => e.id === 'c-on-replaced')).toBe(true);
  });

  it('no conflict is generated between comment and edit', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('comment does not prevent the edit from rendering', () => {
    const add = vc.finalLines.find(l => l.content === 'new-beta');
    expect(add?.diffType).toBe(DiffType.Addition);
  });
});

// ---------------------------------------------------------------------------
// Comment on an unmodified line alongside an edit on a different line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: comment on unmodified line, edit elsewhere', () => {
  // Edit replaces line 1; comment is on line 3 (untouched by edit).
  const hunk = makeHunk(1, 1, 1, 1, ['-alpha', '+ALPHA']);
  const comment = makeCommentEnrichment(3, 3, 'c-unmodified');
  const vc = buildVirtualContent(CONTENT, [makeEditEnrichment(hunk), comment]);

  it('comment is attached to the original line 3', () => {
    const line = vc.finalLines.find(l => l.lineNumber === 3 && l.isOriginalLine);
    expect(line?.enrichments.some(e => e.id === 'c-unmodified')).toBe(true);
  });

  it('edit addition is still present', () => {
    const add = vc.finalLines.find(l => l.content === 'ALPHA');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('comment does not interfere with edit layer', () => {
    expect(vc.layers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Comment on a line added by a commit (insertion line)
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: comment on commit-inserted line', () => {
  // Commit inserts "commit-new" after "beta" (line 2) using context.
  // The inserted line has lineNumber = 2 (same as context line beta).
  // Comment on line 2 → attaches to the first line with lineNumber 2 in finalLines.
  const hunk = makeHunk(2, 1, 2, 2, [' beta', '+commit-new']);
  const comment = makeCommentEnrichment(2, 2, 'c-on-insert');
  const vc = buildVirtualContent(CONTENT, [makeCommitEnrichment(hunk), comment]);

  it('commit insertion is present', () => {
    const add = vc.finalLines.find(l => l.content === 'commit-new');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('comment attaches to the first line with lineNumber 2 (the original "beta" line)', () => {
    const betaLine = vc.finalLines.find(l => l.content === 'beta' && l.isOriginalLine);
    expect(betaLine?.enrichments.some(e => e.id === 'c-on-insert')).toBe(true);
  });

  it('no conflicts between comment and commit', () => {
    expect(vc.hasConflicts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Comment and conflict enrichment coexist on the same line
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: comment and conflict on same line', () => {
  // PR and edit both modify line 2 → conflict generated at line 2.
  // Comment is also on line 2.
  const prHunk = makeHunk(2, 1, 2, 1, ['-beta', '+PR-beta']);
  const editHunk = makeHunk(2, 1, 2, 1, ['-beta', '+edit-beta']);
  const comment = makeCommentEnrichment(2, 2, 'c-conflict-line');
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeEditEnrichment(editHunk),
    comment,
  ]);

  it('conflict is detected', () => {
    expect(vc.hasConflicts).toBe(true);
  });

  it('the anchor line has a conflict enrichment', () => {
    const conflictLine = vc.finalLines.find(l =>
      l.enrichments.some(e => e.type === EnrichmentType.Conflict)
    );
    expect(conflictLine).toBeDefined();
  });

  it('the same anchor line also has the comment enrichment', () => {
    const conflictLine = vc.finalLines.find(l =>
      l.enrichments.some(e => e.type === EnrichmentType.Conflict)
    );
    expect(conflictLine?.enrichments.some(e => e.id === 'c-conflict-line')).toBe(true);
  });

  it('anchor line carries both enrichment types', () => {
    const conflictLine = vc.finalLines.find(l =>
      l.enrichments.some(e => e.type === EnrichmentType.Conflict)
    );
    const types = conflictLine?.enrichments.map(e => e.type) ?? [];
    expect(types).toContain(EnrichmentType.Conflict);
    expect(types).toContain(EnrichmentType.Comment);
  });
});

// ---------------------------------------------------------------------------
// Comment spanning a range that overlaps two diff enrichments
// ---------------------------------------------------------------------------

describe('VirtualContentBuilder — mixed: multi-line comment spanning two diff regions', () => {
  // PR modifies line 1; edit modifies line 3; comment spans lines 1–3.
  const prHunk = makeHunk(1, 1, 1, 1, ['-alpha', '+PR-alpha']);
  const editHunk = makeHunk(3, 1, 3, 1, ['-gamma', '+edit-gamma']);
  const comment = makeCommentEnrichment(1, 3, 'c-span');
  const vc = buildVirtualContent(CONTENT, [
    makePREnrichment(prHunk),
    makeEditEnrichment(editHunk),
    comment,
  ]);

  it('no conflict between comment and diff enrichments', () => {
    expect(vc.hasConflicts).toBe(false);
  });

  it('comment attaches to lines 1, 2, and 3', () => {
    const withComment = vc.finalLines.filter(l => l.enrichments.some(e => e.id === 'c-span'));
    expect(withComment.length).toBeGreaterThanOrEqual(3);
  });

  it('PR addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'PR-alpha');
    expect(add?.diffType).toBe(DiffType.Addition);
  });

  it('edit addition is present', () => {
    const add = vc.finalLines.find(l => l.content === 'edit-gamma');
    expect(add?.diffType).toBe(DiffType.Addition);
  });
});
