import { ChatMessage, ChatResponse, InlineDecisionPayload, SuggestionOption } from '../types/chat';

/**
 * ChatService
 * 
 * フロントエンドとバックエンドの通信境界を定義するインターフェースです。
 * Shopping AIの意思決定・推論・レシピ判定ロジックはフロントエンドには持たせず、
 * バックエンド（Render Backend）へのメッセージ送信および
 * 実行結果（回答テキスト、判断材料、選択肢）の受領のみを規定します。
 */
export interface ChatService {
  sendMessage(history: ChatMessage[], userText: string): Promise<ChatResponse>;
  resetConversation?(): void;
}

/**
 * Render Backendのレスポンス型
 */
interface JinbaBackendRunResponse {
  ok: boolean;
  result?: {
    reply?: string;
    parse_success?: boolean;
    state?: {
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
      };
      session_context?: {
        priorities?: string[];
        shopping_or_home?: string;
      };
      shopping_context?: {
        inventory?: string[];
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
  private backendState: Record<string, unknown> | null = null;
  private readonly STORAGE_KEY = 'shopping_ai_backend_state';

  constructor(endpoint?: string) {
    // Vite開発環境のプロキシ (/api/render-backend/run) または環境変数/直接URL
    const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
    const envUrl = metaEnv?.VITE_RENDER_BACKEND_URL;
    if (endpoint) {
      this.endpoint = endpoint;
    } else if (metaEnv?.DEV) {
      // 開発・プレビューサーバー内ではViteプロキシ経由でCORSを安全に回避
      this.endpoint = '/api/render-backend/run';
    } else if (envUrl) {
      this.endpoint = `${envUrl.replace(/\/+$/, '')}/run`;
    } else {
      this.endpoint = 'https://shopping-ai-jinba-dev.onrender.com/run';
    }

    // 保存されている前回のバックエンドStateがあれば復元
    this.restoreState();
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

  resetConversation(): void {
    this.persistState(null);
  }

  async sendMessage(history: ChatMessage[], userText: string): Promise<ChatResponse> {
    const payload: {
      message: string;
      state?: Record<string, unknown>;
    } = {
      message: userText,
    };

    if (this.backendState) {
      payload.state = this.backendState;
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
      const errorText = await response.text();
      throw new Error(`Render Backend returned status ${response.status}: ${errorText}`);
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

    return {
      text: replyText,
      decisionData,
      rawBackendState: data.result.state as Record<string, unknown> | undefined,
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
