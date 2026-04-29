/**
 * VirtualContentBuilder
 *
 * Builds layered virtual content from original file content + enrichments.
 * Each diff enrichment (PR, commit, edit) creates a new layer on top of the original.
 * Reference enrichments (comments) are overlaid on the final lines.
 * Ported from doclab's VirtualContentBuilder.
 */

import {
  DiffType,
  EnrichmentType,
  type DiffHunkRaw,
  type Enrichment,
  type EnrichmentPayload,
  type VirtualLine,
  type VirtualContentLayer,
  type LayeredVirtualContent,
} from '@/app/api/wikiTypes';

const DIFF_TYPES = new Set<string>([
  EnrichmentType.PRDiff,
  EnrichmentType.Edit,
  EnrichmentType.Commit,
]);

function isDiffType(type: string): boolean {
  return DIFF_TYPES.has(type);
}

type BuildOptions = {
  detectConflicts?: boolean;
  enrichmentOrder?: string[];
};

export class VirtualContentBuilder {
  private originalContent: string;
  private originalLines: string[];
  private enrichments: Enrichment[];
  private options: Required<BuildOptions>;
  private claimedRanges = new Map<number, Enrichment>();
  private generatedConflicts: Enrichment[] = [];
  private nextConflictId = 1;

  constructor(originalContent: string, enrichments: Enrichment[], options: BuildOptions = {}) {
    this.originalContent = originalContent;
    this.originalLines = originalContent.split('\n');
    this.enrichments = enrichments;
    this.options = {
      detectConflicts: options.detectConflicts ?? true,
      enrichmentOrder: options.enrichmentOrder ?? [
        EnrichmentType.PRDiff,
        EnrichmentType.Commit,
        EnrichmentType.Edit,
      ],
    };
  }

  build(): LayeredVirtualContent {
    const processed = this.mergeEditEnrichments(this.enrichments);
    const diffs = processed.filter((e) => isDiffType(e.type));
    const refs = processed.filter((e) => !isDiffType(e.type));
    const sorted = this.sortByPriority(diffs);

    const layers: VirtualContentLayer[] = [this.buildOriginalLayer()];
    let prev = layers[0];

    for (let i = 0; i < sorted.length; i++) {
      const layer = this.applyDiffEnrichment(prev, sorted[i], i + 1);
      layers.push(layer);
      prev = layer;
    }

    const finalLines = layers[layers.length - 1].lines;
    this.applyReferenceEnrichments(finalLines, [...refs, ...this.generatedConflicts]);

    const enrichmentsByType = new Map<string, Enrichment[]>();
    processed.forEach((e) => {
      const list = enrichmentsByType.get(e.type) ?? [];
      list.push(e);
      enrichmentsByType.set(e.type, list);
    });

    return {
      originalContent: this.originalContent,
      originalLines: this.originalLines,
      layers,
      finalLines,
      enrichments: this.enrichments,
      enrichmentsByType,
      hasConflicts: this.generatedConflicts.length > 0,
      conflictLines: new Set(this.generatedConflicts.map((c) => c.lineStart)),
      stats: {
        totalLayers: layers.length,
        totalLines: finalLines.length,
        insertedLines: finalLines.filter((l) => l.isInsertedLine).length,
        conflictCount: this.generatedConflicts.length,
      },
    };
  }

  private buildOriginalLayer(): VirtualContentLayer {
    const lines: VirtualLine[] = this.originalLines.map((content, idx) => ({
      lineNumber: idx + 1,
      virtualLineNumber: idx + 1,
      content,
      enrichments: [],
      isOriginalLine: true,
      isInsertedLine: false,
      layerIndex: 0,
    }));
    return { layerIndex: 0, lines };
  }

  private getHunks(data: EnrichmentPayload): DiffHunkRaw[] {
    if (data.current_hunk) return [data.current_hunk];
    return data.diff_hunks ?? [];
  }

