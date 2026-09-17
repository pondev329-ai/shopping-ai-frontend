import { ChatMessage, ChatResponse, InlineDecisionPayload, SuggestionOption, AppScene } from '../types/chat';
import {
  MemoryRomItem,
  ListMemoryRomParams,
  ListMemoryRomResult,
  DeleteMemoryRomParams,
  DeleteMemoryRomResult,
  classifyMemoryRomType,
  GetConversationTimelineParams,
  GetConversationTimelineResult,
  MemoryTimelineRecord,
} from '../types/memory';

/**
 * ChatService
 * 
 * フロントエンドとバックエンドの通信境界を定義するインターフェースです。
 * Shopping AIの意思決定・推論・レシピ判定ロジックはフロントエンドには持たせず、
 * バックエンド（Render Backend）へのメッセージ送信および
 * 実行結果（回答テキスト、判断材料、選択肢）の受領のみを規定します。
 */
export interface ChatService {
  sendMessage(history: ChatMessage[], userText: string, imageUrl?: string, sessionId?: string): Promise<ChatResponse>;
  resetConversation?(): void;
  getBackendState?(): Record<string, unknown> | null;
  setBackendState?(state: Record<string, unknown> | null): void;
  getMemoryConnectionId?(): string | null;
  setMemoryConnectionId?(id: string | null): void;
  disconnectMemory?(): Promise<void>;
  deleteMemorySession?(sessionId: string, connectionId?: string): Promise<{ success: boolean; error?: string }>;
  getMemorySession?(sessionId: string, connectionId?: string): Promise<{ success: boolean; state?: Record<string, unknown> | null; error?: string }>;
  getConversationTimeline?(sessionId: string, connectionId?: string): Promise<GetConversationTimelineResult>;
  listMemoryRom?(params?: ListMemoryRomParams): Promise<ListMemoryRomResult>;
  deleteMemoryRomItem?(params: DeleteMemoryRomParams): Promise<DeleteMemoryRomResult>;
  onMemoryConnectionChange?(callback: (id: string | null) => void): () => void;
  getMemoryConnectUrl?(): string;
}

/**
 * Render Backendのレスポンス型
 */
interface JinbaBackendRunResponse {
  ok: boolean;
  result?: {
    reply?: string;
    parse_success?: boolean;
    current_scene?: string;
    expert_mode?: string | null;
    state?: {
      current_scene?: string;
      expert_mode?: string | null;
      scene?: string;
      expert?: string | null;
      history?: Array<{ role: string; content: string }>;
      possibility_context?: {
        meal_options?: Array<{
          id?: string;
          title?: string;
          name?: string;
          summary?: string;
          description?: string;
          reasons?: string[];
          prep_time_minutes?: number;
          prepTimeMinutes?: number;
          effort_level?: 'very_easy' | 'moderate' | 'involved';
          effortLevel?: 'very_easy' | 'moderate' | 'involved';
          additional_groceries?: string[];
          additionalGroceries?: string[];
          requires_shopping?: boolean;
          requiresShopping?: boolean;
        }>;
        recipe_catalog?: Array<{
          id?: string;
          title?: string;
          name?: string;
          url?: string;
        }>;
        ingredients?: Array<unknown>;
        offers?: Array<unknown>;
      };
      session_context?: {
        priorities?: string[];
        shopping_or_home?: string;
        current_scene?: string;
        expert_mode?: string | null;
        decided?: string[];
        undecided?: string[];
      };
      shopping_context?: {
        inventory?: string[];
        selected_product_ids?: string[];
        progress?: {
          total?: number;
          collected?: number;
          step?: string;
        };
      };
    };
  };
  error?: string;
}

/**
 * RenderBackendChatAdapter
 * 
 * Render Backend (https://shopping-ai-jinba-dev.onrender.com) へ
 * ユーザーのメッセージを送信し、Shopping AI Main Flow の実行結果を取得するアダプターです。
 */
export class RenderBackendChatAdapter implements ChatService {
  private endpoint: string;
  private baseUrl: string;
  private backendState: Record<string, unknown> | null = null;
  private memoryConnectionId: string | null = null;
  private readonly STORAGE_KEY = 'shopping_ai_backend_state';
  private readonly MEMORY_STORAGE_KEY = 'shopping_ai_memory_connection_id';
  private memoryListeners: Set<(id: string | null) => void> = new Set();

