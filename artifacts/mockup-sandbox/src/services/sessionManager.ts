import { ShoppingSession, SessionStatusSummary } from '../types/session';
import { ChatMessage, ChatResponse } from '../types/chat';

export const INITIAL_GREETING_MESSAGE: ChatMessage = {
  id: 'msg-init',
  role: 'assistant',
  content: 'こんにちは！Shopping AIです。\n\n今日のあなたの状況（疲労度、使える時間、冷蔵庫の余り、買い物に行けるかなど）に合わせて、無理のない選択肢を一緒に整理します。\n\n今日の晩ごはんや買い物について、今の状況を教えてください。',
  timestamp: Date.now(),
  decisionData: {
    quickReplies: [
      '今日は疲れてるから手軽に済ませたい',
      '冷蔵庫にある食材を使い切りたい',
      '20分で作れるものがいい',
      '買い足しを最小限にしたい',
    ],
  },
};

const SESSIONS_STORAGE_KEY = 'shopping_ai_sessions_v1';
const ACTIVE_SESSION_ID_KEY = 'shopping_ai_active_session_id';

/**
 * デフォルトの空ステータス要約を生成
 */
export function createDefaultStatusSummary(): SessionStatusSummary {
  return {
    situation: ['セッション開始（条件のヒアリング中）'],
    candidates: [],
    possibilities: ['冷蔵庫の食材や好みに応じて候補を広げられます'],
    decided: [],
    undecided: ['今日の主菜・方針の決定', '買い足し食材の確認'],
  };
}

/**
 * 新しいセッションオブジェクトを生成
 */
export function createNewSession(customTitle?: string): ShoppingSession {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const title = customTitle?.trim() || `${dateStr} ${timeStr} の食事・買い物`;

  return {
    id,
    title,
    date: dateStr,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'in_progress',
    restoreState: null,
    conversationRecord: [INITIAL_GREETING_MESSAGE],
    statusSummary: createDefaultStatusSummary(),
  };
}

/**
 * Backend Stateから「状況・候補・可能性・決定・未決定」のステータス要約を抽出
 */
export function extractStatusSummary(
  backendState: Record<string, unknown> | null,
  latestResponse?: ChatResponse
): SessionStatusSummary {
  const summary: SessionStatusSummary = {
    situation: [],
    candidates: [],
    possibilities: [],
    decided: [],
    undecided: [],
  };

  if (!backendState) {
    if (latestResponse?.decisionData) {
      if (latestResponse.decisionData.contextSummary?.moodOrPreference) {
        summary.situation.push(latestResponse.decisionData.contextSummary.moodOrPreference);
      }
      if (latestResponse.decisionData.options) {
        summary.candidates = latestResponse.decisionData.options.map((o) => ({
          id: o.id,
          title: o.title,
          summary: o.summary,
        }));
      }
    }
    if (summary.situation.length === 0) summary.situation.push('条件ヒアリング中');
    if (summary.undecided.length === 0) summary.undecided.push('献立または買い物の方向性');
    return summary;
  }

  // 1. 今日の状況 (session_context)
  const sessionCtx = backendState.session_context as {
    priorities?: string[];
    shopping_or_home?: string;
  } | undefined;

  if (sessionCtx?.priorities && Array.isArray(sessionCtx.priorities) && sessionCtx.priorities.length > 0) {
    summary.situation.push(...sessionCtx.priorities);
  }
  if (sessionCtx?.shopping_or_home && sessionCtx.shopping_or_home !== 'unknown') {
    summary.situation.push(sessionCtx.shopping_or_home === 'shopping' ? 'スーパーで買い物中' : '自宅で調理検討中');
  }

  // 2. 現在の候補 (possibility_context.meal_options)
  const possibilityCtx = backendState.possibility_context as {
    meal_options?: Array<{ id?: string; title?: string; name?: string; summary?: string; description?: string }>;
    ingredients?: Array<{ name?: string; label?: string } | string>;
    recipe_catalog?: Array<{ title?: string; name?: string }>;
    offers?: Array<{ title?: string; name?: string; price?: number }>;
  } | undefined;

  if (possibilityCtx?.meal_options && Array.isArray(possibilityCtx.meal_options)) {
    summary.candidates = possibilityCtx.meal_options.map((opt, i) => ({
      id: opt.id || `candidate-${i}`,
      title: opt.title || opt.name || `候補 ${i + 1}`,
      summary: opt.summary || opt.description,
    }));
  }

  // 3. 現在の可能性 (shopping_context.inventory + ingredients + flyer)
  const shoppingCtx = backendState.shopping_context as {
    inventory?: string[];
    selected_product_ids?: string[];
  } | undefined;

  if (shoppingCtx?.inventory && shoppingCtx.inventory.length > 0) {
    summary.possibilities.push(`手持ち食材: ${shoppingCtx.inventory.join(', ')}`);
  }
  if (possibilityCtx?.ingredients && possibilityCtx.ingredients.length > 0) {
    const ingNames = possibilityCtx.ingredients.map((item) => (typeof item === 'string' ? item : item.name || item.label || ''));
    const valid = ingNames.filter(Boolean);
    if (valid.length > 0) {
      summary.possibilities.push(`利用可能な材料: ${valid.slice(0, 5).join(', ')}`);
    }
  }
  if (possibilityCtx?.recipe_catalog && possibilityCtx.recipe_catalog.length > 0) {
    const recipeNames = possibilityCtx.recipe_catalog.map((r) => r.title || r.name).filter(Boolean);
    if (recipeNames.length > 0) {
      summary.possibilities.push(`関連レシピ候補: ${recipeNames.slice(0, 3).join(' / ')}`);
    }
  }

  // 4. 決まったこと & まだ決まっていないこと
  if (shoppingCtx?.selected_product_ids && shoppingCtx.selected_product_ids.length > 0) {
    summary.decided.push(`購入候補決定: ${shoppingCtx.selected_product_ids.length}件の商品`);
  }

  if (summary.candidates.length > 0) {
    summary.undecided.push(`提示された ${summary.candidates.length} つの候補からの選択`);
  } else {
    summary.undecided.push('献立・買い物方針の絞り込み');
  }

  if (summary.situation.length === 0) {
    summary.situation.push('条件を整理中');
  }
  if (summary.possibilities.length === 0) {
    summary.possibilities.push('希望に合わせて選択肢を柔軟に展開できます');
  }

  return summary;
}

