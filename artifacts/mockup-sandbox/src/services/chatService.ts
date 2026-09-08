import { ChatMessage, InlineDecisionPayload } from '../types/chat';

export interface ChatService {
  sendMessage(
    history: ChatMessage[],
    userText: string
  ): Promise<{ text: string; decisionData?: InlineDecisionPayload }>;
}

/**
 * Shopping AI Client Adapter
 * 
 * 将来のバックエンドAPIへの接続境界となるサービス層です。
 * 実在レシピAPIやバックエンド意思決定エンジンと連携する際は、
 * fetch('/api/chat') などの呼び出しに透過的に切り替えが可能です。
 */
class LocalDecisionSupportAdapter implements ChatService {
  async sendMessage(
    history: ChatMessage[],
    userText: string
  ): Promise<{ text: string; decisionData?: InlineDecisionPayload }> {
    // ネットワーク遅延シミュレーション（自然な対話感）
    await new Promise((resolve) => setTimeout(resolve, 600));

    const text = userText.toLowerCase();

    // 1. 疲れている・時短の相談
    if (text.includes('疲れ') || text.includes('時短') || text.includes('手軽') || text.includes('20分') || text.includes('15分')) {
      return {
        text: 'お疲れさまです！今日は無理せず、片付けも少ない形で乗り切りましょう。\nいま手元にある食材や、気になる方向性はどちらに近いですか？',
        decisionData: {
          contextSummary: {
            energyLevel: 'お疲れ気味（調理負担を最小限に）',
            timeLimit: '20分以内目安',
          },
          options: [
            {
              id: 'opt-minimal-prep',
              title: '包丁・まな板なしで済ませる案',
              summary: '切る工程を省き、フライパン1つや電子レンジで完結する手軽な構成。',
              reasons: ['洗い物がフライパンか器だけ', '調理後すぐに休める'],
              prepTimeMinutes: 15,
              effortLevel: 'very_easy',
              requiresShopping: false,
            },
            {
              id: 'opt-warm-soup',
              title: '具だくさん温まるワンボウル案',
              summary: '野菜や肉をざっくり入れて煮る・蒸すだけ。体も温まり満足感高め。',
              reasons: ['火にかけておくだけでOK', '栄養もしっかり摂れる'],
              prepTimeMinutes: 20,
              effortLevel: 'very_easy',
              requiresShopping: false,
            },
          ],
          questionPrompt: '手元に何か残っている食材（卵、豚肉、野菜など）はありますか？それとも買い足しも検討しますか？',
          quickReplies: [
            '冷蔵庫にあるもので済ませたい',
            '帰り道に少しなら買える',
            '豚肉と卵がある',
            '野菜をたくさん使いたい',
          ],
        },
      };
    }

    // 2. 冷蔵庫の食材を消費したい相談
    if (text.includes('冷蔵庫') || text.includes('あるもの') || text.includes('豚肉') || text.includes('鶏肉') || text.includes('キャベツ') || text.includes('卵')) {
      return {
        text: '手元にある食材を無駄なく使いたいですね！\n状況に合わせて、買い足しなしで済ませる方向と、1つだけ調味料や野菜を足す方向のどちらが気分に合いますか？',
        decisionData: {
          contextSummary: {
            availableIngredients: ['手持ち食材を活用'],
            moodOrPreference: '食材ロスを減らしたい',
          },
          options: [
            {
              id: 'opt-zero-shopping',
              title: '今ある食材だけで完結する方向',
              summary: '家にある基本調味料と手持ち食材だけでシンプルに仕上げる方針。',
              reasons: ['買い物に行く必要なし', '冷蔵庫がスッキリ片付く'],
              prepTimeMinutes: 20,
              effortLevel: 'very_easy',
              requiresShopping: false,
            },
            {
              id: 'opt-plus-one',
              title: '1品だけ買い足して満足度を上げる方向',
              summary: 'スープの素や香味野菜、豆腐など1点だけ足して味のバランスを整える方針。',
              reasons: ['少ない買い物で満足感が格段にアップ', '余り食材の消化も進む'],
              prepTimeMinutes: 25,
              effortLevel: 'moderate',
              additionalGroceries: ['カット野菜 または 豆腐など1品'],
              requiresShopping: true,
            },
          ],
          questionPrompt: '今日具体的に使ってしまいたい食材の名前を教えていただけますか？',
          quickReplies: [
            '豚肉とキャベツがある',
            '卵と豆腐がある',
            '買い物なしでいきたい！',
            'おすすめの買い足しを教えて',
          ],
        },
      };
    }

    // 3. 週末・家族・人数の相談
    if (text.includes('家族') || text.includes('子ども') || text.includes('子供') || text.includes('2人') || text.includes('3人') || text.includes('4人')) {
      return {
        text: 'みんなで食べる食事ですね。食べる人の好みや、大皿で取り分けるか個別に分けるかでも準備の手間が変わってきます。\n今日の食卓のイメージはいかがでしょうか？',
        decisionData: {
          contextSummary: {
            targetPeople: 'ご家族・複数人',
            moodOrPreference: 'みんなが食べやすく取り分けやすいもの',
          },
          options: [
            {
              id: 'opt-big-pan',
              title: 'ホットプレート・大皿シェア案',
              summary: 'みんなで囲んで温かいまま取り分けるスタイル。個別盛り付けの手間がゼロ。',
              reasons: ['盛り付けの手間がない', '子どもも楽しく食べられる'],
              prepTimeMinutes: 30,
              effortLevel: 'moderate',
            },
            {
              id: 'opt-main-side',
              title: '定番メイン＋作り置き小鉢案',
              summary: '辛さや好みの味付けを卓上で調整しやすい王道スタイル。',
              reasons: ['大人の味付け・子どもの好みを両立しやすい'],
              prepTimeMinutes: 25,
              effortLevel: 'moderate',
            },
          ],
          questionPrompt: '何か苦手なものや、避けておきたい食材はありますか？',
          quickReplies: [
            '辛いものはNG',
            '子どもが好きな味付けがいい',
            '大皿でサッと出したい',
            '大人用のアクセントも欲しい',
          ],
        },
      };
    }

    // 4. デフォルトのヒアリング・状況整理
    return {
      text: '教えていただきありがとうございます！\nShopping AIは今日の状況に合わせて、あなたにとって無理のない食事・買い物の選択肢を一緒に整理します。\n\n今日の調理時間や、買い出しに寄れるかどうか、今の気分に近いものを教えてください。',
      decisionData: {
        contextSummary: {
          moodOrPreference: '状況ヒアリング中',
        },
        quickReplies: [
          '今日は20分以内でサッと食べたい',
          '冷蔵庫にある食材を使い切りたい',
          'スーパーで何を買うべきか相談したい',
          '洗い物が一番少ない方法がいい',
        ],
      },
    };
  }
}

export const defaultChatService: ChatService = new LocalDecisionSupportAdapter();
