import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  ArrowUp,
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
  Newspaper,
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
import { FlyerModal } from './FlyerModal';
import { SettingsModal } from './SettingsModal';
import { SessionImagesModal } from './SessionImagesModal';

interface ShoppingAIChatProps {
  chatService?: ChatService;
}

export const PHOTO_INTERNAL_PROMPT =
  'スーパーで見つけた商品・食材の写真です。現在の会話や候補と合わせて判断材料として教えてください。';

export const getDisplayMessageContent = (content: string, imageUrl?: string): string => {
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

export const getExpertDisplayLabel = (expertMode?: string | null): string | null => {
  if (!expertMode) return null;
  const lower = expertMode.toLowerCase();
  if (lower.includes('meat') || lower.includes('肉') || lower.includes('精肉')) return '精肉専門';
  if (lower.includes('fish') || lower.includes('魚') || lower.includes('鮮魚')) return '鮮魚専門';
  if (lower.includes('vegetable') || lower.includes('vege') || lower.includes('produce') || lower.includes('野菜') || lower.includes('青果')) return '青果専門';
  if (lower.includes('cook') || lower.includes('chef') || lower.includes('料理') || lower.includes('調理')) return '調理専門';
  if (lower.includes('bargain') || lower.includes('offer') || lower.includes('特売') || lower.includes('目利き')) return '目利き専門';
  return expertMode.endsWith('専門') ? expertMode : `${expertMode}専門`;
};

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
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [showSessionImagesModal, setShowSessionImagesModal] = useState(false);
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
  const [selectedImageFilename, setSelectedImageFilename] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

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

  // テキストエリア自動伸縮（ChatGPTスタイル：文字入力時のみ必要な分だけ縦に伸長、空の時は1行に戻る）
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (input.trim()) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
      }
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
      setSelectedImageFilename(file.name || null);
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

    const isPhotoOnly = !textToSend && !!imageToSend;
    const displayContent = isPhotoOnly ? '写真' : textToSend;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: displayContent,
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
    setSelectedImageFilename(null);
    setPhotoError(null);
    setIsTyping(true);

    try {
      // Backendへ送信（現在セッションIDも伝達、写真のみ送信時は内部用補助文をバックエンドに連携）
      const promptForBackend = isPhotoOnly ? PHOTO_INTERNAL_PROMPT : textToSend;
      const response = await chatService.sendMessage(
        newRecord,
        promptForBackend,
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

  // 返信欄用：通常のプレイ画面はチャット履歴UIではなく、「今のAIからの最新返答」を表示する
  const latestAssistantMsg = [...conversationRecord].reverse().find((m) => m.role === 'assistant');
  const latestUserMsg = [...conversationRecord].reverse().find((m) => m.role === 'user');

  // 会話欄フォントサイズの基準定義（標準と大の差を明確化し、上部シーン文字との調和を保つ）
  const getMessageFontSizeClass = (size: typeof fontSize) => {
    switch (size) {
      case 'small':
        return 'text-[13.5px] leading-relaxed';
      case 'standard':
        return 'text-[15px] leading-relaxed'; // 標準：すっきりと整った日常使いサイズ
      case 'large':
        return 'text-[17.5px] leading-[1.7]'; // 大：見た目に違いがハッキリわかり、上部シーン文字（15〜16px）と調和する基準
      case 'extra_large':
        return 'text-[19.5px] leading-[1.7]';
      default:
        return 'text-[15px] leading-relaxed';
    }
  };

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

          {/* 右側：新規セッション ＆ メニューボタン（履歴ボタンは背景シーン左上に移動） */}
          <div className="flex items-center gap-1.5 shrink-0">
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

      {/* 2. メイン画面の横長シーン領域（背景＋ポコ太のサイズ感を基準として固定） */}
      <section
        id="stage-scene-main"
        aria-label="現在のシーンとキャラクター"
        className="h-[270px] sm:h-[285px] shrink-0 p-2 sm:p-2.5 bg-stone-100/90 dark:bg-stone-900/90 border-b border-stone-200 dark:border-stone-800 transition-colors flex flex-col"
      >
        <CompanionSceneStage
          scene={activeSession.currentScene || 'planning'}
          expertMode={activeSession.expertMode}
          statusSummary={activeSession.statusSummary}
          isTyping={isTyping}
          onOpenStatusDetail={() => setShowStatusDetailModal(true)}
          onOpenHistory={() => setShowConversationReview(true)}
          historyCount={conversationRecord.length}
        />
      </section>

      {/* 3. Shopping AIの返信 & 対話領域 */}
      <section
        id="stage-lower-dialogue"
        aria-label="Shopping AIの返信と対話"
        className="flex-1 min-h-0 flex flex-col bg-white dark:bg-stone-900 transition-colors"
      >
        {/* チャットメッセージ表示部：過去の返信は積み重ねず、現在の最新返信だけを表示 */}
        <main
          id="chat-messages-container"
          className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-3 overscroll-contain bg-stone-50/40 dark:bg-stone-950/40 transition-colors"
        >
          {/* A. AI思考中（送信後〜返答受信までの状態）：直前の相談とポコ太の考え中インジケータ */}
          {isTyping ? (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* 直前のユーザー相談 */}
              {latestUserMsg && (
                <div className="flex flex-col items-end w-full">
                  <div className="relative w-full sm:max-w-[92%] rounded-2xl px-3.5 sm:px-4 py-3 bg-emerald-600 text-white rounded-tr-xs shadow-xs font-normal break-words whitespace-pre-wrap">
                    {latestUserMsg.imageUrl && (
                      <div className="mb-2.5 overflow-hidden rounded-xl bg-black/15">
                        <img
                          src={latestUserMsg.imageUrl}
                          alt="相談写真"
                          className="w-full max-h-56 object-cover rounded-xl cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
                          onClick={() => setPreviewModalImage(latestUserMsg.imageUrl || null)}
                        />
                        <div className="flex items-center justify-end px-1.5 py-1 text-[11px] opacity-85 gap-1 text-white">
                          <ZoomIn className="w-3 h-3" />
                          <span>タップして拡大</span>
                        </div>
                      </div>
                    )}
                    {getDisplayMessageContent(latestUserMsg.content, latestUserMsg.imageUrl)}
                  </div>
                </div>
              )}

              {/* ポコ太の思考中インジケータ */}
              <div className="flex flex-col items-start w-full">
                <div className="flex items-center gap-1.5 mb-1 pl-1">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs shrink-0">
                    ポ
                  </div>
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    ポコ太
                  </span>
                  {getExpertDisplayLabel(activeSession.expertMode) && (
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded font-semibold border border-purple-200 dark:border-purple-800">
                      {getExpertDisplayLabel(activeSession.expertMode)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl rounded-tl-xs px-4 py-3 text-stone-600 dark:text-stone-300 text-xs shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="ml-1 font-medium">ポコ太が回答を考え中...</span>
                </div>
              </div>
            </div>
          ) : latestAssistantMsg ? (
            /* B. 通常時：最新のAI返信のみを表示（過去の返信は積み重ねず置き換える） */
            <div
              key={latestAssistantMsg.id}
              id={`message-row-${latestAssistantMsg.id}`}
              className="flex flex-col w-full items-start animate-in fade-in duration-150"
            >
              {/* 直前の相談コンテキスト（写真のみ送信の場合は「写真」） */}
              {latestUserMsg && (
                <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-lg bg-stone-100/90 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 text-xs text-stone-600 dark:text-stone-400 w-fit max-w-full">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">相談:</span>
                  <span className="truncate max-w-[240px] sm:max-w-md font-medium text-stone-800 dark:text-stone-200">
                    {getDisplayMessageContent(latestUserMsg.content, latestUserMsg.imageUrl)}
                  </span>
                  {latestUserMsg.imageUrl && (
                    <span className="shrink-0 text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded font-medium border border-emerald-200 dark:border-emerald-800">
                      写真あり
                    </span>
                  )}
                </div>
              )}

              {/* アシスタント発話ヘッダー */}
              <div className="flex items-center gap-1.5 mb-1 pl-1">
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs shrink-0">
                  ポ
                </div>
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  ポコ太
                </span>
                {getExpertDisplayLabel(activeSession.expertMode) && (
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded font-semibold border border-purple-200 dark:border-purple-800">
                    {getExpertDisplayLabel(activeSession.expertMode)}
                  </span>
                )}
              </div>

              {/* Balloon: スマホでは横幅いっぱいにフィット (w-full max-w-full) */}
              <div
                className={`relative w-full sm:max-w-[92%] rounded-2xl px-3.5 sm:px-4 py-3 ${getMessageFontSizeClass(
                  fontSize
                )} break-words whitespace-pre-wrap transition-all bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-tl-xs shadow-2xs group`}
              >
                {latestAssistantMsg.imageUrl && (
                  <div className="mb-2.5 overflow-hidden rounded-xl bg-black/15">
                    <img
                      src={latestAssistantMsg.imageUrl}
                      alt="相談写真"
                      className="w-full max-h-60 object-cover rounded-xl cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
                      onClick={() => setPreviewModalImage(latestAssistantMsg.imageUrl || null)}
                    />
                    <div className="flex items-center justify-end px-1.5 py-1 text-[11px] opacity-85 gap-1 text-white">
                      <ZoomIn className="w-3 h-3" />
                      <span>タップして拡大</span>
                    </div>
                  </div>
                )}
                {getDisplayMessageContent(latestAssistantMsg.content, latestAssistantMsg.imageUrl)}
              </div>

              {/* Inline Decision Support (AI側のみ) */}
              {latestAssistantMsg.decisionData && (
                <div className="w-full sm:max-w-[92%] mt-2.5 space-y-2.5">
                  {/* 状況整理タグ (Context Understanding) */}
                  {latestAssistantMsg.decisionData.contextSummary && (
                    <div className="bg-stone-100/90 dark:bg-stone-800/90 rounded-xl p-2.5 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 space-y-1">
                      <div className="font-medium text-stone-700 dark:text-stone-200 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        理解した条件:
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {latestAssistantMsg.decisionData.contextSummary.timeLimit && (
                          <span className="inline-flex items-center gap-1 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-200 text-[11px]">
                            <Clock className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                            {latestAssistantMsg.decisionData.contextSummary.timeLimit}
                          </span>
                        )}
                        {latestAssistantMsg.decisionData.contextSummary.availableIngredients?.map((ing, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-200 text-[11px]"
                          >
                            <Utensils className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                            {ing}
                          </span>
                        ))}
                        {latestAssistantMsg.decisionData.contextSummary.moodOrPreference && (
                          <span className="inline-flex items-center gap-1 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-200 text-[11px]">
                            {latestAssistantMsg.decisionData.contextSummary.moodOrPreference}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 選択肢カード (ユーザーが選べる可能性の提示) */}
                  {latestAssistantMsg.decisionData.options && latestAssistantMsg.decisionData.options.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 px-1">
                        現在の候補・選択肢（タップして深掘り）:
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {latestAssistantMsg.decisionData.options.map((opt) => (
                          <button
                            key={opt.id}
                            id={`btn-option-${opt.id}`}
                            onClick={() => handleOptionSelect(opt)}
                            className="w-full text-left bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 active:bg-stone-100 dark:active:bg-stone-700 border border-stone-200 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl p-3 transition-all shadow-2xs group cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h2 className={`font-semibold text-stone-900 dark:text-stone-100 ${
                                fontSize === 'large' || fontSize === 'extra_large' ? 'text-[13.5px]' : 'text-xs'
                              } group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors`}>
                                {opt.title}
                              </h2>
                              <ChevronRight className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
                            </div>
                            {opt.summary && (
                              <p className={`${
                                fontSize === 'large' || fontSize === 'extra_large' ? 'text-[13px]' : 'text-xs'
                              } text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed`}>{opt.summary}</p>
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
              <div className="flex items-center justify-between gap-2 mt-1.5 px-1 text-[11px] text-stone-400 dark:text-stone-500 w-full sm:max-w-[92%]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* コピーボタン（回答欄の左下に常に固定） */}
                  <button
                    type="button"
                    id={`btn-copy-msg-${latestAssistantMsg.id}`}
                    onClick={() => handleCopyMessage(latestAssistantMsg.id, latestAssistantMsg.content)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-all cursor-pointer active:scale-95 border text-xs shadow-2xs shrink-0 ${
                      copiedMessageId === latestAssistantMsg.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-medium'
                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700'
                    }`}
                    title="メッセージ内容をワンタップでコピー"
                    aria-label="返信内容をコピー"
                  >
                    {copiedMessageId === latestAssistantMsg.id ? (
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
                  {latestAssistantMsg.decisionData?.quickReplies && latestAssistantMsg.decisionData.quickReplies.length > 0 && (
                    <button
                      type="button"
                      id={`btn-toggle-quick-replies-${latestAssistantMsg.id}`}
                      onClick={() => toggleQuickReplies(latestAssistantMsg.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-emerald-700 dark:text-stone-400 dark:hover:text-emerald-400 bg-stone-100/90 dark:bg-stone-800/90 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-stone-200 dark:border-stone-700 rounded-full px-2.5 py-0.5 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>返信候補 ({latestAssistantMsg.decisionData.quickReplies.length})</span>
                      {expandedQuickReplies[latestAssistantMsg.id] ? (
                        <ChevronUp className="w-3 h-3 ml-0.5 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-3 h-3 ml-0.5 text-stone-400" />
                      )}
                    </button>
                  )}
                </div>

                <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono shrink-0 ml-auto">
                  {new Date(latestAssistantMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* 返信候補が展開された場合のチップ一覧（下部にスライド展開） */}
              {latestAssistantMsg.decisionData?.quickReplies &&
                latestAssistantMsg.decisionData.quickReplies.length > 0 &&
                expandedQuickReplies[latestAssistantMsg.id] && (
                  <div className="w-full sm:max-w-[92%] mt-1.5 pl-0.5 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {latestAssistantMsg.decisionData.quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        id={`btn-quick-reply-${i}`}
                        onClick={() => handleSend(reply)}
                        className={`${
                          fontSize === 'large' || fontSize === 'extra_large' ? 'text-[13px]' : 'text-xs'
                        } bg-white dark:bg-stone-800 active:bg-stone-100 dark:active:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-600 hover:border-emerald-600 dark:hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-3 py-1.5 rounded-full transition-colors shadow-2xs cursor-pointer font-normal`}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <div className="text-center py-10 text-stone-400 dark:text-stone-500 text-xs">
              ポコ太へメッセージや写真をお送りください。
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

      {/* 5. Input Form (ChatGPTスタイル: 通常時は ＋ メッセージ… 📷 ↑ のコンパクトな1行) */}
      <footer id="chat-input-footer" className="p-2 sm:p-2.5 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 shrink-0 transition-colors relative">
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

        {/* ＋ アクションメニュー（ポップオーバー） */}
        {showPlusMenu && (
          <div
            id="plus-action-menu"
            className="absolute bottom-full left-2 sm:left-3 mb-2 w-64 bg-white dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl p-1.5 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 px-2.5 py-1">
              アクション
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPlusMenu(false);
                setShowPhotoSheet(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-xl transition-colors text-left cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>写真で相談（カメラ・アルバム）</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPlusMenu(false);
                setShowFlyerModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-xl transition-colors text-left cursor-pointer"
            >
              <Newspaper className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>特売チラシを見る・登録</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPlusMenu(false);
                setShowConversationReview(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-xl transition-colors text-left cursor-pointer"
            >
              <History className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>対話履歴を確認</span>
            </button>
            <div className="border-t border-stone-100 dark:border-stone-750 my-1" />
            <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 px-2.5 py-1">
              よくある質問
            </div>
            {[
              '今の候補と比べてどっちがいい？',
              '今日中に使い切るなら買い？',
              'おすすめの副菜を教えて',
            ].map((suggestText) => (
              <button
                key={suggestText}
                type="button"
                onClick={() => {
                  setInput(suggestText);
                  setShowPlusMenu(false);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="w-full px-2.5 py-1.5 text-[11px] text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-left truncate cursor-pointer"
              >
                {suggestText}
              </button>
            ))}
          </div>
        )}

        {/* 写真最適化中ローダー */}
        {isProcessingPhoto && (
          <div className="mb-1.5 p-1.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300 animate-in fade-in duration-100">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px]">写真を準備中...</span>
          </div>
        )}

        {/* 写真エラー表示 */}
        {photoError && (
          <div className="mb-1.5 p-1.5 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-100">
            <span className="text-[11px]">{photoError}</span>
            <button
              type="button"
              onClick={() => setPhotoError(null)}
              className="p-0.5 text-rose-500 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 rounded-full cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 写真選択時のみ表示されるスリムな添付バナー */}
        {selectedImage && (
          <div className="mb-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={selectedImage}
                alt="選択中の相談写真"
                className="w-6 h-6 rounded-md object-cover border border-emerald-300 dark:border-emerald-700 cursor-pointer shrink-0"
                onClick={() => setPreviewModalImage(selectedImage)}
              />
              <span className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 truncate">
                写真添付中（タップで拡大）
              </span>
            </div>
            <button
              type="button"
              id="btn-remove-selected-photo"
              onClick={() => {
                setSelectedImage(null);
                setSelectedImageFilename(null);
              }}
              className="w-5 h-5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="写真を解除"
              aria-label="写真を解除"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ＋  メッセージ…       📷  ↑  コンパクト入力バー */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-1.5 sm:gap-2"
        >
          {/* ＋ ボタン */}
          <button
            id="btn-input-plus"
            type="button"
            onClick={() => setShowPlusMenu(!showPlusMenu)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95 touch-manipulation ${
              showPlusMenu
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500'
                : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
            }`}
            title="アクションメニュー（写真・チラシ・履歴・質問候補）"
            aria-label="アクションメニュー"
          >
            <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* メッセージ入力欄（通常時1行・入力時のみ必要な分だけ縦に伸長） */}
          <div className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-stone-850 transition-colors px-3 py-1 flex items-center min-h-[38px] sm:min-h-[40px]">
            <textarea
              id="input-chat-message"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージ…"
              rows={1}
              className="w-full resize-none bg-transparent border-0 focus:outline-hidden text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 max-h-32 py-1 leading-relaxed"
            />
          </div>

          {/* 📷 カメラボタン */}
          <button
            id="btn-photo-consult"
            type="button"
            onClick={() => setShowPhotoSheet(true)}
            disabled={isTyping || isProcessingPhoto}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95 touch-manipulation relative disabled:opacity-40 ${
              selectedImage
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500'
                : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
            }`}
            title="写真で相談（カメラ撮影・アルバム選択）"
            aria-label="写真で相談"
          >
            <Camera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {selectedImage && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* ↑ 送信ボタン */}
          <button
            id="btn-send-message"
            type="submit"
            disabled={(!input.trim() && !selectedImage) || isTyping || isProcessingPhoto}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 touch-manipulation shadow-xs cursor-pointer active:scale-95 ${
              (input.trim() || selectedImage) && !isTyping && !isProcessingPhoto
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
            }`}
            title="送信"
            aria-label="送信"
          >
            <ArrowUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
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
        onOpenSessionImages={() => setShowSessionImagesModal(true)}
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
        onOpenSessionImages={(sid) => {
          if (sid && sid !== activeSessionId) {
            handleSelectSession(sid);
          }
          setShowSessionImagesModal(true);
        }}
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
        onOpenSessionImages={() => setShowSessionImagesModal(true)}
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

              {/* このセッションの過去の写真を見る (Session Images on Google Drive) */}
              <button
                type="button"
                id="btn-photo-action-session-images"
                onClick={() => {
                  setShowPhotoSheet(false);
                  setShowSessionImagesModal(true);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40 active:bg-emerald-100/50 dark:active:bg-emerald-900/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 text-sm">このセッションの過去の写真</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/70 px-1.5 py-0.2 rounded font-mono font-medium">Drive</span>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">この買い物セッション中に保存した写真を再利用</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 shrink-0" />
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

      {/* 11-b. チラシ管理・登録モーダル (Shared Flyer) */}
      <FlyerModal
        isOpen={showFlyerModal}
        onClose={() => setShowFlyerModal(false)}
        chatService={chatService}
        memoryConnectionId={memoryConnectionId}
        onOpenConnectModal={() => {
          setShowFlyerModal(false);
          setShowMemoryModal(true);
        }}
        onPreviewImage={(url) => setPreviewModalImage(url)}
      />

      {/* 11-c. このセッションの写真モーダル (Session Images on Google Drive) */}
      <SessionImagesModal
        isOpen={showSessionImagesModal}
        onClose={() => setShowSessionImagesModal(false)}
        sessionId={activeSession.id}
        sessionTitle={activeSession.title}
        chatService={chatService}
        memoryConnectionId={memoryConnectionId}
        onSelectImageForConsultation={(imageDataUrl, filename) => {
          setSelectedImage(imageDataUrl);
          setSelectedImageFilename(filename || 'session_photo.jpg');
          setPhotoError(null);
        }}
        onOpenMemoryConnect={() => setShowMemoryModal(true)}
        onPreviewImage={(url) => setPreviewModalImage(url)}
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

                {/* 2. チラシ（Shared Flyer） */}
                <button
                  type="button"
                  id="menu-item-flyer"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowFlyerModal(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/80 text-stone-600 dark:text-stone-300 group-hover:text-orange-700 dark:group-hover:text-orange-300 flex items-center justify-center shrink-0 transition-colors">
                    <Newspaper className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">チラシ</span>
                      <span className="text-[10px] text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded-full font-medium">
                        共有データ
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">買い物用のチラシを登録・撮影・確認</p>
                  </div>
                </button>

                {/* 2-b. このセッションの写真 (Session Images on Google Drive) */}
                <button
                  type="button"
                  id="menu-item-session-images"
                  onClick={() => {
                    setShowAppMenu(false);
                    setShowSessionImagesModal(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 transition-colors text-left cursor-pointer group border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/80 text-stone-600 dark:text-stone-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center justify-center shrink-0 transition-colors">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">このセッションの写真</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-medium">
                        セッション限定
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">この買い物でDriveに保存された過去写真</p>
                  </div>
                </button>

                {/* 3. 記憶（ROM）管理 */}
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