/**
 * 全セッションの読み込み（レガシー保存からのマイグレーション対応）
 */
export function loadAllSessions(): { sessions: ShoppingSession[]; activeSessionId: string } {
  try {
    const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_SESSION_ID_KEY);

    if (rawSessions) {
      const parsed: ShoppingSession[] = JSON.parse(rawSessions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const currentActive = parsed.find((s) => s.id === activeId) ? (activeId as string) : parsed[0].id;
        return { sessions: parsed, activeSessionId: currentActive };
      }
    }

    // レガシーデータ (shopping_ai_chat_history / shopping_ai_backend_state) からの初回移行
    const legacyHistory = localStorage.getItem('shopping_ai_chat_history');
    const legacyState = localStorage.getItem('shopping_ai_backend_state');
    const newSession = createNewSession('今夜の食事・買い物');

    if (legacyHistory) {
      try {
        const parsedHistory = JSON.parse(legacyHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          newSession.conversationRecord = parsedHistory;
        }
      } catch {
        // ignore
      }
    }

    if (legacyState) {
      try {
        newSession.restoreState = JSON.parse(legacyState);
        newSession.statusSummary = extractStatusSummary(newSession.restoreState);
      } catch {
        // ignore
      }
    }

    const initialSessions = [newSession];
    saveAllSessions(initialSessions, newSession.id);
    return { sessions: initialSessions, activeSessionId: newSession.id };
  } catch (err) {
    console.error('Failed to load sessions:', err);
    const fallback = createNewSession();
    return { sessions: [fallback], activeSessionId: fallback.id };
  }
}

/**
 * 全セッションの保存（localStorageクォータハンドリング付き）
 */
export function saveAllSessions(sessions: ShoppingSession[], activeSessionId: string): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_ID_KEY, activeSessionId);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // クォータ超過時は過去セッションの会話レコードを軽量化して保存
    try {
      const compactSessions = sessions.map((s) => ({
        ...s,
        conversationRecord: s.conversationRecord.slice(-10), // 最新10件に制限
      }));
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(compactSessions));
    } catch {
      // ignore
    }
  }
}
