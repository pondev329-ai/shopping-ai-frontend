import React, { useState } from 'react';
import {
  X,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Edit2,
  Check,
  AlertTriangle,
  Loader2,
  HardDrive,
  ChevronRight,
} from 'lucide-react';
import { ShoppingSession } from '../types/session';

interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ShoppingSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (customTitle?: string) => void;
  onDeleteSession: (sessionId: string) => Promise<{ success: boolean; error?: string }> | void;
  onUpdateSessionStatus: (sessionId: string, status: 'in_progress' | 'completed') => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onOpenMemoryRom?: () => void;
}

export const SessionDrawer: React.FC<SessionDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onUpdateSessionStatus,
  onRenameSession,
  onOpenMemoryRom,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ShoppingSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartRename = (session: ShoppingSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      onRenameSession(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  const activeSessions = sessions.filter((s) => s.status === 'in_progress');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  return (
    <div
      id="modal-session-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="session-drawer-panel"
        className="w-full sm:max-w-lg max-h-[90vh] bg-white rounded-t-3xl sm:rounded-2xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900 leading-tight">セッション管理</h2>
              <p className="text-xs text-stone-500">食事・買い物の検討単位を切り替え</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-session-drawer"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition-colors cursor-pointer"
            aria-label="セッション画面を閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button: Create New Session */}
        <div className="p-4 border-b border-stone-100 bg-white shrink-0">
          <button
            type="button"
            id="btn-create-new-session"
            onClick={() => {
              onCreateSession();
              onClose();
            }}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>＋ 新しいセッションを開始</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. 進行中のセッション */}
          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              進行中のセッション ({activeSessions.length})
            </h3>
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <SessionItemCard
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  isEditing={editingSessionId === session.id}
                  editingTitle={editingTitle}
                  onEditTitleChange={setEditingTitle}
                  onStartRename={() => handleStartRename(session)}
                  onSaveRename={() => handleSaveRename(session.id)}
                  onSelect={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                  onToggleStatus={() => onUpdateSessionStatus(session.id, 'completed')}
                  onRequestDelete={() => {
                    setDeleteError(null);
                    setSessionToDelete(session);
                  }}
                />
              ))}
            </div>
          </div>

          {/* 2. 完了・過去のセッション */}
          {completedSessions.length > 0 && (
            <div className="pt-2 border-t border-stone-100">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
                完了・過去のセッション ({completedSessions.length})
              </h3>
              <div className="space-y-2">
                {completedSessions.map((session) => (
                  <SessionItemCard
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    isEditing={editingSessionId === session.id}
                    editingTitle={editingTitle}
                    onEditTitleChange={setEditingTitle}
                    onStartRename={() => handleStartRename(session)}
                    onSaveRename={() => handleSaveRename(session.id)}
                    onSelect={() => {
                      onSelectSession(session.id);
                      onClose();
                    }}
                    onToggleStatus={() => onUpdateSessionStatus(session.id, 'in_progress')}
                    onRequestDelete={() => {
                      setDeleteError(null);
                      setSessionToDelete(session);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Google Drive Memory ROM 管理へのリンク */}
        {onOpenMemoryRom && (
          <div className="px-5 py-2.5 bg-stone-100/70 border-t border-stone-200 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-stone-600 font-medium flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-stone-500" />
              <span>Google Drive 記憶（ROM）</span>
            </div>
            <button
              type="button"
              id="btn-drawer-open-memory-rom"
              onClick={() => {
                onClose();
                onOpenMemoryRom();
              }}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer hover:underline"
            >
              <span>記憶一覧を確認</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Footer Note */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 shrink-0">
          セッションを再開すると、当時の「状況・候補・可能性」の状態が復元されます。
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {sessionToDelete && (
        <div
          id="modal-delete-confirm-backdrop"
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => {
            if (!isDeleting) {
              setSessionToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            id="modal-delete-confirm-card"
            className="w-full max-w-sm bg-white rounded-2xl p-5 border border-stone-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 text-sm">セッションを削除しますか？</h4>
                <p className="text-xs text-rose-600 font-medium">この操作は元に戻せません</p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1">
              <div className="font-medium text-stone-800 truncate">「{sessionToDelete.title}」</div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                ※ このセッションの復元データ（Session Restore State）、対話記録（Conversation Record）、およびGoogle Drive Memory上のセッションROMデータが削除されます。（チラシ等の共有ROMは保持されます）
              </p>
            </div>

            {deleteError && (
              <div
                id="delete-session-error-banner"
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1 animate-in fade-in duration-150"
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  削除に失敗しました
                </div>
                <div className="text-[11px] text-rose-600 leading-relaxed break-words">{deleteError}</div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-cancel-delete-session"
                disabled={isDeleting}
                onClick={() => {
                  setSessionToDelete(null);
                  setDeleteError(null);
                }}
                className="flex-1 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                id="btn-confirm-delete-session"
                disabled={isDeleting}
                onClick={async () => {
                  if (!sessionToDelete || isDeleting) return;
                  setIsDeleting(true);
                  setDeleteError(null);
                  try {
                    const result = await onDeleteSession(sessionToDelete.id);
                    if (result && typeof result === 'object' && result.success === false) {
                      setDeleteError(result.error || 'セッション削除に失敗しました');
                    } else {
                      setSessionToDelete(null);
                    }
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : '通信エラーが発生しました');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? '削除中...' : 'セッションを削除'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SessionItemCardProps {
  session: ShoppingSession;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onEditTitleChange: (title: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onSelect: () => void;
  onToggleStatus: () => void;
  onRequestDelete: () => void;
}

const SessionItemCard: React.FC<SessionItemCardProps> = ({
  session,
  isActive,
  isEditing,
  editingTitle,
  onEditTitleChange,
  onStartRename,
  onSaveRename,
  onSelect,
  onToggleStatus,
  onRequestDelete,
}) => {
  const candidateCount = session.statusSummary.candidates.length;

  return (
    <div
      id={`session-card-${session.id}`}
      className={`p-3.5 rounded-xl border transition-all ${
        isActive
          ? 'bg-emerald-50/60 border-emerald-400 ring-1 ring-emerald-400/40 shadow-xs'
          : 'bg-white hover:bg-stone-50/90 border-stone-200 shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          {isEditing ? (
            <div className="flex items-center gap-1.5 mb-1">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => onEditTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveRename();
                  if (e.key === 'Escape') onSaveRename();
                }}
                className="text-xs font-semibold px-2 py-1 bg-white border border-emerald-500 rounded-md focus:outline-hidden w-full text-stone-900"
                autoFocus
              />
              <button
                type="button"
                onClick={onSaveRename}
                className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                title="保存"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="font-semibold text-stone-900 text-xs truncate">{session.title}</h4>
              <button
                type="button"
                onClick={onStartRename}
                className="p-0.5 text-stone-400 hover:text-stone-700 rounded cursor-pointer shrink-0"
                title="名前を変更"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Meta row (Date, Status badge, Candidates count) */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-stone-400" />
              {session.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-400" />
              {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {session.status === 'in_progress' ? (
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium text-[10px]">
                進行中
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-medium text-[10px]">
                完了
              </span>
            )}
            {candidateCount > 0 && (
              <span className="text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded text-[10px]">
                候補 {candidateCount}件
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            id={`btn-toggle-status-${session.id}`}
            onClick={onToggleStatus}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              session.status === 'completed'
                ? 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
            }`}
            title={session.status === 'completed' ? '進行中に戻す' : '完了にする'}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>

          {!isActive && (
            <button
              type="button"
              id={`btn-resume-session-${session.id}`}
              onClick={onSelect}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs active:scale-95"
              title="このセッションを再開する"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>再開</span>
            </button>
          )}

          {isActive && (
            <span className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium select-none shadow-2xs">
              選択中
            </span>
          )}

          <button
            type="button"
            id={`btn-delete-session-${session.id}`}
            onClick={onRequestDelete}
            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-0.5"
            title="セッションを削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
