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
        className="w-full sm:max-w-2xl h-[90vh] max-h-[850px] bg-white rounded-t-3xl sm:rounded-2xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================== */}
        {/* 1. Header                                  */}
        {/* ========================================== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-2xs shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-stone-900 text-base leading-tight">
                  Google Drive 記憶（ROM）管理
                </h2>
                {memoryConnectionId ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    接続中
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-200 text-stone-700 shrink-0">
                    未接続
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 truncate mt-0.5">
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
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/70 disabled:opacity-40 rounded-full transition-colors cursor-pointer"
                title="Google Driveから最新一覧を再読み込み"
                aria-label="再読み込み"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            )}
            <button
              type="button"
              id="btn-close-memory-rom"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. Connection Info Bar                     */}
        {/* ========================================== */}
        <div className="px-5 py-2.5 bg-stone-100/70 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-stone-700 shrink-0">接続ID:</span>
            {memoryConnectionId ? (
              <div className="flex items-center gap-1.5 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-stone-200 truncate max-w-xs sm:max-w-md">
                <span className="truncate">{memoryConnectionId}</span>
                <button
                  type="button"
                  onClick={() => handleCopy('conn_id', memoryConnectionId)}
                  className="text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
                  title="接続IDをコピー"
                >
                  {copiedKey === 'conn_id' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ) : (
              <span className="text-stone-400 italic">未接続</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-stone-500">
            {lastFetchedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-stone-400" />
                取得: {lastFetchedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <span className="font-medium text-stone-700">合計: {items.length} 件</span>
          </div>
        </div>

        {/* ========================================== */}
        {/* 3. Main Content Area                       */}
        {/* ========================================== */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-stone-50/50">
          {!memoryConnectionId ? (
            /* 未接続ステート */
            <div className="p-6 text-center space-y-4 max-w-md mx-auto my-auto">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto border border-stone-200">
                <HardDrive className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-stone-800 text-sm">
                  Google Drive Memory が未接続です
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
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
                  <div className="flex-grow border-t border-stone-200" />
                  <span className="flex-shrink mx-2 text-[10px] text-stone-400">または接続IDを直接入力</span>
                  <div className="flex-grow border-t border-stone-200" />
                </div>

                <form onSubmit={handleApplyManualId} className="flex gap-2">
                  <input
                    type="text"
                    value={manualConnectionId}
                    onChange={(e) => setManualConnectionId(e.target.value)}
                    placeholder="memory_connection_id を貼り付け"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-stone-200 rounded-lg focus:outline-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!manualConnectionId.trim()}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
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
              <div className="p-3 border-b border-stone-200 bg-white space-y-2.5 shrink-0">
                {/* 検索入力 */}
                <div className="relative flex items-center bg-stone-100 rounded-xl px-3 py-1.5 text-xs">
                  <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    id="input-search-memory-rom"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ファイル名、session_id、drive_file_id で検索..."
                    className="bg-transparent border-0 focus:outline-hidden text-xs text-stone-800 placeholder:text-stone-400 w-full"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-stone-400 hover:text-stone-600 rounded-full cursor-pointer"
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
                        ? 'bg-stone-900 text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
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
                        : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/60'
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
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
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
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
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
                          ? 'bg-stone-700 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Unknown ({categoryCounts.unknown})</span>
                    </button>
                  )}
                </div>

                {/* セッションスコープ切り替え（現在のセッションのみ / すべて） */}
                {activeSessionId && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500">
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3 h-3 text-stone-400" />
                      <span>絞り込み:</span>
                      <button
                        type="button"
                        onClick={() => setSessionFilter('all')}
                        className={`px-1.5 py-0.5 rounded cursor-pointer ${
                          sessionFilter === 'all'
                            ? 'font-semibold text-stone-800 bg-stone-200'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        全セッション
                      </button>
                      <span className="text-stone-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSessionFilter('current')}
                        className={`px-1.5 py-0.5 rounded cursor-pointer truncate max-w-[200px] ${
                          sessionFilter === 'current'
                            ? 'font-semibold text-emerald-800 bg-emerald-100'
                            : 'text-stone-500 hover:text-emerald-700'
                        }`}
                        title={`現在のアクティブセッション: ${activeSessionTitle || activeSessionId}`}
                      >
                        現在のセッション「{activeSessionTitle || '進行中'}」のみ
                      </button>
                    </div>
                    <span className="text-stone-400">表示中: {filteredItems.length} 件</span>
                  </div>
                )}
              </div>

              {/* 3.2 エラー表示 */}
              {error && (
                <div className="p-3 m-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    ROM一覧の取得エラー
                  </div>
                  <p className="text-[11px] leading-relaxed break-words">{error}</p>
                  <button
                    type="button"
                    onClick={fetchRomList}
                    className="mt-1 px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-medium text-[11px] transition-colors cursor-pointer"
                  >
                    再試行
                  </button>
                </div>
              )}

              {/* 3.3 リスト表示エリア */}
              <div className="p-3 space-y-2.5 flex-1">
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                    <p className="text-xs">Google Drive上のROM一覧を照会しています...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-12 text-center space-y-2 text-stone-400">
                    <FileText className="w-8 h-8 mx-auto text-stone-300" />
                    <p className="text-xs font-medium text-stone-600">
                      該当するROMデータは見つかりませんでした
                    </p>
                    <p className="text-[11px] text-stone-400 max-w-xs mx-auto">
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
                        className="bg-white border border-stone-200 rounded-xl p-3 shadow-2xs hover:border-stone-300 transition-all space-y-2"
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
                            <span className="text-[11px] text-stone-500 font-medium">
                              {meta.subtitle}
                            </span>
                          </div>

                          {/* セッション削除スコープ（固有 vs 共有） */}
                          <div className="flex items-center gap-1">
                            {meta.isSessionScoped ? (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                                title={meta.scopeDescription}
                              >
                                {meta.scopeLabel}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                                title={meta.scopeDescription}
                              >
                                {meta.scopeLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 中段: ファイル名 & 説明 */}
                        <div>
                          <div className="font-semibold text-stone-900 text-xs break-all leading-snug">
                            {item.name}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* 下段: メタデータ（session_id, drive_file_id, 更新日時, サイズ） */}
                        <div className="pt-1.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-y-1.5 text-[11px] text-stone-500">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {/* session_id */}
                            {item.session_id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-stone-400 font-mono">session:</span>
                                <span
                                  className={`font-mono px-1 py-0.2 rounded border text-[10.5px] ${
                                    item.session_id === activeSessionId
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium'
                                      : 'bg-stone-50 text-stone-700 border-stone-200'
                                  }`}
                                  title={item.session_id}
                                >
                                  {item.session_id.slice(0, 16)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(`sid_${item.id}`, item.session_id!)}
                                  className="text-stone-400 hover:text-stone-700 cursor-pointer"
                                  title="session_id をコピー"
                                >
                                  {copiedKey === `sid_${item.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-stone-400 italic">全セッション共通</span>
                            )}

                            {/* drive_file_id */}
                            <div className="flex items-center gap-1 font-mono text-[10.5px]">
                              <span className="text-stone-400 font-sans">file_id:</span>
                              <span className="bg-stone-50 px-1 py-0.2 rounded border border-stone-200 text-stone-600 truncate max-w-[120px]">
                                {item.drive_file_id}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(`fid_${item.id}`, item.drive_file_id)}
                                className="text-stone-400 hover:text-stone-700 cursor-pointer"
                                title="drive_file_id をコピー"
                              >
                                {copiedKey === `fid_${item.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-stone-400 shrink-0">
                            {/* 更新日時 */}
                            {item.updated_at && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{item.updated_at}</span>
                              </span>
                            )}

                            {/* サイズ */}
                            {item.size !== undefined && (
                              <span className="text-stone-400">
                                {typeof item.size === 'number'
                                  ? `${Math.round(item.size / 1024)} KB`
                                  : item.size}
                              </span>
                            )}

                            {/* メタデータアコーディオン展開ボタン */}
                            <button
                              type="button"
                              onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                              className="text-stone-500 hover:text-stone-800 p-0.5 rounded cursor-pointer"
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
                          <div className="pt-2 border-t border-stone-100 animate-in fade-in duration-100">
                            <div className="bg-stone-50 rounded-lg p-2 text-[11px] font-mono text-stone-700 overflow-x-auto border border-stone-200">
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
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-600 shrink-0 space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-stone-800">
            <HardDrive className="w-3.5 h-3.5 text-emerald-700" />
            <span>記憶の整合性とライフサイクルについて</span>
          </div>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Shopping AIではAIが勝手に記憶を削除することはありません。セッション管理からセッションを削除した場合、そのセッションに紐づく
            <strong className="text-stone-700 font-medium">「Session ROM」「Conversation Record」「Session Image」</strong>
            がGoogle Driveから安全に消去されます。チラシ等の
            <strong className="text-stone-700 font-medium">「Shared ROM」</strong>
            は全セッション共有データとしてそのまま保持されます。
          </p>
        </div>
      </div>
    </div>
  );
};
