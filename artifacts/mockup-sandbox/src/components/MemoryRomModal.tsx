import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  HardDrive,
  RefreshCw,
  Search,
  Copy,
  Check,
  Clock,
  FileText,
  MessageSquare,
  Sparkles,
  Camera,
  Share2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Layers,
  Filter,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  MemoryRomItem,
  MemoryRomCategory,
  MEMORY_ROM_CATEGORIES,
  ListMemoryRomResult,
} from '../types/memory';
import { ChatService } from '../services/chatService';

interface MemoryRomModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatService: ChatService;
  memoryConnectionId: string | null;
  activeSessionId?: string;
  activeSessionTitle?: string;
  onOpenConnectModal?: () => void;
}

export const MemoryRomModal: React.FC<MemoryRomModalProps> = ({
  isOpen,
  onClose,
  chatService,
  memoryConnectionId,
  activeSessionId,
  activeSessionTitle,
  onOpenConnectModal,
}) => {
  const [items, setItems] = useState<MemoryRomItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // フィルター状態
  const [selectedCategory, setSelectedCategory] = useState<MemoryRomCategory | 'all'>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'current'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // コピー・展開状態
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // 個別削除ステート
  const [itemToDelete, setItemToDelete] = useState<MemoryRomItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // 手動接続用（未接続時のフォールバック入力）
  const [manualConnectionId, setManualConnectionId] = useState('');

  // ROM一覧の取得関数
  const fetchRomList = useCallback(async () => {
    if (!chatService.listMemoryRom) {
      setError('ChatServiceに listMemoryRom が実装されていません');
      return;
    }

    const currentId =
      memoryConnectionId ||
      (chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null);

    if (!currentId) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res: ListMemoryRomResult = await chatService.listMemoryRom({
        connectionId: currentId,
      });

      if (res.success) {
        setItems(res.items);
        setLastFetchedAt(new Date());
      } else {
        setError(res.error || 'ROM一覧の取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '一覧取得中に通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [chatService, memoryConnectionId]);

  // モーダルオープン時に自動ロード
  useEffect(() => {
    if (isOpen && memoryConnectionId) {
      fetchRomList();
    }
  }, [isOpen, memoryConnectionId, fetchRomList]);

  // クリップボードコピー
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 手動接続ID適用
  const handleApplyManualId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualConnectionId.trim()) return;
    if (chatService.setMemoryConnectionId) {
      chatService.setMemoryConnectionId(manualConnectionId.trim());
      setManualConnectionId('');
    }
  };

  // 個別ROM削除実行
  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    if (!chatService.deleteMemoryRomItem) {
      setDeleteError('個別ROM削除機能が利用できません');
      return;
    }

    const currentId =
      memoryConnectionId ||
      (chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null);

    if (!currentId) {
      setDeleteError('Google Driveが未接続です。先にGoogleアカウントを接続してください。');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await chatService.deleteMemoryRomItem({
        connectionId: currentId,
        driveFileId: itemToDelete.drive_file_id,
        itemType: itemToDelete.item_type,
        sessionId: itemToDelete.session_id,
        fileName: itemToDelete.name,
      });

      if (res.success) {
        // 成功: 一覧から対象項目を除外
        setItems((prev) =>
          prev.filter(
            (i) =>
              i.id !== itemToDelete.id &&
              i.drive_file_id !== itemToDelete.drive_file_id
          )
        );
        setActionSuccessMessage(`「${itemToDelete.name}」を削除しました`);
        setTimeout(() => setActionSuccessMessage(null), 4000);
        setItemToDelete(null);
      } else {
        setDeleteError(res.error || 'ROMの削除に失敗しました');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '削除通信中にエラーが発生しました');
    } finally {
      setIsDeleting(false);
    }
  };

  // カテゴリ別カウント
  const categoryCounts = useMemo(() => {
    const counts: Record<MemoryRomCategory | 'all', number> = {
      all: items.length,
      session_rom: 0,
      conversation_record: 0,
      session_image: 0,
      shared_rom: 0,
      unknown: 0,
    };
    items.forEach((item) => {
      counts[item.item_type] = (counts[item.item_type] || 0) + 1;
    });
    return counts;
  }, [items]);

  // フィルタリング処理
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. カテゴリフィルター
      if (selectedCategory !== 'all' && item.item_type !== selectedCategory) {
        return false;
      }

      // 2. セッションフィルター
      if (sessionFilter === 'current' && activeSessionId) {
        // Shared ROMはセッション横断なので全セッション共通として表示
        if (item.item_type !== 'shared_rom' && item.session_id !== activeSessionId) {
          return false;
        }
      }

      // 3. 検索クエリ（名前、drive_file_id、session_id、raw_type）
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchFileId = item.drive_file_id.toLowerCase().includes(q);
        const matchSessionId = item.session_id ? item.session_id.toLowerCase().includes(q) : false;
        const matchRawType = item.raw_type ? item.raw_type.toLowerCase().includes(q) : false;
        if (!matchName && !matchFileId && !matchSessionId && !matchRawType) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedCategory, sessionFilter, activeSessionId, searchQuery]);

  if (!isOpen) return null;

  // 種別ごとのアイコン返却
  const renderCategoryIcon = (category: MemoryRomCategory, className = 'w-4 h-4') => {
    switch (category) {
      case 'session_rom':
        return <Sparkles className={`${className} text-indigo-600`} />;
      case 'conversation_record':
        return <MessageSquare className={`${className} text-sky-600`} />;
      case 'session_image':
        return <Camera className={`${className} text-amber-600`} />;
      case 'shared_rom':
        return <Share2 className={`${className} text-emerald-600`} />;
      case 'unknown':
      default:
        return <HelpCircle className={`${className} text-stone-500`} />;
    }
  };

  return (
    <div
      id="modal-memory-rom-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-memory-rom-container"
        className="w-full sm:max-w-2xl h-[90vh] max-h-[850px] bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================== */}
        {/* 1. Header                                  */}
        {/* ========================================== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-900/95 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 dark:bg-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-base leading-tight">
                  Google Drive 記憶（ROM）管理
                </h2>
                {memoryConnectionId ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    接続中
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
                    未接続
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                Google Drive上に保持されているROMデータの一覧と状態
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {memoryConnectionId && (
              <button
                type="button"
                id="btn-refresh-memory-rom"
                onClick={fetchRomList}
                disabled={isLoading}
                className="p-2 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-stone-800 disabled:opacity-40 rounded-full transition-colors cursor-pointer"
                title="Google Driveから最新一覧を再読み込み"
                aria-label="再読み込み"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              id="btn-close-memory-rom"
              onClick={onClose}
              className="p-2 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. Connection Info Bar                     */}
        {/* ========================================== */}
        <div className="px-5 py-2.5 bg-stone-100/70 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-300 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-stone-700 dark:text-stone-300 shrink-0">接続ID:</span>
            {memoryConnectionId ? (
              <div className="flex items-center gap-1.5 font-mono text-[11px] bg-white dark:bg-stone-900 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 truncate max-w-xs sm:max-w-md">
                <span className="truncate">{memoryConnectionId}</span>
                <button
                  type="button"
                  onClick={() => handleCopy('conn_id', memoryConnectionId)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 shrink-0 cursor-pointer"
                  title="接続IDをコピー"
                >
                  {copiedKey === 'conn_id' ? (
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ) : (
              <span className="text-stone-400 italic">未接続</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
            {lastFetchedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                取得: {lastFetchedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <span className="font-medium text-stone-700 dark:text-stone-300">合計: {items.length} 件</span>
          </div>
        </div>

        {/* ========================================== */}
        {/* 3. Main Content Area                       */}
        {/* ========================================== */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-stone-50/50 dark:bg-stone-950/40">
          {!memoryConnectionId ? (
            /* 未接続ステート */
            <div className="p-6 text-center space-y-4 max-w-md mx-auto my-auto">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 flex items-center justify-center mx-auto border border-stone-200 dark:border-stone-700">
                <HardDrive className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">
                  Google Drive Memory が未接続です
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  Google Drive を接続すると、Shopping AIがセッション実行時に参照・保存しているROMデータ（セッションROM、対話ログ、チラシデータなど）の一覧を確認できます。
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  id="btn-memory-rom-connect-oauth"
                  onClick={() => {
                    onClose();
                    onOpenConnectModal?.();
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>GoogleアカウントでMemoryを接続</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-stone-200 dark:border-stone-700" />
                  <span className="flex-shrink mx-2 text-[10px] text-stone-400 dark:text-stone-500">または接続IDを直接入力</span>
                  <div className="flex-grow border-t border-stone-200 dark:border-stone-700" />
                </div>

                <form onSubmit={handleApplyManualId} className="flex gap-2">
                  <input
                    type="text"
                    value={manualConnectionId}
                    onChange={(e) => setManualConnectionId(e.target.value)}
                    placeholder="memory_connection_id を貼り付け"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!manualConnectionId.trim()}
                    className="px-3 py-2 bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 dark:hover:bg-stone-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
                  >
                    適用
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* 接続済みステート */
            <div className="flex-1 flex flex-col">
              {/* 3.1 検索バー & フィルターバー */}
              <div className="p-3 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-2.5 shrink-0">
                {/* 検索入力 */}
                <div className="relative flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-1.5 text-xs">
                  <Search className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0 mr-2" />
                  <input
                    type="text"
                    id="input-search-memory-rom"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ファイル名、session_id、drive_file_id で検索..."
                    className="bg-transparent border-0 focus:outline-hidden text-xs text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 w-full"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* カテゴリ別タブ・フィルターチップ */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-2xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    すべて ({categoryCounts.all})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('session_rom')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                      selectedCategory === 'session_rom'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/60 dark:border-indigo-800'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Session ROM ({categoryCounts.session_rom})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('conversation_record')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                      selectedCategory === 'conversation_record'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200/60 dark:border-sky-800'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Conversation Record ({categoryCounts.conversation_record})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('session_image')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                      selectedCategory === 'session_image'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200/60 dark:border-amber-800'
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    <span>Session Image ({categoryCounts.session_image})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('shared_rom')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                      selectedCategory === 'shared_rom'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200/60 dark:border-emerald-800'
                    }`}
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Shared ROM ({categoryCounts.shared_rom})</span>
                  </button>

                  {categoryCounts.unknown > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('unknown')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                        selectedCategory === 'unknown'
                          ? 'bg-stone-700 dark:bg-stone-300 text-white dark:text-stone-900 shadow-2xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Unknown ({categoryCounts.unknown})</span>
                    </button>
                  )}
                </div>

                {/* セッションスコープ切り替え（現在のセッションのみ / すべて） */}
                {activeSessionId && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500 dark:text-stone-400">
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                      <span>絞り込み:</span>
                      <button
                        type="button"
                        onClick={() => setSessionFilter('all')}
                        className={`px-1.5 py-0.5 rounded cursor-pointer ${
                          sessionFilter === 'all'
                            ? 'font-semibold text-stone-800 dark:text-stone-100 bg-stone-200 dark:bg-stone-750'
                            : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                        }`}
                      >
                        全セッション
                      </button>
                      <span className="text-stone-300 dark:text-stone-600">|</span>
                      <button
                        type="button"
                        onClick={() => setSessionFilter('current')}
                        className={`px-1.5 py-0.5 rounded cursor-pointer truncate max-w-[200px] ${
                          sessionFilter === 'current'
                            ? 'font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80'
                            : 'text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-300'
                        }`}
                        title={`現在のアクティブセッション: ${activeSessionTitle || activeSessionId}`}
                      >
                        現在のセッション「{activeSessionTitle || '進行中'}」のみ
                      </button>
                    </div>
                    <span className="text-stone-400 dark:text-stone-500">表示中: {filteredItems.length} 件</span>
                  </div>
                )}
              </div>

              {/* 3.2 エラー表示 */}
              {error && (
                <div className="p-3 m-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    ROM一覧の取得エラー
                  </div>
                  <p className="text-[11px] leading-relaxed break-words">{error}</p>
                  <button
                    type="button"
                    onClick={fetchRomList}
                    className="mt-1 px-2 py-1 bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 rounded font-medium text-[11px] transition-colors cursor-pointer"
                  >
                    再試行
                  </button>
                </div>
              )}

              {/* 3.2.1 削除成功メッセージ表示 */}
              {actionSuccessMessage && (
                <div className="p-3 m-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium">{actionSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionSuccessMessage(null)}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 3.3 リスト表示エリア */}
              <div className="p-3 space-y-2.5 flex-1">
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 text-stone-400 dark:text-stone-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs">Google Drive上のROM一覧を照会しています...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-12 text-center space-y-2 text-stone-400 dark:text-stone-500">
                    <FileText className="w-8 h-8 mx-auto text-stone-300 dark:text-stone-600" />
                    <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
                      該当するROMデータは見つかりませんでした
                    </p>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 max-w-xs mx-auto">
                      セッション内で対話を行ったり、写真で相談したり、特売チラシを取り込むとGoogle Drive上にROMが蓄積されます。
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const meta = MEMORY_ROM_CATEGORIES[item.item_type] || MEMORY_ROM_CATEGORIES.unknown;
                    const isExpanded = expandedItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        id={`rom-item-${item.id}`}
                        className="bg-white dark:bg-stone-800/90 border border-stone-200 dark:border-stone-700 rounded-xl p-3 shadow-2xs hover:border-stone-300 dark:hover:border-stone-600 transition-all space-y-2"
                      >
                        {/* 上段: 種別バッジ & セッション削除スコープバッジ */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {/* 種別バッジ */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                            >
                              {renderCategoryIcon(item.item_type, 'w-3 h-3')}
                              <span>{meta.label}</span>
                            </span>

                            {/* 日本語補足 */}
                            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                              {meta.subtitle}
                            </span>
                          </div>

                          {/* セッション削除スコープ（固有 vs 共有） & 個別削除ボタン */}
                          <div className="flex items-center gap-1.5">
                            {meta.isSessionScoped ? (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                title={meta.scopeDescription}
                              >
                                {meta.scopeLabel}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                title={meta.scopeDescription}
                              >
                                {meta.scopeLabel}
                              </span>
                            )}

                            {/* 個別削除ボタン */}
                            <button
                              type="button"
                              id={`btn-delete-rom-${item.id}`}
                              onClick={() => {
                                setDeleteError(null);
                                setItemToDelete(item);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium text-stone-500 dark:text-stone-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border border-stone-200 dark:border-stone-700 hover:border-red-200 dark:hover:border-red-800 rounded-md transition-colors cursor-pointer active:scale-95 shrink-0"
                              title={`この記憶（${item.name}）を個別削除`}
                              aria-label={`この記憶（${item.name}）を個別削除`}
                            >
                              <Trash2 className="w-3 h-3 text-stone-400 hover:text-red-600" />
                              <span>削除</span>
                            </button>
                          </div>
                        </div>

                        {/* 中段: ファイル名 & 説明 */}
                        <div>
                          <div className="font-semibold text-stone-900 dark:text-stone-100 text-xs break-all leading-snug">
                            {item.name}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* 下段: メタデータ（session_id, drive_file_id, 更新日時, サイズ） */}
                        <div className="pt-1.5 border-t border-stone-100 dark:border-stone-700/60 flex flex-wrap items-center justify-between gap-y-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {/* session_id */}
                            {item.session_id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-stone-400 dark:text-stone-500 font-mono">session:</span>
                                <span
                                  className={`font-mono px-1 py-0.2 rounded border text-[10.5px] ${
                                    item.session_id === activeSessionId
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium'
                                      : 'bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                                  }`}
                                  title={item.session_id}
                                >
                                  {item.session_id.slice(0, 16)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(`sid_${item.id}`, item.session_id!)}
                                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                                  title="session_id をコピー"
                                >
                                  {copiedKey === `sid_${item.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-stone-400 dark:text-stone-500 italic">全セッション共通</span>
                            )}

                            {/* drive_file_id */}
                            <div className="flex items-center gap-1 font-mono text-[10.5px]">
                              <span className="text-stone-400 dark:text-stone-500 font-sans">file_id:</span>
                              <span className="bg-stone-50 dark:bg-stone-900 px-1 py-0.2 rounded border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 truncate max-w-[120px]">
                                {item.drive_file_id}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(`fid_${item.id}`, item.drive_file_id)}
                                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                                title="drive_file_id をコピー"
                              >
                                {copiedKey === `fid_${item.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-stone-400 dark:text-stone-500 shrink-0">
                            {/* 更新日時 */}
                            {item.updated_at && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{item.updated_at}</span>
                              </span>
                            )}

                            {/* サイズ */}
                            {item.size !== undefined && (
                              <span className="text-stone-400 dark:text-stone-500">
                                {typeof item.size === 'number'
                                  ? `${Math.round(item.size / 1024)} KB`
                                  : item.size}
                              </span>
                            )}

                            {/* メタデータアコーディオン展開ボタン */}
                            <button
                              type="button"
                              onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                              className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 p-0.5 rounded cursor-pointer"
                              title="詳細メタデータを表示"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 展開時: 詳細メタデータ JSON ビューア */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-stone-100 dark:border-stone-700/60 animate-in fade-in duration-100">
                            <div className="bg-stone-50 dark:bg-stone-900 rounded-lg p-2 text-[11px] font-mono text-stone-700 dark:text-stone-300 overflow-x-auto border border-stone-200 dark:border-stone-700">
                              <pre className="whitespace-pre-wrap break-all leading-tight">
                                {JSON.stringify(item.metadata || item, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* 4. Footer Note (UX Principles)             */}
        {/* ========================================== */}
        <div className="px-5 py-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400 shrink-0 space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200">
            <HardDrive className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>記憶の整合性とライフサイクルについて</span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            Shopping AIではAIが勝手に記憶を削除することはありません。セッション管理からセッションを削除した場合、そのセッションに紐づく
            <strong className="text-stone-700 dark:text-stone-200 font-medium">「Session ROM」「Conversation Record」「Session Image」</strong>
            がGoogle Driveから安全に消去されます。チラシ等の
            <strong className="text-stone-700 dark:text-stone-200 font-medium">「Shared ROM」</strong>
            は全セッション共有データとしてそのまま保持されます。不要になった記憶は、各カードの「削除」ボタンから個別に安全に削除できます。
          </p>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5. 個別ROM削除確認ダイアログ (Confirmation Modal) */}
      {/* ========================================== */}
      {itemToDelete && (
        <div
          id="modal-delete-rom-confirmation"
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) {
              setDeleteError(null);
              setItemToDelete(null);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  記憶（ROM）の削除確認
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  Google Drive上のこの記憶データが削除されます。この操作は取り消せません。
                </p>
              </div>
            </div>

            {/* 対象アイテムの情報カード */}
            <div className="bg-stone-50 dark:bg-stone-800/90 rounded-xl p-3.5 border border-stone-200 dark:border-stone-700 space-y-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    (MEMORY_ROM_CATEGORIES[itemToDelete.item_type] || MEMORY_ROM_CATEGORIES.unknown).badgeBg
                  } ${
                    (MEMORY_ROM_CATEGORIES[itemToDelete.item_type] || MEMORY_ROM_CATEGORIES.unknown).badgeText
                  } ${
                    (MEMORY_ROM_CATEGORIES[itemToDelete.item_type] || MEMORY_ROM_CATEGORIES.unknown).badgeBorder
                  }`}
                >
                  {renderCategoryIcon(itemToDelete.item_type, 'w-3 h-3')}
                  <span>
                    {(MEMORY_ROM_CATEGORIES[itemToDelete.item_type] || MEMORY_ROM_CATEGORIES.unknown).label}
                  </span>
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                  {(MEMORY_ROM_CATEGORIES[itemToDelete.item_type] || MEMORY_ROM_CATEGORIES.unknown).subtitle}
                </span>
              </div>

              <div className="font-semibold text-stone-900 dark:text-stone-100 break-all text-xs">
                {itemToDelete.name}
              </div>

              <div className="space-y-1 pt-1.5 border-t border-stone-200/60 dark:border-stone-700/60 font-mono text-[11px] text-stone-600 dark:text-stone-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-400 dark:text-stone-500 font-sans shrink-0">file_id:</span>
                  <span className="truncate max-w-[240px] text-[10.5px] bg-white dark:bg-stone-900 px-1 py-0.5 rounded border border-stone-200 dark:border-stone-700">{itemToDelete.drive_file_id}</span>
                </div>
                {itemToDelete.session_id && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-stone-400 dark:text-stone-500 font-sans shrink-0">session_id:</span>
                    <span className="truncate max-w-[240px] text-[10.5px] bg-white dark:bg-stone-900 px-1 py-0.5 rounded border border-stone-200 dark:border-stone-700">{itemToDelete.session_id}</span>
                  </div>
                )}
              </div>

              {/* 削除スコープの説明 */}
              <div className="pt-1.5 text-[11px] border-t border-stone-200/60 dark:border-stone-700/60 leading-relaxed">
                {itemToDelete.item_type === 'shared_rom' ? (
                  <span className="text-emerald-700 dark:text-emerald-300">
                    ※この共有ROM（チラシやレシピ等）のみを削除します。他のセッションデータには影響しません。
                  </span>
                ) : (
                  <span className="text-stone-600 dark:text-stone-300">
                    ※この個別記憶のみを削除します。セッション内の他の記憶やセッション自体は保持されます。
                  </span>
                )}
              </div>
            </div>

            {/* エラー表示 */}
            {deleteError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>削除エラー</span>
                </div>
                <p className="text-[11px] leading-relaxed break-words">{deleteError}</p>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-rom"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError(null);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                id="btn-confirm-delete-rom"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>削除実行中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>削除を実行する</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
