'use client';

import React, { useCallback, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Check,
  FileText,
  FileType2,
  FileCode2,
  ClipboardCopy,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import { describePageSize, type PageSettings } from '@/lib/pageSize';
import {
  downloadBlob,
  exportDocument,
  type ExportFormat,
} from '@/lib/export';
import { cn } from '@/lib/utils';

export interface ExportMenuProps {
  editor: Editor;
  pageSettings: PageSettings;
  /** Base name for the downloaded file. */
  fileName: string;
}

type Status = 'idle' | 'working' | 'done' | 'error';

interface ExportTarget {
  format: ExportFormat;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const TARGETS: ExportTarget[] = [
  {
    format: 'pdf',
    label: 'PDF',
    hint: 'Selectable PDF, same pages as Word',
    icon: <FileText size={16} />,
  },
  {
    format: 'docx',
    label: 'Microsoft Word',
    hint: '.docx with native equations and tables',
    icon: <FileType2 size={16} />,
  },
  {
    format: 'google-docs',
    label: 'Google Docs',
    hint: 'HTML file for File → Import',
    icon: <FileCode2 size={16} />,
  },
  {
    format: 'copy-google-docs',
    label: 'Copy for Google Docs',
    hint: 'Paste straight into a Google Doc',
    icon: <ClipboardCopy size={16} />,
  },
];

/**
 * The export menu.
 *
 * Every format runs the same pipeline: the document is laid out with real,
 * content-aware page breaks and then written out, so the files match the
 * document.
 */
export function ExportMenu({ editor, pageSettings, fileName }: ExportMenuProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [pageCount, setPageCount] = useState<number | null>(null);

  const run = useCallback(
    async (format: ExportFormat) => {
      setStatus('working');
      setMessage('Preparing…');

      try {
        const result = await exportDocument({
          editor,
          pageSettings,
          format,
          fileName,
          onProgress: setMessage,
        });

        setPageCount(result.totalPages);

        if (result.blob) {
          downloadBlob(result.blob, result.fileName);
        }

        setStatus('done');
        setMessage(
          format === 'copy-google-docs'
            ? 'Copied — paste it into your Google Doc.'
            : `Exported ${result.totalPages} page${result.totalPages === 1 ? '' : 's'}.`,
        );
      } catch (error) {
        setStatus('error');
        setMessage(
          error instanceof Error ? error.message : 'The export failed.',
        );
      }
    },
    [editor, pageSettings, fileName],
  );

  return (
    <div className="w-[min(23rem,calc(100vw-1.5rem))] space-y-3 p-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">
          Export
        </div>
        <p className="mt-1 text-[10px] leading-tight text-[var(--fg-popover)] opacity-60">
          {describePageSize(pageSettings)} · page breaks are computed from the
          content and match the document.
        </p>
      </div>

      <div className="space-y-1.5">
        {TARGETS.map((target) => (
          <button
            key={target.format}
            type="button"
            disabled={status === 'working'}
            onClick={() => void run(target.format)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)] px-3 py-2 text-left transition-colors',
              'hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50',
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--bg-popover)] text-[var(--fg-popover)]">
              {target.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[var(--fg-popover)]">
                {target.label}
              </span>
              <span className="block text-[10px] leading-tight text-[var(--fg-popover)] opacity-60">
                {target.hint}
              </span>
            </span>
          </button>
        ))}
      </div>

      {status !== 'idle' && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-tight',
            status === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-[var(--bg-toolbar-hover)] text-[var(--fg-popover)]',
          )}
        >
          {status === 'working' && <Loader2 size={13} className="mt-px animate-spin" />}
          {status === 'done' && <Check size={13} className="mt-px text-green-600" />}
          {status === 'error' && <TriangleAlert size={13} className="mt-px" />}
          <span>{message}</span>
        </div>
      )}

      {pageCount !== null && status === 'idle' && (
        <p className="text-[10px] text-[var(--fg-popover)] opacity-60">
          Last export: {pageCount} page{pageCount === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
}