  private applyDiffEnrichment(
    previousLayer: VirtualContentLayer,
    enrichment: Enrichment,
    layerIndex: number,
  ): VirtualContentLayer {
    const diffHunks = this.getHunks(enrichment.data);

    if (diffHunks.length === 0) {
      return {
        layerIndex,
        enrichment,
        lines: previousLayer.lines.map((l) => ({ ...l, layerIndex })),
      };
    }

    const approved: DiffHunkRaw[] = [];
    for (const hunk of diffHunks) {
      const conflicting = this.checkConflict(hunk);
      if (conflicting) {
        this.generatedConflicts.push(this.createConflict(conflicting, enrichment, hunk));
      } else {
        this.claimRange(hunk, enrichment);
        approved.push(hunk);
      }
    }
    approved.sort((a, b) => a.old_start - b.old_start);

    const newLines: VirtualLine[] = [];
    let vNum = 1;
    let pIdx = 0;

    for (const hunk of approved) {
      while (pIdx < previousLayer.lines.length) {
        const pl = previousLayer.lines[pIdx];
        if (pl.isOriginalLine && pl.lineNumber >= hunk.old_start) break;
        newLines.push({ ...pl, layerIndex, virtualLineNumber: vNum++, previousLayerLine: pl.virtualLineNumber });
        pIdx++;
      }

      let hunkOrigLine = hunk.old_start;
      let isFirst = true;

      for (const raw of hunk.lines) {
        const prefix = raw[0];
        const content = raw.slice(1);

        if (prefix === ' ') {
          isFirst = true;
          if (pIdx < previousLayer.lines.length) {
            const pl = previousLayer.lines[pIdx];
            newLines.push({ ...pl, layerIndex, virtualLineNumber: vNum++, previousLayerLine: pl.virtualLineNumber });
            pIdx++;
          }
          hunkOrigLine++;
        } else if (prefix === '-') {
          newLines.push({
            lineNumber: hunkOrigLine,
            virtualLineNumber: vNum++,
            content,
            enrichments: [],
            sourceEnrichment: enrichment,
            isOriginalLine: false,
            isInsertedLine: true,
            diffType: DiffType.Deletion,
            isFirstInDiffGroup: isFirst,
            layerIndex,
            ...this.getMeta(enrichment),
          });
          isFirst = false;
          pIdx++;
          hunkOrigLine++;
        } else if (prefix === '+') {
          newLines.push({
            lineNumber: hunkOrigLine,
            virtualLineNumber: vNum++,
            content,
            enrichments: [],
            sourceEnrichment: enrichment,
            isOriginalLine: false,
            isInsertedLine: true,
            diffType: DiffType.Addition,
            isFirstInDiffGroup: isFirst,
            layerIndex,
            ...this.getMeta(enrichment),
          });
          isFirst = false;
        }
      }
    }

    while (pIdx < previousLayer.lines.length) {
      const pl = previousLayer.lines[pIdx];
      newLines.push({ ...pl, layerIndex, virtualLineNumber: vNum++, previousLayerLine: pl.virtualLineNumber });
      pIdx++;
    }

    return { layerIndex, enrichment, lines: newLines };
  }

  private getMeta(enrichment: Enrichment): Partial<VirtualLine> {
    const d = enrichment.data;
    if (enrichment.type === EnrichmentType.PRDiff) {
      return { prNumber: d.pr_number as number, prTitle: d.pr_title as string };
    }
    if (enrichment.type === EnrichmentType.Commit) {
      return { commitSha: d.commit_sha as string };
    }
    if (enrichment.type === EnrichmentType.Edit) {
      return { editId: d.id as string };
    }
    return {};
  }

  private applyReferenceEnrichments(finalLines: VirtualLine[], refs: Enrichment[]): void {
    refs.forEach((e) => {
      for (let ln = e.lineStart; ln <= e.lineEnd; ln++) {
        const line = finalLines.find((l) => l.lineNumber === ln);
        if (line) line.enrichments.push(e);
      }
    });
  }

  private changedOriginals(hunk: DiffHunkRaw): number[] {
    const changed: number[] = [];
    let oldLine = hunk.old_start;
    for (const line of hunk.lines) {
      if (line.startsWith('-')) {
        changed.push(oldLine);
        oldLine++;
      } else if (!line.startsWith('+')) {
        oldLine++;
      }
    }
    return changed;
  }

  private checkConflict(hunk: DiffHunkRaw): Enrichment | null {
    for (const ln of this.changedOriginals(hunk)) {
      const existing = this.claimedRanges.get(ln);
      if (existing) return existing;
    }
    return null;
  }

  private claimRange(hunk: DiffHunkRaw, enrichment: Enrichment): void {
    for (const ln of this.changedOriginals(hunk)) {
      this.claimedRanges.set(ln, enrichment);
    }
  }

  private createConflict(first: Enrichment, second: Enrichment, hunk: DiffHunkRaw): Enrichment {
    const changed = this.changedOriginals(hunk);
    return {
      id: `conflict-${this.nextConflictId++}`,
      type: EnrichmentType.Conflict,
      lineStart: changed.length > 0 ? changed[0] : hunk.old_start,
      lineEnd: changed.length > 0 ? changed[changed.length - 1] : hunk.old_start,
      data: { firstEnrichment: first, secondEnrichment: second, hunk },
    };
  }

  private mergeEditEnrichments(enrichments: Enrichment[]): Enrichment[] {
    const edits = enrichments.filter((e) => e.type === EnrichmentType.Edit);
    if (edits.length <= 1) return enrichments;

    const nonEdits = enrichments.filter((e) => e.type !== EnrichmentType.Edit);
    const bySession = new Map<string, Enrichment[]>();
    for (const e of edits) {
      const sid = (e.data.id as string) ?? e.id;
      const list = bySession.get(sid) ?? [];
      list.push(e);
      bySession.set(sid, list);
    }

    const merged: Enrichment[] = [];
    for (const group of bySession.values()) {
      if (group.length === 1) {
        merged.push(group[0]);
        continue;
      }
      const allHunks: DiffHunkRaw[] = group
        .flatMap((e) => this.getHunks(e.data))
        .sort((a, b) => a.old_start - b.old_start);

      merged.push({
        ...group[0],
        lineStart: Math.min(...group.map((e) => e.lineStart)),
        lineEnd: Math.max(...group.map((e) => e.lineEnd)),
        data: { ...group[0].data, diff_hunks: allHunks, current_hunk: undefined },
      });
    }
    return [...nonEdits, ...merged];
  }

  private sortByPriority(enrichments: Enrichment[]): Enrichment[] {
    const order = this.options.enrichmentOrder;
    return [...enrichments].sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }
}
