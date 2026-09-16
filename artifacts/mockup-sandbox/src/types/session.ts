import { ChatMessage, AppScene } from './chat';

export type SessionStatus = 'in_progress' | 'completed';

export interface SessionStatusSummary {
  /** 今日の状況（所要時間、疲労度、人数、優先事項） */
  situation: string[];
  /** 現在の候補（検討中の献立・選択肢・商品） */
  candidates: Array<{
    id: string;
    title: string;
    summary?: string;
    reasons?: string[];
    prepTimeMinutes?: number;
    requiresShopping?: boolean;
  }>;
  /** 現在の可能性（手持ち食材、レシピ候補、特売品などの選択肢の幅） */
  possibilities: string[];
  /** 決まったこと（確定したメニュー、決定事項） */
  decided: string[];
  /** まだ決まっていないこと（主菜の選択、買い足しの有無など） */
  undecided: string[];
  /** 買い物の進行状況 */
  shoppingProgress?: {
    totalItems?: number;
    collectedItems?: number;
    stepDescription?: string;
  };
}

export interface ShoppingSession {
  /** セッション固有ID */
  id: string;
  /** セッション名（例: 今日の晩ごはん、週末のまとめ買い） */
  title: string;
  /** 作成日（YYYY/MM/DD） */
  date: string;
  /** 作成日時タイムスタンプ */
  createdAt: number;
  /** 最終更新日時タイムスタンプ */
  updatedAt: number;
  /** セッションの状態（進行中 / 完了） */
  status: SessionStatus;
  /**
   * Main Flowから返される現在のシーン
   * planning | shopping | after_shopping
   */
  currentScene: AppScene;
  /**
   * Main Flowから返される専門家モード
   * 例: "fish" (魚の専門家), "meat" (肉の専門家), "cooking" (調理担当) など
   */
  expertMode: string | null;
  /**
   * Session Restore State
   * セッション再開時にバックエンド側の状態（possibility_context, shopping_context等）を
   * 再構築するための情報。会話ログとは明確に分離されます。
   */
  restoreState: Record<string, unknown> | null;
  /**
   * Conversation Record
   * 過去の会話を振り返ったり確認したりするための対話記録。
   */
  conversationRecord: ChatMessage[];
  /**
   * 現在のステータス要約（状況、候補、可能性、決まったこと、未決定事項）
   */
  statusSummary: SessionStatusSummary;
}
