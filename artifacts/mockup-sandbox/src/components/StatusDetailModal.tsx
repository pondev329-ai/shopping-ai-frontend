import React from 'react';
import { X, Layers, Activity } from 'lucide-react';
import { SessionStatusSummary } from '../types/session';
import { AppScene } from '../types/chat';
import { StatusPossibilityBoard } from './StatusPossibilityBoard';

interface StatusDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SessionStatusSummary;
  scene: AppScene;
  sessionTitle: string;
  onSelectCandidate?: (candidateTitle: string) => void;
}

export const StatusDetailModal: React.FC<StatusDetailModalProps> = ({
  isOpen,
  onClose,
  summary,
  scene,
  sessionTitle,
  onSelectCandidate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="status-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="status-detail-modal-card"
        className="w-full max-w-lg bg-stone-50 dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="px-4 py-3 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">現在のステータス・認識詳細</h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">{sessionTitle}</p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-status-detail-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* モーダル本文（詳細ボード） */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-white dark:bg-stone-800/80 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
            Shopping AIが現在把握している前提条件、献立候補、確定項目・未確定項目の一覧です。
            候補をタップして「この候補について相談する」こともできます。
          </p>

          <StatusPossibilityBoard
            summary={summary}
            scene={scene}
            onSelectCandidate={(title) => {
              if (onSelectCandidate) {
                onSelectCandidate(title);
                onClose();
              }
            }}
          />
        </div>

        {/* モーダルフッター */}
        <div className="p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 dark:bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-700 border dark:border-stone-700 transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
