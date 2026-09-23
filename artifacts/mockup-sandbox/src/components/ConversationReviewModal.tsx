import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  History,
  Search,
  Copy,
  Check,
  ZoomIn,
  Clock,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Cloud,
  HardDrive,
  Camera,
} from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { ChatService } from '../services/chatService';

const PHOTO_INTERNAL_PROMPT =
  'スーパーで見つけた商品・食材の写真です。現在の会話や候補と合わせて判断材料として教えてください。';

const getDisplayMessageContent = (content: string, imageUrl?: string): string => {
  const trimmed = (content || '').trim();
  if (
    trimmed === PHOTO_INTERNAL_PROMPT ||
    trimmed === 'スーパーで見つけた商品・食材の写真です。現在の会話や候補と合わせて判断材料として教えてください。' ||
    (!trimmed && imageUrl)
  ) {
    return '写真';
  }
  if (trimmed.includes(PHOTO_INTERNAL_PROMPT) && trimmed.length <= PHOTO_INTERNAL_PROMPT.length + 5) {
    return '写真';
  }
  return content;
};

interface ConversationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  localConversationRecord: ChatMessage[];
  chatService?: ChatService;
  memoryConnectionId?: string | null;
  onPreviewImage: (url: string) => void;
  onOpenSessionImages?: () => void;
}

