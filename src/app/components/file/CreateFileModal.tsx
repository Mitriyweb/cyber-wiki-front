/**
 * CreateFileModal — GitHub-style "create new file in repo" dialog.
 *
 * The new file lives as a draft change with `change_type = create` until the
 * user commits it via the FileViewer or the Changes page. That keeps the
 * single review/commit pipeline — no special "create immediately" path.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import { FileText, Upload, X } from 'lucide-react';
import { saveDraft } from '@/app/actions/draftChangeActions';
import { EditChangeType, type Space } from '@/app/api';

interface CreateFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space;
  /** Optional folder path the new file should be created inside (no leading
   *  slash, no trailing slash). Defaults to the repo root. */
  initialFolder?: string;
  /** "create" lets the user type a filename and contents; "import" lets them
   *  upload one or more files from disk. Defaults to "create". */
  initialMode?: 'create' | 'import';
  /** Called once the new draft has been created. Receives the full file
   *  path *and* the freshly-minted draft id so the parent can wire the file
   *  viewer up immediately, without waiting for the drafts list to re-fetch.
   *  When importing several files, called once per file. */
  onCreated?: (filePath: string, draftId: string) => void;
}

interface PendingUpload {
  /** Path the file will be created at, relative to repo root. */
  path: string;
  /** Plaintext contents of the file (binary uploads are skipped). */
  content: string;
}

export function CreateFileModal({
  isOpen,
  onClose,
  space,
  initialFolder,
  initialMode = 'create',
  onCreated,
}: CreateFileModalProps) {
  const [mode, setMode] = useState<'create' | 'import'>(initialMode);
  const [folder, setFolder] = useState(initialFolder ?? '');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset on open so a stale value from a previous session doesn't carry over.
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFolder(initialFolder ?? '');
      setName('');
      setContent('');
      setUploads([]);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, initialFolder, initialMode]);

  // The full path that will be stored on the draft. Folder + name, normalized
  // — strip leading/trailing slashes on the folder, no leading slash overall.
  const filePath = useMemo(() => {
    const f = folder.replace(/^\/+|\/+$/g, '');
    const n = name.trim();
    if (!n) return '';
    return f ? `${f}/${n}` : n;
  }, [folder, name]);

  // Listen for the saved-event so we can navigate to the new file. In Import
  // mode we fire one saveDraft per file and only close after all are saved —
  // counters and the queued path list are held in refs so the closure doesn't
  // go stale. Each saved draft fires onCreated with its path + id.
  const expectedSavesRef = useRef(0);
  const completedSavesRef = useRef(0);
  /** Paths queued for save in submission order — first matches first saved. */
  const queuedPathsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const sub = eventBus.on('wiki/draft/saved', ({ changeId }) => {
      const path = queuedPathsRef.current.shift();
      if (path && changeId) onCreated?.(path, changeId);
      completedSavesRef.current += 1;
      if (completedSavesRef.current >= expectedSavesRef.current) {
        setSubmitting(false);
        onClose();
      }
    });
    const errSub = eventBus.on('wiki/draft/error', ({ error: msg }) => {
      setSubmitting(false);
      setError(msg);
    });
    return () => {
      sub.unsubscribe();
      errSub.unsubscribe();
    };
  }, [isOpen, onClose, onCreated]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      if (!filePath) return;
      setSubmitting(true);
      setError(null);
      expectedSavesRef.current = 1;
      completedSavesRef.current = 0;
      queuedPathsRef.current = [filePath];
      saveDraft({
        spaceId: space.id,
        filePath,
        originalContent: '',
        modifiedContent: content,
        changeType: EditChangeType.Create,
        description: `Create ${filePath}`,
      });
      return;
    }
    // Import mode — push one draft per uploaded file.
    if (uploads.length === 0) return;
    setSubmitting(true);
    setError(null);
    expectedSavesRef.current = uploads.length;
    completedSavesRef.current = 0;
    queuedPathsRef.current = uploads.map((u) => u.path);
    for (const u of uploads) {
      saveDraft({
        spaceId: space.id,
        filePath: u.path,
        originalContent: '',
        modifiedContent: u.content,
        changeType: EditChangeType.Create,
        description: `Import ${u.path}`,
      });
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = folder.replace(/^\/+|\/+$/g, '');
    const next: PendingUpload[] = [];
    setError(null);
    for (const file of Array.from(fileList)) {
      // We only handle text-ish files: drafts store strings, not binary.
      // Reject anything > 5 MB or that fails to decode as UTF-8.
      if (file.size > 5 * 1024 * 1024) {
        setError(`Skipped ${file.name} — file is larger than 5 MB`);
        continue;
      }
      try {
        const text = await file.text();
        const path = f ? `${f}/${file.name}` : file.name;
        next.push({ path, content: text });
      } catch {
        setError(`Skipped ${file.name} — could not read as text`);
      }
    }
    setUploads((prev) => [...prev, ...next]);
  };

  const submitDisabled =
    submitting || (mode === 'create' ? !filePath : uploads.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl mx-4 rounded-lg shadow-xl bg-card border border-border max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">Add file</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs — Create new file vs Import from disk. */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
              mode === 'create'
                ? 'border-primary text-foreground bg-accent/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText size={14} />
            Create new file
          </button>
          <button
            type="button"
            onClick={() => setMode('import')}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
              mode === 'import'
                ? 'border-primary text-foreground bg-accent/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload size={14} />
            Import files
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {mode === 'create' ? 'File location' : 'Destination folder'}
            </label>
            <div className="flex items-center gap-1 text-sm">
              <code className="px-2 py-2 rounded-md bg-muted text-muted-foreground border border-border">
                {space.slug}
              </code>
              <span className="text-muted-foreground">/</span>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="folder/subfolder (optional)"
                className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {mode === 'create' && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="filename.md"
                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </>
              )}
            </div>
            {mode === 'create' && filePath && (
              <p className="text-xs text-muted-foreground">
                Will be created at{' '}
                <code className="font-mono">{space.slug}/{filePath}</code>
              </p>
            )}
          </div>

          {mode === 'create' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                File contents
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Hello&#10;&#10;Start writing…"
                rows={12}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                spellCheck={false}
              />
            </div>
          )}

          {mode === 'import' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Files to import
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-md border-2 border-dashed border-border hover:border-primary hover:bg-accent/30 transition-colors text-center"
              >
                <Upload size={20} className="text-muted-foreground" />
                <p className="text-sm text-foreground">
                  Drop text files here, or click to choose
                </p>
                <p className="text-xs text-muted-foreground">
                  Up to 5 MB per file. Binary files are skipped.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    // Reset so the same file can be picked twice.
                    e.target.value = '';
                  }}
                />
              </div>

              {uploads.length > 0 && (
                <ul className="border border-border rounded-md divide-y divide-border bg-background">
                  {uploads.map((u, i) => (
                    <li
                      key={`${u.path}-${i}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                      <code className="flex-1 truncate text-foreground">{u.path}</code>
                      <span className="text-xs text-muted-foreground">
                        {u.content.length.toLocaleString()} chars
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setUploads((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="p-1 rounded text-muted-foreground hover:text-destructive"
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {mode === 'create' ? 'The file' : 'Each file'} is saved as a pending draft.
            To publish to the repo, commit from the file viewer or the{' '}
            <a href="#changes" className="underline hover:text-foreground">Changes page</a>.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting
                ? 'Saving…'
                : mode === 'create'
                  ? 'Create file'
                  : `Import ${uploads.length} file${uploads.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
