import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  ChevronRight,
  HardDrive,
  X,
  ExternalLink,
  Check,
  Copy,
  Camera,
  Loader2,
  ZoomIn,
  Layers,
  History,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Utensils,
  Plus,
} from 'lucide-react';
import { ChatMessage, SuggestionOption } from '../types/chat';
import { ShoppingSession } from '../types/session';
import { defaultChatService, ChatService } from '../services/chatService';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import {
  loadAllSessions,
  saveAllSessions,
  createNewSession,
  extractStatusSummary,
  INITIAL_GREETING_MESSAGE,
} from '../services/sessionManager';
import { StatusSummaryCard } from './StatusSummaryCard';
import { SessionDrawer } from './SessionDrawer';
import { ConversationReviewModal } from './ConversationReviewModal';

interface ShoppingAIChatProps {
  chatService?: ChatService;
}

export const ShoppingAIChat: React.FC<ShoppingAIChatProps> = ({
  chatService = defaultChatService,
}) => {
  // 1. セッション管理ステート
  const [{ sessions, activeSessionId }, setSessionStore] = useState(() => {
    const loaded = loadAllSessions();
    // 初期ロード時にChatServiceへ現在のSession Restore Stateを注入
    const active = loaded.sessions.find((s) => s.id === loaded.activeSessionId) || loaded.sessions[0];
    if (active && chatService.setBackendState) {
      chatService.setBackendState(active.restoreState);
    }
    return loaded;
  });

  const activeSession: ShoppingSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createNewSession();

  // 2. 現在のセッションの対話レコード（Conversation Record）
  // ※ 通常のメイン画面では長大な過去ログで画面を埋め尽くさず、最新のやり取りを中心に表示
  const conversationRecord = activeSession.conversationRecord;

  // 3. UI表示制御
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [showConversationReview, setShowConversationReview] = useState(false);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);

  // 4. 入力・通信ステート
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [memoryConnectionId, setMemoryConnectionId] = useState<string | null>(() => {
    return chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null;
  });
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [manualMemoryId, setManualMemoryId] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // 5. 写真相談用のステート
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  // Google Drive Memory 接続ステート監視
  useEffect(() => {
    if (chatService.onMemoryConnectionChange) {
      const unsubscribe = chatService.onMemoryConnectionChange((id) => {
        setMemoryConnectionId(id);
      });
      return unsubscribe;
    }
  }, [chatService]);

  // セッション変更時の永続化（クライアント側キャッシュ保存）
  useEffect(() => {
    saveAllSessions(sessions, activeSessionId);
  }, [sessions, activeSessionId]);

  // スクロール調整（最新メッセージ位置へ）
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationRecord, isTyping]);

  // テキストエリア自動伸縮
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // ==========================================
  // セッション操作ハンドラー群
  // ==========================================

  // 新規セッション開始
  const handleCreateSession = (customTitle?: string) => {
    const newSession = createNewSession(customTitle);
    // 新しいセッション用の初期化
    if (chatService.resetConversation) {
      chatService.resetConversation();
    }
    const updatedSessions = [newSession, ...sessions];
    setSessionStore({
      sessions: updatedSessions,
      activeSessionId: newSession.id,
    });
    setSelectedImage(null);
    setInput('');
  };

  // セッション切り替え（再開）
  const handleSelectSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;

    // Session Restore State をChatServiceに復元
    if (chatService.setBackendState) {
      chatService.setBackendState(target.restoreState);
    }

    setSessionStore((prev) => ({
      ...prev,
      activeSessionId: sessionId,
    }));
    setSelectedImage(null);
    setInput('');
  };

  // セッション削除（Google Drive Memory側のセッションROMデータ削除と連携）
  const handleDeleteSession = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    // 1. 現在接続中のGoogle Drive connection IDを取得
    const currentMemoryId =
      memoryConnectionId ||
      (chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null);

    // 2. Render側の /memory/session/delete API を呼び出す
    // 送信データ:
    // {
    //   "memory_connection_id": "<現在接続中のGoogle Drive connection id>",
    //   "session_id": "<削除対象のsession id>"
    // }
    try {
      if (chatService.deleteMemorySession) {
        const res = await chatService.deleteMemorySession(sessionId, currentMemoryId || undefined);
        if (!res.success) {
          // API削除が失敗した場合は、Frontendのセッションを残す
          return {
            success: false,
            error: res.error || 'Memory上のセッションデータ削除に失敗しました',
          };
        }
      } else {
        // 直接フォールバック
        const deleteUrl = '/api/render-backend/memory/session/delete';
        const response = await fetch(deleteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            memory_connection_id: currentMemoryId || '',
            session_id: sessionId,
          }),
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => `HTTP ${response.status}`);
          return {
            success: false,
            error: `Memory上のセッション削除に失敗しました (${errText})`,
          };
        }
      }

      // 3. 成功した場合のみFrontendのセッション一覧から削除
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createNewSession();
        if (chatService.resetConversation) {
          chatService.resetConversation();
        }
        setSessionStore({
          sessions: [fresh],
          activeSessionId: fresh.id,
        });
        return { success: true };
      }

      let newActiveId = activeSessionId;
      if (sessionId === activeSessionId) {
        newActiveId = remaining[0].id;
        if (chatService.setBackendState) {
          chatService.setBackendState(remaining[0].restoreState);
        }
      }

      setSessionStore({
        sessions: remaining,
        activeSessionId: newActiveId,
      });

      return { success: true };
    } catch (err) {
      // 通信失敗時もセッションは残す
      const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました';
      return {
        success: false,
        error: `通信エラー: ${msg}`,
      };
    }
  };

  // セッション状態更新（進行中 ↔ 完了）
  const handleUpdateSessionStatus = (sessionId: string, status: 'in_progress' | 'completed') => {
    setSessionStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.id === sessionId ? { ...s, status, updatedAt: Date.now() } : s)),
    }));
  };

  // セッション名変更
  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessionStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.id === sessionId ? { ...s, title: newTitle, updatedAt: Date.now() } : s)),
    }));
  };

  // ==========================================
  // メッセージ送信・AI対話ハンドラー
  // ==========================================

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      setPhotoError(null);
      setIsProcessingPhoto(true);
      const compressedDataUrl = await compressImageToDataUrl(file);
      setSelectedImage(compressedDataUrl);
    } catch (err) {
      console.error('写真の処理に失敗しました:', err);
      setPhotoError('写真の読み込みに失敗しました。別の写真をお試しください。');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText ?? input).trim();
    const imageToSend = selectedImage;
    if ((!textToSend && !imageToSend) || isTyping || isProcessingPhoto) return;

    const messageContent =
      textToSend ||
      'スーパーで見つけた写真です（商品・値札・特売シール・食材など）。現在の会話や候補と合わせて、判断材料としてどう考えるべきか教えてください。';

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      imageUrl: imageToSend || undefined,
    };

    // 会話レコード（Conversation Record）の即座反映
    const newRecord = [...conversationRecord, userMessage];

    // ステート更新
    setSessionStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              conversationRecord: newRecord,
              updatedAt: Date.now(),
            }
          : s
      ),
    }));

    if (!overrideText) {
      setInput('');
    }
    setSelectedImage(null);
    setPhotoError(null);
    setIsTyping(true);

    try {
      // Backendへ送信（現在セッションIDも伝達）
      const response = await chatService.sendMessage(
        newRecord,
        messageContent,
        imageToSend || undefined,
        activeSession.id
      );

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        decisionData: response.decisionData,
      };

      const updatedRecordWithAi = [...newRecord, aiMessage];
      const newRestoreState = (response.rawBackendState ?? activeSession.restoreState) as Record<string, unknown> | null;
      const newStatusSummary = extractStatusSummary(newRestoreState, response);

      // 自動タイトル推論（初回ターンで一般的なタイトルの場合、最初の話題に合わせてスマートに反映）
      let updatedTitle = activeSession.title;
      if (activeSession.title.includes('の食事・買い物') && response.decisionData?.options?.[0]?.title) {
        updatedTitle = `${response.decisionData.options[0].title}などの検討`;
      }

      setSessionStore((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                title: updatedTitle,
                conversationRecord: updatedRecordWithAi,
                restoreState: newRestoreState,
                statusSummary: newStatusSummary,
                updatedAt: Date.now(),
              }
            : s
        ),
      }));
    } catch (err) {
      let errorText = '通信エラーが発生しました。もう一度入力してみてください。';
      if (err instanceof Error) {
        const msg = err.message || '';
        if (msg.includes('Memory connection is not active') || msg.toLowerCase().includes('memory connection')) {
          errorText =
            'Google Drive Memory の接続が無効または有効期限切れです。通常モードで会話を継続するか、ヘッダーの「Memory」から再接続してください。';
          if (chatService.setMemoryConnectionId) {
            chatService.setMemoryConnectionId(null);
          }
          setMemoryConnectionId(null);
        } else if (msg.includes('Render Backend returned status')) {
          errorText = `サーバーとの通信に失敗しました（${msg}）。時間をおいてもう一度お試しください。`;
        } else {
          errorText = `通信エラーが発生しました: ${msg}`;
        }
      }

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: errorText,
        timestamp: Date.now(),
      };

      setSessionStore((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                conversationRecord: [...newRecord, errorMessage],
                updatedAt: Date.now(),
              }
            : s
        ),
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOptionSelect = (option: SuggestionOption) => {
    handleSend(`「${option.title}」が気になります。これについて詳しく教えてください。`);
  };

  // Google Drive Memory ハンドラー
  const handleDisconnectMemory = async () => {
    if (window.confirm('Google Drive Memory を切断しますか？\n（切断すると会話で外部Memoryは利用されなくなります）')) {
      if (chatService.disconnectMemory) {
        await chatService.disconnectMemory();
      } else if (chatService.setMemoryConnectionId) {
        chatService.setMemoryConnectionId(null);
      }
      setMemoryConnectionId(null);
      setShowMemoryModal(false);
    }
  };

  const handleApplyManualMemoryId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualMemoryId.trim();
    if (!trimmed) return;
    if (chatService.setMemoryConnectionId) {
      chatService.setMemoryConnectionId(trimmed);
    }
    setMemoryConnectionId(trimmed);
    setManualMemoryId('');
    setShowMemoryModal(false);
  };

  const handleCopyConnectionId = () => {
    if (memoryConnectionId) {
      navigator.clipboard?.writeText(memoryConnectionId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleStartOAuth = () => {
    const connectUrl = chatService.getMemoryConnectUrl
      ? chatService.getMemoryConnectUrl()
      : 'https://shopping-ai-jinba-dev.onrender.com/memory/connect';
    window.open(connectUrl, '_blank');
  };

  // メイン画面に表示する「現在のやり取り」の抽出
  // 通常画面は長大なチャットログ画面ではなく、「アシスタントとの最新の対話」を中心に据える
  const recentDisplayMessages =
    conversationRecord.length > 4 ? conversationRecord.slice(-4) : conversationRecord;
  const pastMessageCount = conversationRecord.length - recentDisplayMessages.length;

  return (
    <div
      id="shopping-ai-root"
      className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-stone-50 text-stone-900 overflow-hidden font-sans border-x border-stone-200 shadow-sm"
    >
      {/* 1. Header (Mobile First & Companion Bar) */}
      <header
        id="chat-header"
        className="px-4 py-2.5 bg-white/95 backdrop-blur border-b border-stone-200 sticky top-0 z-10 shrink-0"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-stone-900 leading-tight">Shopping AI</h1>
              <p className="text-[11px] text-stone-500 truncate">買い物・意思決定アシスタント</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Google Drive Memory ボタン */}
            {memoryConnectionId ? (
              <button
                type="button"
                id="btn-memory-connected"
                onClick={() => setShowMemoryModal(true)}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-[11px] font-medium hover:bg-emerald-100 transition-colors cursor-pointer active:scale-95"
                title="Google Drive Memory 接続中"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <HardDrive className="w-3 h-3 text-emerald-700" />
                <span>Memory</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-memory-connect"
                onClick={() => setShowMemoryModal(true)}
                className="flex items-center gap-1 px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full text-[11px] font-medium transition-colors cursor-pointer active:scale-95"
                title="Google Drive Memory を接続"
              >
                <HardDrive className="w-3 h-3 text-stone-500" />
                <span>Memory</span>
              </button>
            )}

            {/* セッション一覧・切り替えボタン */}
            <button
              type="button"
              id="btn-open-session-drawer"
              onClick={() => setShowSessionDrawer(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-stone-200 text-stone-700 rounded-full text-xs font-medium transition-colors cursor-pointer active:scale-95"
              title="セッション一覧・切り替え"
              aria-label="セッション一覧・切り替え"
            >
              <Layers className="w-3.5 h-3.5 text-stone-600" />
              <span>セッション ({sessions.length})</span>
            </button>
          </div>
        </div>

        {/* 2. 現在のセッション表示バー (Current Session Indicator) */}
        <div
          id="current-session-bar"
          className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between gap-2"
        >
          <button
            type="button"
            id="btn-current-session-title"
            onClick={() => setShowSessionDrawer(true)}
            className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer group"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                activeSession.status === 'in_progress' ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
              }`}
            />
            <span className="text-xs font-semibold text-stone-800 truncate max-w-[200px] sm:max-w-xs group-hover:text-emerald-700">
              {activeSession.title}
            </span>
            <span className="text-[10px] text-stone-400 font-mono shrink-0">{activeSession.date}</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                activeSession.status === 'in_progress'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {activeSession.status === 'in_progress' ? '進行中' : '完了'}
            </span>

            <button
              type="button"
              id="btn-quick-new-session"
              onClick={() => handleCreateSession()}
              className="p-1 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-colors cursor-pointer"
              title="新しいセッションを開始"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. ステータスボード（今日の状況、現在の候補、現在の可能性、決まったこと、未決定事項） */}
      <StatusSummaryCard
        summary={activeSession.statusSummary}
        sessionTitle={activeSession.title}
        isExpanded={isStatusExpanded}
        onToggleExpand={() => setIsStatusExpanded((prev) => !prev)}
        onSelectCandidate={(title) => handleSend(`「${title}」について詳しく教えてください。`)}
      />

      {/* 4. メイン領域：アシスタントとの現在の対話 */}
      <main
        id="chat-messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain bg-stone-50"
      >
        {/* 会話を振り返る導線（過去ログがある場合） */}
        {pastMessageCount > 0 && (
          <div className="flex justify-center my-1">
            <button
              type="button"
              id="btn-review-past-conversations"
              onClick={() => setShowConversationReview(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200 text-stone-600 rounded-full text-xs font-medium transition-colors shadow-2xs cursor-pointer active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-stone-500" />
              <span>前の会話を振り返る（過去 {pastMessageCount} 件）</span>
            </button>
          </div>
        )}

        {/* 振り返り用ボタン（全ログを見たい時用、常にアクセス可能） */}
        {pastMessageCount === 0 && conversationRecord.length > 1 && (
          <div className="flex justify-end">
            <button
              type="button"
              id="btn-view-conversation-record-top"
              onClick={() => setShowConversationReview(true)}
              className="text-[11px] text-stone-400 hover:text-stone-700 flex items-center gap-1 transition-colors cursor-pointer py-0.5 px-1"
            >
              <History className="w-3 h-3" />
              <span>対話記録を確認</span>
            </button>
          </div>
        )}

        {/* 直近の対話メッセージ表示 */}
        {recentDisplayMessages.map((msg) => (
          <div
            key={msg.id}
            id={`message-row-${msg.id}`}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Balloon */}
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed break-words whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-xs shadow-xs font-normal'
                  : 'bg-white text-stone-800 border border-stone-200 rounded-tl-xs shadow-2xs'
              }`}
            >
              {msg.imageUrl && (
                <div className="mb-2.5 overflow-hidden rounded-xl bg-black/15">
                  <img
                    src={msg.imageUrl}
                    alt="相談写真"
                    className="w-full max-h-60 object-cover rounded-xl cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
                    onClick={() => setPreviewModalImage(msg.imageUrl || null)}
                  />
                  <div className="flex items-center justify-end px-1.5 py-1 text-[11px] opacity-85 gap-1">
                    <ZoomIn className="w-3 h-3" />
                    <span>タップして拡大</span>
                  </div>
                </div>
              )}
              {msg.content}
            </div>

            {/* Inline Decision Support (AI側のみ) */}
            {msg.role === 'assistant' && msg.decisionData && (
              <div className="w-full max-w-[95%] mt-2.5 space-y-2.5">
                {/* 状況整理タグ (Context Understanding) */}
                {msg.decisionData.contextSummary && (
                  <div className="bg-stone-100/90 rounded-xl p-2.5 border border-stone-200 text-xs text-stone-600 space-y-1">
                    <div className="font-medium text-stone-700 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      理解した条件:
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {msg.decisionData.contextSummary.timeLimit && (
                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700 text-[11px]">
                          <Clock className="w-3 h-3 text-stone-500" />
                          {msg.decisionData.contextSummary.timeLimit}
                        </span>
                      )}
                      {msg.decisionData.contextSummary.availableIngredients?.map((ing, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700 text-[11px]"
                        >
                          <Utensils className="w-3 h-3 text-stone-500" />
                          {ing}
                        </span>
                      ))}
                      {msg.decisionData.contextSummary.moodOrPreference && (
                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700 text-[11px]">
                          {msg.decisionData.contextSummary.moodOrPreference}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 選択肢カード (ユーザーが選べる可能性の提示) */}
                {msg.decisionData.options && msg.decisionData.options.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-stone-500 px-1">
                      現在の候補・選択肢（タップして深掘り）:
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.decisionData.options.map((opt) => (
                        <button
                          key={opt.id}
                          id={`btn-option-${opt.id}`}
                          onClick={() => handleOptionSelect(opt)}
                          className="w-full text-left bg-white hover:bg-stone-50 active:bg-stone-100 border border-stone-200 hover:border-emerald-500 rounded-xl p-3 transition-all shadow-2xs group cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-semibold text-stone-900 text-xs group-hover:text-emerald-700 transition-colors">
                              {opt.title}
                            </h2>
                            <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-600 transition-colors shrink-0 mt-0.5" />
                          </div>
                          {opt.summary && (
                            <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">{opt.summary}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-stone-100 text-[11px] text-stone-500">
                            {opt.prepTimeMinutes && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-400" />
                                約{opt.prepTimeMinutes}分
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3 text-stone-400" />
                              {opt.requiresShopping ? '買い足しあり' : '手持ちでOK'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* クイックリプライボタン */}
                {msg.decisionData.quickReplies && msg.decisionData.quickReplies.length > 0 && (
                  <div className="pt-0.5">
                    <p className="text-[11px] text-stone-500 mb-1 px-0.5">すぐに返信する:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.decisionData.quickReplies.map((reply, i) => (
                        <button
                          key={i}
                          id={`btn-quick-reply-${i}`}
                          onClick={() => handleSend(reply)}
                          className="text-xs bg-white active:bg-stone-100 text-stone-700 border border-stone-300 hover:border-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-full transition-colors shadow-2xs cursor-pointer font-normal"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <span className="text-[10px] text-stone-400 mt-1 px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* AI Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-2xl rounded-tl-xs px-4 py-2.5 w-fit text-stone-400 text-xs shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="ml-1 text-stone-500">アシスタントが考え中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 5. Input Form (Mobile Optimized) */}
      <footer id="chat-input-footer" className="p-3 bg-white border-t border-stone-200 shrink-0">
        {/* 隠し input 要素（カメラ撮影用 & アルバム選択用） */}
        <input
          ref={cameraInputRef}
          id="input-file-camera"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={libraryInputRef}
          id="input-file-library"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 写真最適化中ローダー */}
        {isProcessingPhoto && (
          <div className="mb-2 p-2 bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-2 text-xs text-stone-600 animate-in fade-in duration-100">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
            <span>写真を準備中...</span>
          </div>
        )}

        {/* 写真エラー表示 */}
        {photoError && (
          <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-700 animate-in fade-in duration-100">
            <span>{photoError}</span>
            <button
              type="button"
              onClick={() => setPhotoError(null)}
              className="p-1 text-rose-500 hover:text-rose-800 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 選択中写真プレビューバナー */}
        {selectedImage && (
          <div className="mb-2.5 p-2 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 shadow-2xs bg-stone-100">
              <img
                src={selectedImage}
                alt="選択中の相談写真"
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setPreviewModalImage(selectedImage)}
              />
              <button
                type="button"
                id="btn-remove-selected-photo"
                onClick={() => setSelectedImage(null)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/75 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                title="写真を解除"
                aria-label="写真を解除"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                写真を追加しました
              </div>
              <p className="text-[11px] text-emerald-800/80 truncate mt-0.5">
                {input.trim() ? '入力内容と合わせて相談します' : 'このまま送信、または質問を入力できます'}
              </p>
            </div>
          </div>
        )}

        {/* 写真選択時のクイック質問候補 */}
        {selectedImage && !input.trim() && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-stone-500 shrink-0 font-medium pl-0.5">質問例:</span>
            {[
              'この値札・特売どう？',
              '今の候補と比べてどっちがいい？',
              '今日中に使い切るなら買い？',
              '何が作れる？',
            ].map((suggestText) => (
              <button
                key={suggestText}
                type="button"
                onClick={() => setInput(suggestText)}
                className="shrink-0 px-2.5 py-1 bg-white border border-stone-200 hover:border-emerald-500 text-stone-700 hover:text-emerald-700 rounded-full text-[11px] transition-colors cursor-pointer whitespace-nowrap active:scale-95"
              >
                {suggestText}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          {/* 写真相談ボタン */}
          <button
            id="btn-photo-consult"
            type="button"
            onClick={() => setShowPhotoSheet(true)}
            disabled={isTyping || isProcessingPhoto}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95 touch-manipulation disabled:opacity-40 ${
              selectedImage
                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900'
            }`}
            title="写真で相談（カメラ撮影・ライブラリ選択）"
            aria-label="写真で相談"
          >
            <Camera className="w-5 h-5" />
          </button>

          <div className="flex-1 bg-stone-100 rounded-2xl border border-stone-200 focus-within:border-emerald-500 focus-within:bg-white transition-colors px-3.5 py-1.5 flex items-center">
            <textarea
              id="input-chat-message"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedImage
                  ? '写真についての質問を入力... (空欄のまま送信も可能)'
                  : '今の状況や気分を入力... (例: 疲れてるから20分で)'
              }
              rows={1}
              className="w-full resize-none bg-transparent border-0 focus:outline-hidden text-sm text-stone-900 placeholder:text-stone-400 max-h-28 py-1 leading-relaxed"
            />
          </div>

          <button
            id="btn-send-message"
            type="submit"
            disabled={(!input.trim() && !selectedImage) || isTyping || isProcessingPhoto}
            className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 active:scale-95 transition-all shrink-0 touch-manipulation shadow-xs cursor-pointer"
            aria-label="送信"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      {/* 6. セッション管理ドロワー */}
      <SessionDrawer
        isOpen={showSessionDrawer}
        onClose={() => setShowSessionDrawer(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onUpdateSessionStatus={handleUpdateSessionStatus}
        onRenameSession={handleRenameSession}
      />

      {/* 7. 会話記録振り返りモーダル */}
      <ConversationReviewModal
        isOpen={showConversationReview}
        onClose={() => setShowConversationReview(false)}
        sessionTitle={activeSession.title}
        sessionDate={activeSession.date}
        conversationRecord={conversationRecord}
        onPreviewImage={(url) => setPreviewModalImage(url)}
      />

      {/* 8. Google Drive Memory モーダル */}
      {showMemoryModal && (
        <div
          id="modal-memory-backdrop"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowMemoryModal(false)}
        >
          <div
            id="modal-memory-card"
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/70">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-emerald-700" />
                <h3 className="font-semibold text-stone-900 text-base">Google Drive Memory</h3>
              </div>
              <button
                type="button"
                id="btn-close-memory-modal"
                onClick={() => setShowMemoryModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition-colors cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm text-stone-600">
              {memoryConnectionId ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="font-medium text-emerald-900">接続中（Active）</span>
                    </div>
                    <span className="text-xs text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md font-mono">
                      Google Drive
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      接続ID (memory_connection_id)
                    </label>
                    <div className="flex items-center gap-2 p-2 bg-stone-100 rounded-lg border border-stone-200 font-mono text-xs text-stone-800 break-all">
                      <span className="flex-1">{memoryConnectionId}</span>
                      <button
                        type="button"
                        onClick={handleCopyConnectionId}
                        className="p-1.5 text-stone-500 hover:text-stone-800 rounded hover:bg-stone-200 transition-colors shrink-0 cursor-pointer"
                        title="IDをコピー"
                      >
                        {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-stone-500">
                    ユーザー自身のGoogle Drive上のMemory領域がマウントされています。セッション実行時にパーソナライズされた食材や嗜好のコンテキストが反映されます。
                  </p>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      id="btn-disconnect-memory"
                      onClick={handleDisconnectMemory}
                      className="w-full py-2.5 px-4 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl font-medium text-sm transition-colors cursor-pointer active:scale-98"
                    >
                      Memoryを切断する（Eject）
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMemoryModal(false)}
                      className="w-full py-2 text-stone-500 hover:text-stone-800 text-sm font-medium cursor-pointer"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="leading-relaxed">
                    Shopping AIはユーザーアカウントを持たず、ユーザー自身のGoogle Driveを「外部メモリーカード」として接続します。
                  </p>

                  <button
                    type="button"
                    id="btn-start-google-oauth"
                    onClick={handleStartOAuth}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
                  >
                    <span>GoogleアカウントでMemoryを接続</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-stone-200"></div>
                    <span className="flex-shrink mx-3 text-xs text-stone-400">または接続IDを直接入力</span>
                    <div className="flex-grow border-t border-stone-200"></div>
                  </div>

                  <form onSubmit={handleApplyManualMemoryId} className="space-y-2">
                    <input
                      id="input-manual-memory-id"
                      type="text"
                      value={manualMemoryId}
                      onChange={(e) => setManualMemoryId(e.target.value)}
                      placeholder="memory_connection_id を貼り付け"
                      className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-emerald-500 focus:bg-white transition-colors"
                    />
                    <button
                      id="btn-apply-memory-id"
                      type="submit"
                      disabled={!manualMemoryId.trim()}
                      className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      接続IDを適用
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. 写真ソース選択シート（カメラ撮影 / ライブラリ） */}
      {showPhotoSheet && (
        <div
          id="sheet-photo-backdrop"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowPhotoSheet(false)}
        >
          <div
            id="sheet-photo-content"
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-700" />
                <h3 className="font-semibold text-stone-900 text-base">写真で相談する</h3>
              </div>
              <button
                type="button"
                id="btn-close-photo-sheet"
                onClick={() => setShowPhotoSheet(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition-colors cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-500 leading-relaxed">
                スーパーの商品、値札、特売シール、チラシ、手持ちの食材などを撮影または選択して、Shopping AIと相談できます。
              </p>

              <button
                type="button"
                id="btn-photo-action-camera"
                onClick={() => {
                  setShowPhotoSheet(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/40 active:bg-emerald-100/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900 text-sm">その場でカメラ撮影</div>
                  <div className="text-xs text-stone-500 mt-0.5">売り場の商品や値札、半額シールを直接撮影します</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 shrink-0" />
              </button>

              <button
                type="button"
                id="btn-photo-action-library"
                onClick={() => {
                  setShowPhotoSheet(false);
                  libraryInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-stone-200 hover:border-blue-500 hover:bg-blue-50/40 active:bg-blue-100/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900 text-sm">写真ライブラリから選択</div>
                  <div className="text-xs text-stone-500 mt-0.5">保存済みの写真やチラシ画像を選びます</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-blue-700 shrink-0" />
              </button>

              <button
                type="button"
                id="btn-cancel-photo-sheet"
                onClick={() => setShowPhotoSheet(false)}
                className="w-full py-2.5 text-center text-sm font-medium text-stone-600 hover:text-stone-900 bg-stone-100 rounded-xl cursor-pointer active:scale-98 transition-all"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. 全画面写真プレビュー（拡大ライトボックス） */}
      {previewModalImage && (
        <div
          id="modal-image-lightbox"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewModalImage(null)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            <button
              type="button"
              id="btn-close-lightbox"
              onClick={() => setPreviewModalImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white rounded-full bg-black/50 hover:bg-black/80 transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewModalImage}
              alt="拡大プレビュー"
              className="max-h-[80vh] max-w-[95vw] object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
