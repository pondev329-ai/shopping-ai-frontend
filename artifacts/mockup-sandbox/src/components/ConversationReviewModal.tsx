import React, { useState } from 'react';
import {
  X,
  History,
  Search,
  Copy,
  Check,
  ZoomIn,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { ChatMessage } from '../types/chat';

interface ConversationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  sessionDate: string;
  conversationRecord: ChatMessage[];
  onPreviewImage: (url: string) => void;
}

export const ConversationReviewModal: React.FC<ConversationReviewModalProps> = ({
  isOpen,
  onClose,
  sessionTitle,
  sessionDate,
  conversationRecord,
  onPreviewImage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredMessages = conversationRecord.filter((msg) => {
    if (!searchQuery.trim()) return true;
    return msg.content.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-800 dark:bg-stone-750 text-white flex items-center justify-center shadow-2xs">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm leading-tight truncate max-w-xs">
                  {sessionTitle}
                </h3>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 bg-stone-200/70 dark:bg-stone-800 px-1.5 py-0.2 rounded font-mono">
                  {sessionDate}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">過去の対話記録（全 {conversationRecord.length} ターン）</p>
            </div>
          </div>
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

        {/* Search Bar */}
        <div className="p-3 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shrink-0">
          <div className="relative flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-1.5 text-xs">
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
                    {msg.role === 'user' ? 'あなた' : 'Shopping AI'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5 text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
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

                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
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