export const ConversationReviewModal: React.FC<ConversationReviewModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  sessionTitle,
  sessionDate,
  localConversationRecord,
  chatService,
  memoryConnectionId,
  onPreviewImage,
  onOpenSessionImages,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drive取得管理用ステート
  const [timelineMessages, setTimelineMessages] = useState<ChatMessage[] | null>(null);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'drive' | 'local'>('local');

  // 有効なMemory接続IDの判定
  const validMemoryConnectionId =
    typeof memoryConnectionId === 'string' &&
    memoryConnectionId.trim().length > 0 &&
    memoryConnectionId.trim() !== 'null' &&
    memoryConnectionId.trim() !== 'undefined'
      ? memoryConnectionId.trim()
      : null;

  // モーダルが開かれたとき、Memory接続中なら Google Drive Conversation Record を取得
  useEffect(() => {
    if (!isOpen) {
      // 閉じたときはリセット
      setTimelineMessages(null);
      setIsLoadingDrive(false);
      setDriveError(null);
      setSourceType('local');
      setSearchQuery('');
      return;
    }

    let isMounted = true;

    // Memory未接続、またはgetConversationTimeline APIが利用できない場合はローカル履歴を使用
    if (!validMemoryConnectionId || !chatService?.getConversationTimeline || !sessionId) {
      setTimelineMessages(null);
      setIsLoadingDrive(false);
      setDriveError(null);
      setSourceType('local');
      return;
    }

    // Google DriveからConversation Recordを取得
    const fetchTimeline = async () => {
      setIsLoadingDrive(true);
      setDriveError(null);
      try {
        const res = await chatService.getConversationTimeline!(
          sessionId,
          validMemoryConnectionId
        );

        if (!isMounted) return;

        if (res.success && Array.isArray(res.messages) && res.messages.length > 0) {
          // Drive側から有効なConversation Recordが取得できた場合
          setTimelineMessages(res.messages);
          setSourceType('drive');
          setDriveError(null);
        } else if (res.success && Array.isArray(res.messages) && res.messages.length === 0) {
          // Drive上にまだレコードが作成されていない場合、ローカル履歴をフォールバック表示
          setTimelineMessages(null);
          setSourceType('local');
          setDriveError(null);
        } else {
          // エラーまたは未取得時はローカル履歴へフォールバック
          setTimelineMessages(null);
          setSourceType('local');
          if (res.error) {
            setDriveError(res.error);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : '通信エラー';
        setTimelineMessages(null);
        setSourceType('local');
        setDriveError(msg);
      } finally {
        if (isMounted) {
          setIsLoadingDrive(false);
        }
      }
    };

    fetchTimeline();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sessionId, validMemoryConnectionId, chatService]);

  // 手動再取得ハンドラー
  const handleRefreshDrive = async () => {
    if (!validMemoryConnectionId || !chatService?.getConversationTimeline || !sessionId) {
      return;
    }
    setIsLoadingDrive(true);
    setDriveError(null);
    try {
      const res = await chatService.getConversationTimeline(
        sessionId,
        validMemoryConnectionId
      );
      if (res.success && Array.isArray(res.messages) && res.messages.length > 0) {
        setTimelineMessages(res.messages);
        setSourceType('drive');
      } else {
        setTimelineMessages(null);
        setSourceType('local');
        if (res.error) {
          setDriveError(res.error);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '通信エラー';
      setTimelineMessages(null);
      setSourceType('local');
      setDriveError(msg);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  if (!isOpen) return null;

  // 表示するメッセージ配列（Drive取得成功時はDriveのConversation Record、それ以外はローカル履歴）
  const activeRecord = timelineMessages !== null ? timelineMessages : localConversationRecord;

  const filteredMessages = activeRecord.filter((msg) => {
    if (!searchQuery.trim()) return true;
    const display = getDisplayMessageContent(msg.content, msg.imageUrl);
    return display.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const handleCopy = (id: string, text: string, imageUrl?: string) => {
    const displayText = getDisplayMessageContent(text, imageUrl);
    navigator.clipboard?.writeText(displayText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="modal-conversation-review-backdrop"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-conversation-review-content"
        className="w-full sm:max-w-xl h-[85vh] max-h-[800px] bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/95 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-stone-800 dark:bg-stone-750 text-white flex items-center justify-center shadow-2xs shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm leading-tight truncate max-w-xs">
                  {sessionTitle}
                </h3>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 bg-stone-200/70 dark:bg-stone-800 px-1.5 py-0.2 rounded font-mono shrink-0">
                  {sessionDate}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  過去の対話記録（全 {activeRecord.length} ターン）
                </p>
                {/* 読み込み元インジケーター */}
                {sourceType === 'drive' ? (
                  <span
                    id="badge-history-source-drive"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 px-1.5 py-0.5 rounded-full"
                    title="Google Drive Memoryから最新のConversation Recordを取得しました"
                  >
                    <Cloud className="w-2.5 h-2.5" />
                    Drive
                  </span>
                ) : (
                  <span
                    id="badge-history-source-local"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-full"
                    title={
                      validMemoryConnectionId
                        ? 'Google Drive未作成または取得待機中のため、端末のローカル記録を表示しています'
                        : 'Memory未接続のため端末のローカル記録を表示しています'
                    }
                  >
                    <HardDrive className="w-2.5 h-2.5 text-stone-400 dark:text-stone-500" />
                    端末
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Memory接続時の再取得ボタン */}
            {validMemoryConnectionId && (
              <button
                type="button"
                id="btn-refresh-conversation-history"
                onClick={handleRefreshDrive}
                disabled={isLoadingDrive}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
                title="Google Driveから最新履歴を再取得"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              id="btn-close-conversation-review"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="会話記録を閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 通信エラーまたは同期状況のアナウンス */}
        {driveError && (
          <div
            id="history-drive-fallback-alert"
            className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate">Drive記録の取得を試みましたが、端末のローカル記録で安全に表示しています</span>
            </div>
            {validMemoryConnectionId && (
              <button
                type="button"
                onClick={handleRefreshDrive}
                className="text-[11px] underline font-medium hover:text-amber-900 dark:hover:text-amber-200 ml-2 shrink-0 cursor-pointer"
              >
                再試行
              </button>
            )}
          </div>
        )}

        {/* 読み込み中プログレス */}
        {isLoadingDrive && (
          <div className="px-4 py-2 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/60 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Google Drive Memory から最新のConversation Recordを取得中...</span>
          </div>
        )}

        {/* Search Bar & Actions */}
        <div className="p-3 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-1.5 text-xs">
            <Search className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0 mr-2" />
            <input
              type="text"
              id="input-search-conversation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="過去の対話内容を検索... (例: 豚肉, 20分, 買い足し)"
              className="bg-transparent border-0 focus:outline-hidden text-xs text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {onOpenSessionImages && (
            <button
              type="button"
              id="btn-review-open-session-images"
              onClick={() => {
                onClose();
                onOpenSessionImages();
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 active:scale-98"
              title="このセッションで保存された写真一覧を確認"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>写真一覧を見る</span>
            </button>
          )}
        </div>

        {/* Message Log Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50 dark:bg-stone-950/40">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-stone-400 dark:text-stone-500 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-stone-300 dark:text-stone-600 stroke-1" />
              一致する対話記録は見つかりませんでした
            </div>
          ) : (
            filteredMessages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                id={`record-row-${msg.id}`}
                className={`p-3 rounded-xl border text-xs leading-relaxed space-y-2 ${
                  msg.role === 'user'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-stone-800 dark:text-stone-200 ml-6'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 mr-6 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-700/60 pb-1.5">
                  <span className="font-semibold text-stone-600 dark:text-stone-300">
                    {msg.role === 'user' ? 'あなた' : 'ポコ太'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5 text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content, msg.imageUrl)}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded cursor-pointer"
                      title="テキストをコピー"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {msg.imageUrl && (
                  <div className="overflow-hidden rounded-lg bg-black/10 max-w-xs">
                    <img
                      src={msg.imageUrl}
                      alt="相談写真"
                      className="w-full max-h-48 object-cover rounded-lg cursor-pointer hover:opacity-90"
                      onClick={() => onPreviewImage(msg.imageUrl || '')}
                    />
                    <div className="flex items-center justify-end px-1.5 py-0.5 text-[10px] text-stone-600 dark:text-stone-400 gap-1">
                      <ZoomIn className="w-3 h-3" />
                      <span>タップして拡大</span>
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-wrap break-words">
                  {getDisplayMessageContent(msg.content, msg.imageUrl)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 text-right shrink-0">
          <button
            type="button"
            id="btn-close-conversation-review-bottom"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
