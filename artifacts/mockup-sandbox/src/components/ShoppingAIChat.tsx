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
  Database,
  MessageSquare,
  BookOpen,
  Menu,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  ChevronUp,
  Settings,
  Type,
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
import { useTheme } from '../hooks/useTheme';
import { CompanionSceneStage } from './CompanionSceneStage';
import { StatusDetailModal } from './StatusDetailModal';
import { SessionDrawer } from './SessionDrawer';
import { ConversationReviewModal } from './ConversationReviewModal';
import { MemoryRomModal } from './MemoryRomModal';
import { SettingsModal } from './SettingsModal';

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
  const { theme, setTheme, fontSize, setFontSize } = useTheme();
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [showConversationReview, setShowConversationReview] = useState(false);
  const [showMemoryRomModal, setShowMemoryRomModal] = useState(false);
  const [showStatusDetailModal, setShowStatusDetailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  // 返信候補（クイックリプライ）の開閉状態（メッセージIDごとの展開フラグ）
  const [expandedQuickReplies, setExpandedQuickReplies] = useState<Record<string, boolean>>({});

  const toggleQuickReplies = (messageId: string) => {
    setExpandedQuickReplies((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  // 4. 入力・通信ステート
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [memoryConnectionId, setMemoryConnectionId] = useState<string | null>(() => {
    return chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null;
  });
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [manualMemoryId, setManualMemoryId] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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

  // Memory接続時に、現在アクティブなセッションのDrive側Session ROMを照会してrestoreStateを同期
  useEffect(() => {
    const rawMemoryId =
      memoryConnectionId ||
      (chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null);
    const validMemoryConnectionId =
      typeof rawMemoryId === 'string' &&
      rawMemoryId.trim().length > 0 &&
      rawMemoryId.trim() !== 'null' &&
      rawMemoryId.trim() !== 'undefined'
        ? rawMemoryId.trim()
        : null;

    if (!validMemoryConnectionId || !chatService.getMemorySession || !activeSessionId) {
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const res = await chatService.getMemorySession!(activeSessionId, validMemoryConnectionId);
        if (isMounted && res.success && res.state) {
          if (chatService.setBackendState) {
            chatService.setBackendState(res.state);
          }
          const updatedSummary = extractStatusSummary(res.state);
          setSessionStore((prev) => ({
            ...prev,
            sessions: prev.sessions.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    restoreState: res.state || s.restoreState,
                    statusSummary: updatedSummary,
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
        }
      } catch {
        // Driveからの取得に失敗した場合はlocalStorageの状態をそのまま利用
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [memoryConnectionId, activeSessionId, chatService]);

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
  // Memory接続時はGoogle Drive側の最新Session ROMを取得してrestoreStateを再構築
  // 未接続時またはDrive未作成・取得失敗時は既存localStorage側のrestoreStateを利用して通常通り動作
  const handleSelectSession = async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;

    // 1. まずローカルのrestoreStateをChatServiceにセットし、即時切り替え
    if (chatService.setBackendState) {
      chatService.setBackendState(target.restoreState);
    }

    setSessionStore((prev) => ({
      ...prev,
      activeSessionId: sessionId,
    }));
    setSelectedImage(null);
    setInput('');

    // 2. Google Drive Memory 接続中の場合、Render Backend /memory/session/get から最新Session ROMを取得
    const rawMemoryId =
      memoryConnectionId ||
      (chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null);
    const validMemoryConnectionId =
      typeof rawMemoryId === 'string' &&
      rawMemoryId.trim().length > 0 &&
      rawMemoryId.trim() !== 'null' &&
      rawMemoryId.trim() !== 'undefined'
        ? rawMemoryId.trim()
        : null;

    if (validMemoryConnectionId && chatService.getMemorySession) {
      try {
        const res = await chatService.getMemorySession(sessionId, validMemoryConnectionId);
        if (res.success && res.state) {
          // Google Driveから取得したSession ROMでChatServiceのバックエンドStateを更新
          if (chatService.setBackendState) {
            chatService.setBackendState(res.state);
          }
          // セッション復元情報 (restoreState) とステータスサマリーを同期更新
          const updatedSummary = extractStatusSummary(res.state);
          setSessionStore((prev) => ({
            ...prev,
            sessions: prev.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    restoreState: res.state || s.restoreState,
                    statusSummary: updatedSummary,
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
        }
      } catch {
        // 通信エラーやDrive上にROMがない場合は既存localStorage側の状態のまま通常動作を継続
      }
    }
  };

  // セッション削除（Google Drive Memory接続時はROMデータも連動削除、未接続時はFrontendのみ正常削除）
  const handleDeleteSession = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    // 1. 現在接続中の有効なGoogle Drive connection IDを確認
    const rawMemoryId =
      memoryConnectionId ||
      (chatService.getMemoryConnectionId ? chatService.getMemoryConnectionId() : null);
    const validMemoryConnectionId =
      typeof rawMemoryId === 'string' &&
      rawMemoryId.trim().length > 0 &&
      rawMemoryId.trim() !== 'null' &&
      rawMemoryId.trim() !== 'undefined'
        ? rawMemoryId.trim()
        : null;

    try {
      // 2. Memory接続中の場合のみ、Memory上のセッションデータ削除APIを呼び出す
      // ※ Memory未接続は通常・正常な状態であるため、APIを呼び出さず、エラーも出さずにFrontendセッション削除を実行する
      if (validMemoryConnectionId) {
        if (chatService.deleteMemorySession) {
          const res = await chatService.deleteMemorySession(sessionId, validMemoryConnectionId);
          if (!res.success) {
            // Memory側の削除に失敗した場合は、安全策としてFrontendのセッションを残す
            return {
              success: false,
              error: res.error || 'Memory上のセッションデータ削除に失敗しました',
            };
          }
        }
      }

      // 3. Frontendのセッション一覧から削除
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

      // Main Flowから渡された current_scene と expert_mode の更新
      const updatedScene = response.currentScene ?? activeSession.currentScene ?? 'planning';
      const updatedExpert = response.expertMode !== undefined ? response.expertMode : (activeSession.expertMode ?? null);

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        decisionData: response.decisionData,
        sceneAtMessage: updatedScene,
        expertAtMessage: updatedExpert,
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
                currentScene: updatedScene,
                expertMode: updatedExpert,
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

  // メッセージ内容のワンタップコピー
  const handleCopyMessage = (id: string, text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopyText(text);
      });
    } else {
      fallbackCopyText(text);
    }
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch {
      // ignore
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
    conversationRecord.length > 3 ? conversationRecord.slice(-3) : conversationRecord;
  const pastMessageCount = conversationRecord.length - recentDisplayMessages.length;
  const latestAssistantMsg = [...conversationRecord].reverse().find((m) => m.role === 'assistant');

  return (
    <div
      id="shopping-ai-root"
      className="flex flex-col h-[100dvh] w-full max-w-4xl lg:max-w-5xl mx-auto bg-stone-100/60 dark:bg-stone-950 text-stone-900 dark:text-stone-100 overflow-hidden font-sans border-x border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-150"
    >
      {/* 1. 最小限のヘッダー */}
      <header
        id="chat-header"
        className="px-3.5 sm:px-4 py-2 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-b border-stone-200 dark:border-stone-800 sticky top-0 z-20 shrink-0 transition-colors"
      >
        <div className="flex items-center justify-between">
          {/* 左側：ロゴ & 常時確認できるMemory接続状態 */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-none">Shopping AI</span>

            {/* Memory常時ステータス表示（未接続はエラー扱いせず、タップで接続設定） */}
            <button
              type="button"
              id="btn-header-memory-status"
              onClick={() => setShowMemoryModal(true)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                memoryConnectionId
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/80'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
              title={
                memoryConnectionId
                  ? 'Google Drive Memory 接続中（タップして設定）'
                  : 'Google Drive Memory 未接続（タップして接続）'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  memoryConnectionId ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400 dark:bg-stone-500'
                }`}
              />
              <HardDrive className="w-3 h-3 shrink-0 text-stone-600 dark:text-stone-300" />
              <span className="text-[10.5px]">
                {memoryConnectionId ? '接続中' : '未接続'}
              </span>
            </button>
          </div>

          {/* 右側：対話履歴 ＆ 新規セッション ＆ メニューボタン */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="btn-header-conversation-history"
              onClick={() => setShowConversationReview(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 rounded-full transition-colors cursor-pointer border border-stone-200 dark:border-stone-700 shadow-2xs"
              title="対話履歴を全件確認"
            >
              <History className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>履歴</span>
              {conversationRecord.length > 0 && (
                <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                  ({conversationRecord.length})
                </span>
              )}
            </button>

            <button
              type="button"
              id="btn-header-new-session"
              onClick={() => handleCreateSession()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 active:bg-emerald-100 dark:active:bg-emerald-900 rounded-full transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-2xs"
              title="新しいセッションを開始"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">新規</span>
            </button>

            <button
              type="button"
              id="btn-header-app-menu"
              onClick={() => setShowAppMenu(true)}
              className="p-1.5 text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 rounded-full transition-colors cursor-pointer border border-stone-200 dark:border-stone-700 shadow-2xs"
              title="メニューを開く（セッション・記憶・対話記録・テーマ設定など）"
              aria-label="メニューを開く"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. メイン画面の主役：現在のシーン＋キャラクター（画面上部の世界領域） */}
      <section
        id="stage-scene-main"
        aria-label="現在のシーンとキャラクター"
        className="shrink-0 p-2 sm:p-3 bg-stone-100/90 dark:bg-stone-900/90 border-b border-stone-200 dark:border-stone-800 transition-colors"
      >
        <CompanionSceneStage
          scene={activeSession.currentScene || 'planning'}
          expertMode={activeSession.expertMode}
          statusSummary={activeSession.statusSummary}
          isTyping={isTyping}
          onOpenStatusDetail={() => setShowStatusDetailModal(true)}
        />
      </section>

      {/* 3. Shopping AIの返信 & 対話領域 */}
      <section
        id="stage-lower-dialogue"
        aria-label="Shopping AIの返信と対話"
        className="flex-1 flex flex-col min-h-0 bg-white dark:bg-stone-900 transition-colors"
      >
        {/* チャットメッセージ表示部 */}
        <main
          id="chat-messages-container"
          className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 overscroll-contain bg-stone-50/40 dark:bg-stone-950/40 transition-colors"
        >
          {/* 直近の対話メッセージ表示 */}
          {recentDisplayMessages.map((msg) => (
            <div
              key={msg.id}
              id={`message-row-${msg.id}`}
              className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* アシスタント発話ヘッダー（世界領域から分離された会話としての存在） */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1 pl-1">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs shrink-0">
                    ポ
                  </div>
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    ポコ太
                  </span>
                  {activeSession.expertMode && (
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded font-semibold border border-purple-200 dark:border-purple-800">
                      {activeSession.expertMode}専門
                    </span>
                  )}
                </div>
              )}

              {/* Balloon: スマホでは横幅いっぱいにフィット (w-full max-w-full) */}
              <div
                className={`relative w-full sm:max-w-[92%] rounded-2xl px-3.5 sm:px-4 py-3 text-[14.5px] leading-relaxed break-words whitespace-pre-wrap transition-colors ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-xs shadow-xs font-normal'
                    : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-tl-xs shadow-2xs group'
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
                    <div className="flex items-center justify-end px-1.5 py-1 text-[11px] opacity-85 gap-1 text-white">
                      <ZoomIn className="w-3 h-3" />
                      <span>タップして拡大</span>
                    </div>
                  </div>
                )}
                {msg.content}
              </div>

              {/* Inline Decision Support (AI側のみ) */}
              {msg.role === 'assistant' && msg.decisionData && (
                <div className="w-full sm:max-w-[92%] mt-2.5 space-y-2.5">
                  {/* 状況整理タグ (Context Understanding) */}
                  {msg.decisionData.contextSummary && (
                    <div className="bg-stone-100/90 dark:bg-stone-800/90 rounded-xl p-2.5 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 space-y-1">
                      <div className="font-medium text-stone-700 dark:text-stone-200 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        理解した条件:
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {msg.decisionData.contextSummary.timeLimit && (
                          <span className="inline-flex items-center gap-1 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-200 text-[11px]">
                            <Clock className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                            {msg.decisionData.contextSummary.timeLimit}
                          </span>
                        )}
                        {msg.decisionData.contextSummary.availableIngredients?.map((ing, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-200 text-[11px]"
                          >
                            <Utensils className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                            {ing}
                          </span>
                        ))}
                        {msg.decisionData.contextSummary.moodOrPreference && (
                          <span className="inline-flex items-center gap-1 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-200 text-[11px]">
                            {msg.decisionData.contextSummary.moodOrPreference}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 選択肢カード (ユーザーが選べる可能性の提示) */}
                  {msg.decisionData.options && msg.decisionData.options.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 px-1">
                        現在の候補・選択肢（タップして深掘り）:
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {msg.decisionData.options.map((opt) => (
                          <button
                            key={opt.id}
                            id={`btn-option-${opt.id}`}
                            onClick={() => handleOptionSelect(opt)}
                            className="w-full text-left bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 active:bg-stone-100 dark:active:bg-stone-700 border border-stone-200 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl p-3 transition-all shadow-2xs group cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-xs group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                {opt.title}
                              </h2>
                              <ChevronRight className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
                            </div>
                            {opt.summary && (
                              <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">{opt.summary}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-stone-100 dark:border-stone-700/60 text-[11px] text-stone-500 dark:text-stone-400">
                              {opt.prepTimeMinutes && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                                  約{opt.prepTimeMinutes}分
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <ShoppingBag className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                                {opt.requiresShopping ? '買い足しあり' : '手持ちでOK'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* メッセージフッター（回答欄下側：左側にコピー、その横に返信候補ボタン、右側に時刻） */}
            <div
              className={`flex items-center gap-2 mt-1.5 px-1 text-[11px] text-stone-400 dark:text-stone-500 w-full sm:max-w-[92%] ${
                msg.role === 'user' ? 'justify-end' : 'justify-between'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* コピーボタン（回答欄の左下に常に固定） */}
                  <button
                    type="button"
                    id={`btn-copy-msg-${msg.id}`}
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-all cursor-pointer active:scale-95 border text-xs shadow-2xs shrink-0 ${
                      copiedMessageId === msg.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-medium'
                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700'
                    }`}
                    title="メッセージ内容をワンタップでコピー"
                    aria-label="返信内容をコピー"
                  >
                    {copiedMessageId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10.5px]">コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                        <span className="text-[10.5px]">コピー</span>
                      </>
                    )}
                  </button>

                  {/* 返信候補ボタン（コピーの横に1行で並べて配置） */}
                  {msg.decisionData?.quickReplies && msg.decisionData.quickReplies.length > 0 && (
                    <button
                      type="button"
                      id={`btn-toggle-quick-replies-${msg.id}`}
                      onClick={() => toggleQuickReplies(msg.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-emerald-700 dark:text-stone-400 dark:hover:text-emerald-400 bg-stone-100/90 dark:bg-stone-800/90 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-stone-200 dark:border-stone-700 rounded-full px-2.5 py-0.5 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>返信候補 ({msg.decisionData.quickReplies.length})</span>
                      {expandedQuickReplies[msg.id] ? (
                        <ChevronUp className="w-3 h-3 ml-0.5 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-3 h-3 ml-0.5 text-stone-400" />
                      )}
                    </button>
                  )}
                </div>
              ) : null}

              <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono shrink-0 ml-auto">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* 返信候補が展開された場合のチップ一覧（下部にスライド展開） */}
            {msg.role === 'assistant' &&
              msg.decisionData?.quickReplies &&
              msg.decisionData.quickReplies.length > 0 &&
              expandedQuickReplies[msg.id] && (
                <div className="w-full sm:max-w-[92%] mt-1.5 pl-0.5 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {msg.decisionData.quickReplies.map((reply, i) => (
                    <button
                      key={i}
                      id={`btn-quick-reply-${i}`}
                      onClick={() => handleSend(reply)}
                      className="text-xs bg-white dark:bg-stone-800 active:bg-stone-100 dark:active:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-600 hover:border-emerald-600 dark:hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-3 py-1.5 rounded-full transition-colors shadow-2xs cursor-pointer font-normal"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
          </div>
        ))}

        {/* AI Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl rounded-tl-xs px-4 py-2.5 w-fit text-stone-400 dark:text-stone-400 text-xs shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="ml-1 text-stone-500 dark:text-stone-400">アシスタントが考え中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 5. Input Form (Mobile Optimized) */}
      <footer id="chat-input-footer" className="p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 shrink-0 transition-colors">
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
          <div className="mb-2 p-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300 animate-in fade-in duration-100">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>写真を準備中...</span>
          </div>
        )}

        {/* 写真エラー表示 */}
        {photoError && (
          <div className="mb-2 p-2 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-100">
            <span>{photoError}</span>
            <button
              type="button"
              onClick={() => setPhotoError(null)}
              className="p-1 text-rose-500 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 選択中写真プレビューバナー */}
        {selectedImage && (
          <div className="mb-2.5 p-2 bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-700 shadow-2xs bg-stone-100 dark:bg-stone-800">
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
              <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                写真を追加しました
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 truncate mt-0.5">
                {input.trim() ? '入力内容と合わせて相談します' : 'このまま送信、または質問を入力できます'}
              </p>
            </div>
          </div>
        )}

        {/* 写真選択時のクイック質問候補 */}
        {selectedImage && !input.trim() && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 shrink-0 font-medium pl-0.5">質問例:</span>
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
                className="shrink-0 px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-400 text-stone-700 dark:text-stone-200 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-full text-[11px] transition-colors cursor-pointer whitespace-nowrap active:scale-95"
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
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500'
                : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
            title="写真で相談（カメラ撮影・ライブラリ選択）"
            aria-label="写真で相談"
          >
            <Camera className="w-5 h-5" />
          </button>

          <div className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-stone-850 transition-colors px-3.5 py-1.5 flex items-center">
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
              className="w-full resize-none bg-transparent border-0 focus:outline-hidden text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 max-h-28 py-1 leading-relaxed"
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
      </section>

      {/* 5.5 ステータス詳細モーダル（脇役のステータス概要タップで展開） */}
      <StatusDetailModal
        isOpen={showStatusDetailModal}
        onClose={() => setShowStatusDetailModal(false)}
        summary={activeSession.statusSummary}
        scene={activeSession.currentScene || 'planning'}
        sessionTitle={activeSession.title}
        onSelectCandidate={(candidateTitle) =>
          handleSend(`「${candidateTitle}」について詳しく教えてください。`)
        }
      />

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
        onOpenMemoryRom={() => setShowMemoryRomModal(true)}
      />

      {/* 7. 会話記録振り返りモーダル */}
      <ConversationReviewModal
        isOpen={showConversationReview}
        onClose={() => setShowConversationReview(false)}
        sessionId={activeSession.id}
        sessionTitle={activeSession.title}
        sessionDate={activeSession.date}
        localConversationRecord={conversationRecord}
        chatService={chatService}
        memoryConnectionId={memoryConnectionId}
        onPreviewImage={(url) => setPreviewModalImage(url)}
      />

      {/* 8. Google Drive Memory モーダル */}
      {showMemoryModal && (
        <div
          id="modal-memory-backdrop"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowMemoryModal(false)}
        >
          <div
            id="modal-memory-card"
            className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/90">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-base">Google Drive Memory</h3>
              </div>
              <button
                type="button"
                id="btn-close-memory-modal"
                onClick={() => setShowMemoryModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm text-stone-600 dark:text-stone-300">
              {memoryConnectionId ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="font-medium text-emerald-900 dark:text-emerald-200">接続中（Active）</span>
                    </div>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md font-mono">
                      Google Drive
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                      接続ID (memory_connection_id)
                    </label>
                    <div className="flex items-center gap-2 p-2 bg-stone-100 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 font-mono text-xs text-stone-800 dark:text-stone-200 break-all">
                      <span className="flex-1">{memoryConnectionId}</span>
                      <button
                        type="button"
                        onClick={handleCopyConnectionId}
                        className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors shrink-0 cursor-pointer"
                        title="IDをコピー"
                      >
                        {copiedId ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                    ユーザー自身のGoogle Drive上のMemory領域がマウントされています。セッション実行時にパーソナライズされた食材や嗜好のコンテキストが反映されます。
                  </p>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      id="btn-open-rom-from-memory-modal"
                      onClick={() => {
                        setShowMemoryModal(false);
                        setShowMemoryRomModal(true);
                      }}
                      className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 border border-emerald-200 dark:border-emerald-800 rounded-xl font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                    >
                      <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>保存された記憶（ROM一覧）を確認</span>
                    </button>
                    <button
                      type="button"
                      id="btn-disconnect-memory"
                      onClick={handleDisconnectMemory}
                      className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/80 border border-red-200 dark:border-red-800 rounded-xl font-medium text-sm transition-colors cursor-pointer active:scale-98"
                    >
                      Memoryを切断する（Eject）
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMemoryModal(false)}
                      className="w-full py-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 text-sm font-medium cursor-pointer"
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
                    <div className="flex-grow border-t border-stone-200 dark:border-stone-750"></div>
                    <span className="flex-shrink mx-3 text-xs text-stone-400 dark:text-stone-500">または接続IDを直接入力</span>
                    <div className="flex-grow border-t border-stone-200 dark:border-stone-750"></div>
                  </div>

                  <form onSubmit={handleApplyManualMemoryId} className="space-y-2">
                    <input
                      id="input-manual-memory-id"
                      type="text"
                      value={manualMemoryId}
                      onChange={(e) => setManualMemoryId(e.target.value)}
                      placeholder="memory_connection_id を貼り付け"
                      className="w-full px-3 py-2 text-xs font-mono bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg focus:outline-emerald-500 focus:bg-white dark:focus:bg-stone-850 transition-colors"
                    />
                    <button
                      id="btn-apply-memory-id"
                      type="submit"
                      disabled={!manualMemoryId.trim()}
                      className="w-full py-2 px-3 bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 dark:hover:bg-stone-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowPhotoSheet(false)}
        >
          <div
            id="sheet-photo-content"
            className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/90">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-base">写真で相談する</h3>
              </div>
              <button
                type="button"
                id="btn-close-photo-sheet"
                onClick={() => setShowPhotoSheet(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                スーパーの商品、値札、特売シール、チラシ、手持ちの食材などを撮影または選択して、Shopping AIと相談できます。
              </p>

              <button
                type="button"
                id="btn-photo-action-camera"
                onClick={() => {
                  setShowPhotoSheet(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40 active:bg-emerald-100/50 dark:active:bg-emerald-900/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900 dark:text-stone-100 text-sm">その場でカメラ撮影</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">売り場の商品や値札、半額シールを直接撮影します</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 shrink-0" />
              </button>

              <button
                type="button"
                id="btn-photo-action-library"
                onClick={() => {
                  setShowPhotoSheet(false);
                  libraryInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40 active:bg-blue-100/50 dark:active:bg-blue-900/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900 dark:text-stone-100 text-sm">写真ライブラリから選択</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">保存済みの写真やチラシ画像を選びます</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-blue-700 dark:group-hover:text-blue-400 shrink-0" />
              </button>

              <button
                type="button"
                id="btn-cancel-photo-sheet"
                onClick={() => setShowPhotoSheet(false)}
                className="w-full py-2.5 text-center text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 bg-stone-100 dark:bg-stone-800 rounded-xl cursor-pointer active:scale-98 transition-all"
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
      {/* 11. Google Drive 記憶（ROM）管理モーダル */}
      <MemoryRomModal
        isOpen={showMemoryRomModal}
        onClose={() => setShowMemoryRomModal(false)}
        chatService={chatService}
        memoryConnectionId={memoryConnectionId}
        activeSessionId={activeSession?.id}
        activeSessionTitle={activeSession?.title}
        onOpenConnectModal={() => setShowMemoryModal(true)}
      />

      {/* 12. 設定モーダル（ダークモード切り替え・文字サイズ調整） */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        theme={theme}
        onThemeChange={setTheme}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
      />

      {/* 13. アプリ共通メニュー (App Menu Drawer) */}
      {showAppMenu && (
        <div
          id="menu-drawer-backdrop"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-end p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowAppMenu(false)}
        >
          <div
            id="menu-drawer-content"
            className="w-full sm:max-w-sm bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in slide-in-from-right sm:slide-in-from-bottom duration-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-900/90 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Shopping AI メニュー</h3>
              </div>
              <button
                type="button"
                id="btn-close-app-menu"
                onClick={() => setShowAppMenu(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="メニューを閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* 現在のセッションカード */}
              <div className="p-3 bg-stone-50 dark:bg-stone-800/70 rounded-2xl border border-stone-200 dark:border-stone-700/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    現在のセッション
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      activeSession.status === 'in_progress'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {activeSession.status === 'in_progress' ? '進行中' : '完了'}
                  </span>
                </div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{activeSession.title}</p>
                <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
                  <span className="font-mono text-[10.5px]">{activeSession.date}</span>
                  <button
                    type="button"
                    id="btn-menu-switch-session"
                    onClick={() => {
                      setShowAppMenu(false);
                      setShowSessionDrawer(true);
                    }}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    セッション一覧 ›
                  </button>
                </div>
              </div>

              {/* メニューアイテム一覧 */}
              <div className="space-y-1.5">
                {/* 1. セッション一覧 */}
                <button
                  type="button"
                  id="menu-item-sessions"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowSessionDrawer(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/80 text-stone-600 dark:text-stone-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center justify-center shrink-0 transition-colors">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">セッション一覧</span>
                      <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                        {sessions.length}件
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">セッションの切り替え・新規作成・削除</p>
                  </div>
                </button>

                {/* 2. 記憶（ROM）管理 */}
                <button
                  type="button"
                  id="menu-item-memory-rom"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowMemoryRomModal(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/80 text-stone-600 dark:text-stone-300 group-hover:text-amber-700 dark:group-hover:text-amber-300 flex items-center justify-center shrink-0 transition-colors">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">記憶（ROM）管理</span>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">Google Drive</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">献立・特売・食材ROMデータの確認</p>
                  </div>
                </button>

                {/* 3. 対話記録（全件ログ） */}
                <button
                  type="button"
                  id="menu-item-conversation-history"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowConversationReview(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/80 text-stone-600 dark:text-stone-300 group-hover:text-blue-700 dark:group-hover:text-blue-300 flex items-center justify-center shrink-0 transition-colors">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">対話記録（全件ログ）</span>
                      <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                        {conversationRecord.length}件
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">これまでのメッセージと相談写真の確認</p>
                  </div>
                </button>

                {/* 4. 状況・認識詳細ボード */}
                <button
                  type="button"
                  id="menu-item-status-detail"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowStatusDetailModal(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-950/80 text-stone-600 dark:text-stone-300 group-hover:text-teal-700 dark:group-hover:text-teal-300 flex items-center justify-center shrink-0 transition-colors">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">状況・認識詳細</span>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">前提条件・献立候補・手持ち食材の確認</p>
                  </div>
                </button>

                {/* 5. Google Drive 接続設定 */}
                <button
                  type="button"
                  id="menu-item-memory-setting"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowMemoryModal(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/80 text-stone-600 dark:text-stone-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center justify-center shrink-0 transition-colors">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Google Drive 接続設定</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          memoryConnectionId
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                            : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        {memoryConnectionId ? '接続中' : '未接続'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                      {memoryConnectionId
                        ? '接続状態の確認・切断'
                        : 'Google Driveと連携して長期記憶を有効化'}
                    </p>
                  </div>
                </button>

                {/* 6. 設定（ダークモード切り替え・文字サイズ） */}
                <button
                  type="button"
                  id="menu-item-settings"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-950/80 text-stone-600 dark:text-stone-300 group-hover:text-purple-700 dark:group-hover:text-purple-300 flex items-center justify-center shrink-0 transition-colors">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">設定</span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                        {theme === 'dark' ? 'ダーク' : theme === 'light' ? 'ライト' : '自動'} / {fontSize === 'small' ? '小' : fontSize === 'standard' ? '標準' : fontSize === 'large' ? '大' : '特大'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                      ダークモード・文字の大きさ調整
                    </p>
                  </div>
                </button>
              </div>

              {/* 新規セッション開始ボタン */}
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  id="menu-action-new-session"
                  onClick={() => {
                    setShowAppMenu(false);
                    handleCreateSession();
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>新しいセッションを開始</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
