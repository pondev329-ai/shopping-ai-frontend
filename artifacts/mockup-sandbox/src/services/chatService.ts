import { ChatMessage, ChatResponse } from '../types/chat';

/**
 * ChatService
 * 
 * フロントエンドとバックエンドの通信境界を定義するインターフェースです。
 * 意思決定や候補生成のロジックはここには含めず、
 * リクエストの送信とレスポンス（テキスト、文脈、候補データ）の受領のみを規定します。
 */
export interface ChatService {
  sendMessage(history: ChatMessage[], userText: string): Promise<ChatResponse>;
}

/**
 * DevelopmentMockChatAdapter
 * 
 * 将来のバックエンドAPI接続（fetch('/api/chat')等）までの間、
 * UIの送受信と各種データ型（テキスト、判断材料、選択肢）のレンダリング疎通を
 * 確認するための最小限の通信アダプターです。
 * 
 * ※ ここに「疲れているならこの料理」「豚肉ならこの提案」といった
 *    Shopping AI固有の判断ロジック・推論ロジックは一切持たせません。
 */
export class DevelopmentMockChatAdapter implements ChatService {
  async sendMessage(
    _history: ChatMessage[],
    userText: string
  ): Promise<ChatResponse> {
    // ネットワーク通信を模した遅延
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 単純な疎通確認用のプレースホルダー応答
    // ※ バックエンドが実際のユーザー状況の理解・判断材料・選択肢を返却します
    return {
      text: `ご入力ありがとうございます。「${userText}」の状況を受け付けました。\nShopping AIはあなたの状況を踏まえて判断材料と候補を整理します。`,
      decisionData: {
        contextSummary: {
          moodOrPreference: '状況ヒアリング中',
        },
        quickReplies: [
          '調理時間を短くしたい',
          '手持ち食材を使い切りたい',
          '買い足しの相談をしたい',
        ],
      },
    };
  }
}

export const defaultChatService: ChatService = new DevelopmentMockChatAdapter();