  constructor(endpoint?: string) {
    // Vite開発環境のプロキシ (/api/render-backend) または環境変数/直接URL
    const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
    const envUrl = metaEnv?.VITE_RENDER_BACKEND_URL;

    if (endpoint) {
      this.endpoint = endpoint;
      this.baseUrl = endpoint.replace(/\/run\/?$/, '');
    } else if (metaEnv?.DEV) {
      // 開発・プレビューサーバー内ではViteプロキシ経由でCORSを安全に回避
      this.baseUrl = '/api/render-backend';
      this.endpoint = '/api/render-backend/run';
    } else if (envUrl) {
      this.baseUrl = envUrl.replace(/\/+$/, '');
      this.endpoint = `${this.baseUrl}/run`;
    } else {
      this.baseUrl = 'https://shopping-ai-jinba-dev.onrender.com';
      this.endpoint = 'https://shopping-ai-jinba-dev.onrender.com/run';
    }

    // 保存されている前回のバックエンドStateがあれば復元
    this.restoreState();

    // Google Drive Memory 接続IDの復元・URLパラメータ/メッセージ待受
    this.restoreMemoryConnection();
  }

  private restoreState(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.backendState = JSON.parse(saved);
      }
    } catch {
      this.backendState = null;
    }
  }

  private persistState(state: Record<string, unknown> | null): void {
    this.backendState = state;
    try {
      if (state) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch {
      // ignore storage quota error
    }
  }

  private restoreMemoryConnection(): void {
    try {
      // 1. URLクエリパラメータまたはHashから OAuth完了後の memory_connection_id を検出
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const capturedId = urlParams.get('memory_connection_id') || urlParams.get('memory_id') || urlParams.get('connection_id');
        if (capturedId && capturedId.trim()) {
          this.setMemoryConnectionId(capturedId.trim());

          // ブラウザのアドレスバーから接続IDを安全に除去（履歴を汚さずリロード時の重複取得を防止）
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('memory_connection_id');
          cleanUrl.searchParams.delete('memory_id');
          cleanUrl.searchParams.delete('connection_id');
          window.history.replaceState({}, document.title, cleanUrl.toString());
          return;
        }

        // URL hash (フラグメント) からの検出
        if (window.location.hash && window.location.hash.includes('memory_connection_id=')) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const hashId = hashParams.get('memory_connection_id');
          if (hashId && hashId.trim()) {
            this.setMemoryConnectionId(hashId.trim());
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            return;
          }
        }

        // 2. OAuth ポップアップ等からの postMessage を待受
        window.addEventListener('message', (event) => {
          if (event.data && typeof event.data === 'object') {
            const msgId = event.data.memory_connection_id || event.data.memoryConnectionId;
            if (typeof msgId === 'string' && msgId.trim().length > 0) {
              this.setMemoryConnectionId(msgId.trim());
            }
          }
        });

        // 3. 別タブでOAuthが完了した場合の localStorage 同期待受
        window.addEventListener('storage', (event) => {
          if (event.key === this.MEMORY_STORAGE_KEY) {
            const newId = event.newValue && event.newValue.trim().length > 0 ? event.newValue.trim() : null;
            this.memoryConnectionId = newId;
            this.memoryListeners.forEach((listener) => {
              try {
                listener(newId);
              } catch {
                // ignore
              }
            });
          }
        });
      }

      // 4. ストレージから前回の接続IDを復元
      const saved = localStorage.getItem(this.MEMORY_STORAGE_KEY);
      if (saved && saved.trim()) {
        this.memoryConnectionId = saved.trim();
      }
    } catch {
      this.memoryConnectionId = null;
    }
  }

  getMemoryConnectionId(): string | null {
    return this.memoryConnectionId;
  }

  /**
   * 現在のフロントエンド公開URL（GitHub Pages または AI Studio/Localhost）を付与した
   * Google Drive Memory の OAuth 接続用URLを生成します。
   */
  getMemoryConnectUrl(): string {
    const renderConnectBase = `${this.baseUrl}/memory/connect`;
    if (typeof window !== 'undefined') {
      try {
        const currentUrl = new URL(window.location.href);
        // クエリやハッシュを除去した純粋な公開パス（例: https://user.github.io/repo/）
        const cleanFrontendUrl = `${currentUrl.origin}${currentUrl.pathname}`;
        const connectUrl = new URL(renderConnectBase.startsWith('http') ? renderConnectBase : `${window.location.origin}${renderConnectBase}`);
        connectUrl.searchParams.set('frontend_url', cleanFrontendUrl);
        connectUrl.searchParams.set('return_to', cleanFrontendUrl);
        connectUrl.searchParams.set('redirect_uri', cleanFrontendUrl);
        return connectUrl.toString();
      } catch {
        return renderConnectBase;
      }
    }
    return renderConnectBase;
  }

  setMemoryConnectionId(id: string | null): void {
    this.memoryConnectionId = id && id.trim().length > 0 ? id.trim() : null;
    try {
      if (this.memoryConnectionId) {
        localStorage.setItem(this.MEMORY_STORAGE_KEY, this.memoryConnectionId);
      } else {
        localStorage.removeItem(this.MEMORY_STORAGE_KEY);
      }
    } catch {
      // ignore
    }

    // 接続状態変更を通知
    this.memoryListeners.forEach((listener) => {
      try {
        listener(this.memoryConnectionId);
      } catch {
        // ignore listener error
      }
    });
  }

  onMemoryConnectionChange(callback: (id: string | null) => void): () => void {
    this.memoryListeners.add(callback);
    return () => {
      this.memoryListeners.delete(callback);
    };
  }

  async disconnectMemory(): Promise<void> {
    const activeId = this.memoryConnectionId;
    // フロントエンドの接続IDを即座に破棄（切断）
    this.setMemoryConnectionId(null);

    // Render Backend 側にも切断（登録解除）をリクエスト
    if (activeId) {
      try {
        await fetch(`${this.baseUrl}/memory/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memory_connection_id: activeId }),
        });
      } catch {
        // ネットワーク切断時でもフロントエンド側の破棄は完了済み
      }
    }
  }

  /**
   * Google Drive Memory上のセッションデータを削除します。
   * Flow: Frontend -> Render /memory/session/delete -> Memory Runner -> Memory Flow delete_session -> Google Drive
   * 
   * 送信ペイロード:
   * {
   *   "memory_connection_id": "<現在接続中のGoogle Drive connection id>",
   *   "session_id": "<削除対象のsession id>"
   * }
   */
  async deleteMemorySession(sessionId: string, connectionId?: string): Promise<{ success: boolean; error?: string }> {
    const activeConnectionId = (connectionId ?? this.memoryConnectionId)?.trim();
    if (!activeConnectionId || activeConnectionId === 'null' || activeConnectionId === 'undefined') {
      // Memory未接続の場合は削除対象のGoogle Driveデータが存在しないため、成功として扱う
      return { success: true };
    }
    const deleteUrl = `${this.baseUrl}/memory/session/delete`;
    const payload = {
      memory_connection_id: activeConnectionId,
      session_id: sessionId,
    };

    try {
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail || errData.error || errData.message) {
            errorDetail = errData.detail || errData.error || errData.message;
          }
        } catch {
          try {
            const errText = await response.text();
            if (errText) errorDetail = errText;
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          error: `Memoryセッション削除に失敗しました (${errorDetail})`,
        };
      }

      const resData = await response.json().catch(() => ({ ok: true }));
      if (resData && (resData.ok === false || resData.success === false)) {
        return {
          success: false,
          error: resData.error || resData.message || resData.detail || 'Memoryセッション削除に失敗しました',
        };
      }

      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ネットワーク通信エラー';
      return {
        success: false,
        error: `通信エラー: ${errMsg}`,
      };
    }
  }

  /**
   * Google Drive Memory上のSession ROM（復元用コンテキスト状態）を取得します。
   * Flow: Frontend -> Render /memory/session/get -> Memory Runner -> Memory Flow get_session -> Google Drive
   * 
   * 送信ペイロード:
   * {
   *   "memory_connection_id": "<現在接続中のGoogle Drive connection id>",
   *   "session_id": "<復元対象のsession id>"
   * }
   * 
   * 戻り値:
   * 復元に必要なバックエンドState（possibility_context, session_context, shopping_context 等）
   */
  async getMemorySession(sessionId: string, connectionId?: string): Promise<{ success: boolean; state?: Record<string, unknown> | null; error?: string }> {
    const activeConnectionId = (connectionId ?? this.memoryConnectionId)?.trim();
    if (!activeConnectionId || activeConnectionId === 'null' || activeConnectionId === 'undefined') {
      return { success: false, error: 'Memory未接続です' };
    }
    const getUrl = `${this.baseUrl}/memory/session/get`;
    const payload = {
      memory_connection_id: activeConnectionId,
      session_id: sessionId,
    };

    try {
      const response = await fetch(getUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail || errData.error || errData.message) {
            errorDetail = errData.detail || errData.error || errData.message;
          }
        } catch {
          try {
            const errText = await response.text();
            if (errText) errorDetail = errText;
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          error: `Session ROM取得に失敗しました (${errorDetail})`,
        };
      }

      const resData = await response.json().catch(() => null);
      if (!resData) {
        return { success: false, error: '有効なレスポンスを受信できませんでした' };
      }

      if (resData.ok === false || resData.success === false) {
        return {
          success: false,
          error: resData.error || resData.message || resData.detail || 'Session ROM取得に失敗しました',
        };
      }

      // レスポンスからセッション復元用stateを抽出
      // 形式の柔軟なサポート: resData.state, resData.result.state, resData.session_rom.state, resData.session_state 等
      const extractedState =
        resData.state ||
        resData.result?.state ||
        resData.session_rom?.state ||
        resData.session_rom ||
        resData.session_state ||
        (resData.possibility_context || resData.session_context || resData.shopping_context ? resData : null);

      return {
        success: true,
        state: extractedState && typeof extractedState === 'object' ? (extractedState as Record<string, unknown>) : null,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ネットワーク通信エラー';
      return {
        success: false,
        error: `通信エラー: ${errMsg}`,
      };
    }
  }

  /**
   * Google Drive Memory上のConversation Record（対話記録ログ）を取得します。
   * Flow: Frontend -> Render /memory/timeline/get -> Memory Runner -> Memory Flow get_timeline -> Google Drive
   * 
   * 送信ペイロード:
   * {
   *   "memory_connection_id": "<現在接続中のGoogle Drive connection id>",
   *   "session_id": "<対象セッションID>"
   * }
   * 
   * 取得したConversation Recordの各レコード（role, content, occurred_at, event_id 等）を
   * フロントエンドのChatMessage形式に正規化して返却します。
   */
  async getConversationTimeline(
    sessionId: string,
    connectionId?: string
  ): Promise<GetConversationTimelineResult> {
    const activeConnectionId = (connectionId ?? this.memoryConnectionId)?.trim();
    if (!activeConnectionId || activeConnectionId === 'null' || activeConnectionId === 'undefined') {
      return {
        success: false,
        records: [],
        messages: [],
        error: 'Memory未接続です',
        fromDrive: false,
      };
    }

    const timelineUrl = `${this.baseUrl}/memory/timeline/get`;
    const payload = {
      memory_connection_id: activeConnectionId,
      session_id: sessionId,
    };

    try {
      const response = await fetch(timelineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail || errData.error || errData.message) {
            errorDetail = errData.detail || errData.error || errData.message;
          }
        } catch {
          try {
            const errText = await response.text();
            if (errText) errorDetail = errText;
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          records: [],
          messages: [],
          error: `Conversation Record取得に失敗しました (${errorDetail})`,
          fromDrive: false,
        };
      }

      const resData = await response.json().catch(() => null);
      if (!resData) {
        return {
          success: false,
          records: [],
          messages: [],
          error: '有効なレスポンスを受信できませんでした',
          fromDrive: false,
        };
      }

      if (resData.ok === false || resData.success === false) {
        return {
          success: false,
          records: [],
          messages: [],
          error: resData.error || resData.message || resData.detail || 'Conversation Record取得に失敗しました',
          fromDrive: false,
        };
      }

      // レコード一覧の抽出（timeline, records, items, events, messages 等のキーに対応）
      let rawList: unknown[] = [];
      if (Array.isArray(resData)) {
        rawList = resData;
      } else if (Array.isArray(resData.timeline)) {
        rawList = resData.timeline;
      } else if (Array.isArray(resData.records)) {
        rawList = resData.records;
      } else if (Array.isArray(resData.items)) {
        rawList = resData.items;
      } else if (Array.isArray(resData.events)) {
        rawList = resData.events;
      } else if (Array.isArray(resData.messages)) {
        rawList = resData.messages;
      } else if (resData.result && typeof resData.result === 'object') {
        const r = resData.result as Record<string, unknown>;
        if (Array.isArray(r)) {
          rawList = r;
        } else if (Array.isArray(r.timeline)) {
          rawList = r.timeline;
        } else if (Array.isArray(r.records)) {
          rawList = r.records;
        } else if (Array.isArray(r.items)) {
          rawList = r.items;
        } else if (Array.isArray(r.events)) {
          rawList = r.events;
        } else if (Array.isArray(r.messages)) {
          rawList = r.messages;
        }
      } else if (Array.isArray(resData.data)) {
        rawList = resData.data;
      }

      const records: MemoryTimelineRecord[] = [];
      const messages: ChatMessage[] = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (!item || typeof item !== 'object') continue;

        const raw = item as Record<string, unknown>;

        // session_idの整合性確認（指定session_idと異なるレコードが混在している場合はスキップ）
        const itemSessionId = raw.session_id || raw.sessionId;
        if (itemSessionId && String(itemSessionId) !== String(sessionId)) {
          continue;
        }

        // roleの正規化: user, assistant, system
        const rawRole = String(raw.role || raw.speaker || raw.author || raw.sender || 'assistant').toLowerCase();
        const role = rawRole.includes('user') ? 'user' : rawRole.includes('system') ? 'system' : 'assistant';

        // contentの抽出
        let content = '';
        if (typeof raw.content === 'string') {
          content = raw.content;
        } else if (typeof raw.message === 'string') {
          content = raw.message;
        } else if (typeof raw.text === 'string') {
          content = raw.text;
        } else if (raw.content && typeof raw.content === 'object') {
          content = JSON.stringify(raw.content);
        }

        // event_idの抽出
        const eventId = String(raw.event_id || raw.eventId || raw.id || `drive_msg_${sessionId}_${i}`);

        // occurred_at / timestampのパース
        let timestamp = Date.now();
        const rawOccurred = raw.occurred_at || raw.occurredAt || raw.timestamp || raw.created_at || raw.createdAt;
        if (typeof rawOccurred === 'number') {
          timestamp = rawOccurred > 1e12 ? rawOccurred : rawOccurred * 1000;
        } else if (typeof rawOccurred === 'string' && rawOccurred.trim()) {
          const parsed = Date.parse(rawOccurred);
          if (!isNaN(parsed)) {
            timestamp = parsed;
          }
        }

        const imageUrl = typeof raw.image_url === 'string' ? raw.image_url : typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined;

        const timelineRecord: MemoryTimelineRecord = {
          event_id: eventId,
          role,
          content,
          occurred_at: rawOccurred as string | number | undefined,
          session_id: sessionId,
          image_url: imageUrl,
          metadata: raw,
        };
        records.push(timelineRecord);

        const chatMessage: ChatMessage = {
          id: eventId,
          role,
          content,
          timestamp,
          imageUrl,
        };
        messages.push(chatMessage);
      }

      // 時系列順（occurred_at / timestamp の昇順）でソートし、user -> assistant の対話順序を確実に保持
      messages.sort((a, b) => a.timestamp - b.timestamp);

      return {
        success: true,
        records,
        messages,
        fromDrive: true,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ネットワーク通信エラー';
      return {
        success: false,
        records: [],
        messages: [],
        error: `通信エラー: ${errMsg}`,
        fromDrive: false,
      };
    }
  }

  /**
   * Google Drive Memory上のROMデータ一覧を取得します。
   * Flow: Frontend -> Render /memory/rom/list -> Memory Runner -> Memory Flow list_rom -> Google Drive
   * 
   * 送信ペイロード:
   * {
   *   "memory_connection_id": "<現在接続中のGoogle Drive connection id>",
   *   "session_id": "<任意>",
   *   "item_type": "<任意>"
   * }
   */
  async listMemoryRom(params?: ListMemoryRomParams): Promise<ListMemoryRomResult> {
    const activeConnectionId = params?.connectionId ?? this.memoryConnectionId;
    if (!activeConnectionId) {
      return {
        success: false,
        items: [],
        error: 'Google Drive Memoryが未接続です。先にGoogleアカウントを接続してください。',
      };
    }

    const listUrl = `${this.baseUrl}/memory/rom/list`;
    const payload: Record<string, string> = {
      memory_connection_id: activeConnectionId,
    };
    if (params?.sessionId && params.sessionId.trim()) {
      payload.session_id = params.sessionId.trim();
    }
    if (params?.itemType && params.itemType.trim()) {
      payload.item_type = params.itemType.trim();
    }

    try {
      const response = await fetch(listUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail || errData.error || errData.message) {
            errorDetail = errData.detail || errData.error || errData.message;
          }
        } catch {
          try {
            const errText = await response.text();
            if (errText) errorDetail = errText;
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          items: [],
          error: `Memory ROM一覧の取得に失敗しました (${errorDetail})`,
        };
      }

      const resData = await response.json().catch(() => ({ ok: false }));
      if (resData && (resData.ok === false || resData.success === false)) {
        return {
          success: false,
          items: [],
          error: resData.error || resData.message || resData.detail || 'Memory ROM一覧の取得に失敗しました',
        };
      }

      // レスポンスからアイテム一覧を柔軟に抽出
      let rawList: unknown[] = [];
      if (Array.isArray(resData)) {
        rawList = resData;
      } else if (Array.isArray(resData.items)) {
        rawList = resData.items;
      } else if (Array.isArray(resData.rom_items)) {
        rawList = resData.rom_items;
      } else if (Array.isArray(resData.rom_list)) {
        rawList = resData.rom_list;
      } else if (Array.isArray(resData.files)) {
        rawList = resData.files;
      } else if (resData.result && typeof resData.result === 'object') {
        const r = resData.result as Record<string, unknown>;
        if (Array.isArray(r)) {
          rawList = r;
        } else if (Array.isArray(r.items)) {
          rawList = r.items;
        } else if (Array.isArray(r.rom_items)) {
          rawList = r.rom_items;
        } else if (Array.isArray(r.files)) {
          rawList = r.files;
        }
      } else if (Array.isArray(resData.data)) {
        rawList = resData.data;
      }

      // 各アイテムを正規化し、5つのカテゴリ（Session ROM, Conversation Record, Session Image, Shared ROM, Unknown）に分類
      const items: MemoryRomItem[] = rawList.map((raw: any, index: number) => {
        const driveFileId = String(
          raw.drive_file_id || raw.file_id || raw.id || `file_${index + 1}`
        );
        const rawType = String(raw.item_type || raw.type || raw.category || '');
        const rawName = String(raw.name || raw.filename || raw.title || driveFileId);
        const mimeType = raw.mime_type || raw.mimeType || undefined;
        const itemType = classifyMemoryRomType(rawType, rawName, mimeType);
        const isSessionScoped =
          itemType === 'session_rom' ||
          itemType === 'conversation_record' ||
          itemType === 'session_image';

        return {
          id: driveFileId,
          drive_file_id: driveFileId,
          name: rawName,
          item_type: itemType,
          raw_type: rawType || undefined,
          session_id: raw.session_id || raw.sessionId || undefined,
          updated_at:
            raw.updated_at ||
            raw.modified_time ||
            raw.updatedAt ||
            raw.timestamp ||
            raw.created_at ||
            undefined,
          size: raw.size || raw.file_size || raw.bytes || undefined,
          description: raw.description || raw.summary || undefined,
          mime_type: mimeType,
          is_session_scoped: isSessionScoped,
          metadata: typeof raw === 'object' ? raw : undefined,
        };
      });

      return {
        success: true,
        items,
        totalCount: items.length,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ネットワーク通信エラー';
      return {
        success: false,
        items: [],
        error: `通信エラー: ${errMsg}`,
      };
    }
  }

  /**
   * Google Drive Memory上の個別ROMデータを削除します。
   * Flow: Frontend -> Render /memory/rom/delete -> Memory Runner -> Memory Flow delete_rom -> Google Drive
   * 
   * 送信ペイロード:
   * {
   *   "memory_connection_id": "<現在接続中のGoogle Drive connection id>",
   *   "drive_file_id": "<削除対象のGoogle Drive file_id>",
   *   "item_type": "<任意: ROMカテゴリ>",
   *   "session_id": "<任意: セッションID>"
   * }
   */
  async deleteMemoryRomItem(params: DeleteMemoryRomParams): Promise<DeleteMemoryRomResult> {
    const activeConnectionId = params.connectionId ?? this.memoryConnectionId;
    if (!activeConnectionId) {
      return {
        success: false,
        error: 'Google Drive Memoryが未接続です。先にGoogleアカウントを接続してください。',
      };
    }

    if (!params.driveFileId) {
      return {
        success: false,
        error: '削除対象の drive_file_id が指定されていません。',
      };
    }

    const deleteUrl = `${this.baseUrl}/memory/rom/delete`;
    const payload: Record<string, unknown> = {
      memory_connection_id: activeConnectionId,
      drive_file_id: params.driveFileId,
    };
    if (params.itemType) {
      payload.item_type = params.itemType;
    }
    if (params.sessionId) {
      payload.session_id = params.sessionId;
    }
    if (params.fileName) {
      payload.name = params.fileName;
    }

    try {
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error:
              'バックエンドAPI（POST /memory/rom/delete）が未配備です。個別ROM削除の実行にはRender側（Memory Flow / Runner）の削除エンドポイントが必要です。',
          };
        }

        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail || errData.error || errData.message) {
            errorDetail = errData.detail || errData.error || errData.message;
          }
        } catch {
          try {
            const errText = await response.text();
            if (errText) errorDetail = errText;
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          error: `ROM削除に失敗しました (${errorDetail})`,
        };
      }

      const resData = await response.json().catch(() => ({ ok: true }));
      if (resData && (resData.ok === false || resData.success === false)) {
        return {
          success: false,
          error: resData.error || resData.message || resData.detail || 'ROM削除に失敗しました',
        };
      }

      return {
        success: true,
        deletedDriveFileId: params.driveFileId,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ネットワーク通信エラー';
      return {
        success: false,
        error: `通信エラー: ${errMsg}`,
      };
    }
  }

  resetConversation(): void {
    this.persistState(null);
  }

  getBackendState(): Record<string, unknown> | null {
    return this.backendState;
  }

  setBackendState(state: Record<string, unknown> | null): void {
    this.persistState(state);
  }

  async sendMessage(history: ChatMessage[], userText: string, imageUrl?: string, sessionId?: string): Promise<ChatResponse> {
    const text = userText.trim();
    // 写真付きでテキストが空の場合は、コンテキスト意図を明示したプロンプトを設定
    const messageToSend = text || (imageUrl ? 'スーパーで見つけた商品・値札・特売・食材の写真です。現在の会話や候補と合わせて判断材料として教えてください。' : '');

    const payload: {
      message: string;
      image?: string;
      state?: Record<string, unknown>;
      memory_connection_id?: string;
      session_id?: string;
    } = {
      message: messageToSend,
    };

    if (imageUrl) {
      payload.image = imageUrl;
    }

    if (this.backendState) {
      payload.state = this.backendState;
    }

    // Google Drive Memory 接続IDが存在する場合はペイロードに含めて送信
    if (this.memoryConnectionId) {
      payload.memory_connection_id = this.memoryConnectionId;
    }

    if (sessionId) {
      payload.session_id = sessionId;
    }

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      // もしプロキシまたは直接URLで接続できなかった場合、フォールバックURLを1回試行
      if (this.endpoint.startsWith('/api/render-backend')) {
        const directUrl = 'https://shopping-ai-jinba-dev.onrender.com/run';
        response = await fetch(directUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        throw networkError;
      }
    }

    if (!response.ok) {
      let message = `Render Backend returned status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson && typeof errorJson.error === 'string') {
          message = errorJson.error;
        }
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) message += `: ${errorText}`;
        } catch {
          // ignore
        }
      }
      throw new Error(message);
    }

    const data: JinbaBackendRunResponse = await response.json();

    if (!data.ok || !data.result) {
      throw new Error(data.error || 'Render Backend execution did not return a valid result.');
    }

    // 次回ターン用のBackend Stateを更新・永続化
    if (data.result.state) {
      this.persistState(data.result.state as Record<string, unknown>);
    }

    const replyText = data.result.reply || '応答を受け付けました。';
    const decisionData = this.extractDecisionData(data.result);

    // Main Flowから渡された current_scene の抽出（planning / shopping / after_shopping）
    const rawScene =
      data.result.current_scene ||
      data.result.state?.current_scene ||
      data.result.state?.session_context?.current_scene ||
      data.result.state?.scene;

    let currentScene: AppScene | undefined = undefined;
    if (typeof rawScene === 'string') {
      const lower = rawScene.toLowerCase();
      if (lower.includes('after') || lower.includes('kitchen') || lower.includes('home_cooking') || lower.includes('帰宅')) {
        currentScene = 'after_shopping';
      } else if (lower.includes('shop') || lower.includes('supermarket') || lower.includes('買い')) {
        currentScene = 'shopping';
      } else if (lower.includes('plan') || lower.includes('desk') || lower.includes('相談') || lower.includes('献立')) {
        currentScene = 'planning';
      }
    }

    // Main Flowから渡された expert_mode の抽出
    const rawExpert =
      data.result.expert_mode !== undefined
        ? data.result.expert_mode
        : data.result.state?.expert_mode !== undefined
        ? data.result.state?.expert_mode
        : data.result.state?.session_context?.expert_mode !== undefined
        ? data.result.state?.session_context?.expert_mode
        : data.result.state?.expert;

    let expertMode: string | null | undefined = undefined;
    if (rawExpert !== undefined) {
      if (typeof rawExpert === 'string' && rawExpert.trim()) {
        expertMode = rawExpert.trim();
      } else if (rawExpert === null || rawExpert === 'none' || rawExpert === false) {
        expertMode = null;
      }
    }

    return {
      text: replyText,
      decisionData,
      rawBackendState: data.result.state as Record<string, unknown> | undefined,
      currentScene,
      expertMode,
    };
  }

  /**
   * Main Flowの実行結果からフロントエンド表示用の判断材料・候補データを抽出します。
   * ※ フロントエンド側で判断・評価を行うのではなく、バックエンドから渡された
   *    可能性・優先事項・選択肢（meal_options等）を型安全にマッピングする処理です。
   */
  private extractDecisionData(result: NonNullable<JinbaBackendRunResponse['result']>): InlineDecisionPayload | undefined {
    const state = result.state;
    const payload: InlineDecisionPayload = {};
    let hasData = false;

    // 1. バックエンドから渡された文脈・前提条件の抽出
    if (state?.session_context?.priorities && state.session_context.priorities.length > 0) {
      payload.contextSummary = {
        moodOrPreference: state.session_context.priorities.join('、'),
      };
      hasData = true;
    }

    // 2. バックエンドから渡された選択肢 (meal_options) のマッピング
    const rawOptions = state?.possibility_context?.meal_options;
    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      const mappedOptions: SuggestionOption[] = rawOptions.map((opt, idx) => ({
        id: opt.id || `opt-${idx}`,
        title: opt.title || opt.name || `候補 ${idx + 1}`,
        summary: opt.summary || opt.description || '',
        reasons: Array.isArray(opt.reasons) ? opt.reasons : [],
        prepTimeMinutes: opt.prep_time_minutes ?? opt.prepTimeMinutes,
        effortLevel: opt.effort_level ?? opt.effortLevel,
        additionalGroceries: opt.additional_groceries ?? opt.additionalGroceries,
        requiresShopping: opt.requires_shopping ?? opt.requiresShopping,
      }));

      payload.options = mappedOptions;
      hasData = true;
    }

    // 3. 次のアクション候補やクイック確認
    // バックエンドから特定のquickRepliesがない場合でも、ユーザーが即座に答えやすい標準アクションを提供
    if (result.reply && (result.reply.includes('？') || result.reply.includes('?'))) {
      payload.quickReplies = [
        '手元にあるもので作りたい',
        '買い足し可能（おすすめを教えて）',
        'もう少し詳しく知りたい',
      ];
      hasData = true;
    }

    return hasData ? payload : undefined;
  }
}

export const defaultChatService: ChatService = new RenderBackendChatAdapter();
