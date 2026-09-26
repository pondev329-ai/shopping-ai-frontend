import React from 'react';
import { AppScene } from '../types/chat';
import { SessionStatusSummary } from '../types/session';
import {
  Fish,
  Beef,
  Carrot,
  ChefHat,
  Tag,
  Sparkles,
  ChevronRight,
  History,
} from 'lucide-react';

interface CompanionSceneStageProps {
  scene: AppScene;
  expertMode?: string | null;
  statusSummary?: SessionStatusSummary;
  isTyping?: boolean;
  onOpenStatusDetail: () => void;
  onOpenHistory?: () => void;
  historyCount?: number;
}

/**
 * 専門家モード定義
 */
function getExpertMeta(expertMode?: string | null) {
  if (!expertMode) return null;
  const lower = expertMode.toLowerCase();

  if (lower.includes('meat') || lower.includes('肉') || lower.includes('精肉')) {
    return {
      type: 'meat',
      title: '精肉・部位の専門家',
      label: '精肉専門',
      icon: Beef,
      badgeStyle: 'bg-rose-500 text-white border-rose-400 shadow-xs',
      description: '特売肉の活用・部位の提案中',
    };
  }
  if (lower.includes('fish') || lower.includes('魚') || lower.includes('鮮魚')) {
    return {
      type: 'fish',
      title: '鮮魚・お魚の専門家',
      label: '鮮魚専門',
      icon: Fish,
      badgeStyle: 'bg-cyan-500 text-white border-cyan-400 shadow-xs',
      description: '旬の魚と鮮度の目利き中',
    };
  }
  if (lower.includes('vegetable') || lower.includes('vege') || lower.includes('produce') || lower.includes('野菜') || lower.includes('青果')) {
    return {
      type: 'vegetable',
      title: '青果・野菜の専門家',
      label: '青果専門',
      icon: Carrot,
      badgeStyle: 'bg-emerald-600 text-white border-emerald-500 shadow-xs',
      description: '鮮度・旬・保存方法のアドバイス中',
    };
  }
  if (lower.includes('cook') || lower.includes('chef') || lower.includes('料理') || lower.includes('調理')) {
    return {
      type: 'chef',
      title: '調理・時短シェフ担当',
      label: '調理シェフ',
      icon: ChefHat,
      badgeStyle: 'bg-amber-500 text-white border-amber-400 shadow-xs',
      description: '手早く美味しい段取りを検討中',
    };
  }
  if (lower.includes('bargain') || lower.includes('offer') || lower.includes('特売') || lower.includes('目利き')) {
    return {
      type: 'bargain',
      title: '特売・目利き担当',
      label: '目利き担当',
      icon: Tag,
      badgeStyle: 'bg-emerald-600 text-white border-emerald-500 shadow-xs',
      description: 'お得な食材と価格を比較中',
    };
  }

  return {
    type: 'generic',
    title: expertMode.endsWith('専門') || expertMode.endsWith('専門家') ? expertMode : `${expertMode} 専門家`,
    label: expertMode.endsWith('専門') ? expertMode : `${expertMode}専門`,
    icon: Sparkles,
    badgeStyle: 'bg-purple-600 text-white border-purple-500 shadow-xs',
    description: '専門的視点でアドバイス中',
  };
}

/**
 * 食材・テキストから適切な絵文字アイコンを判定
 */
function getIngredientIcon(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('キャベツ') || lower.includes('レタス') || lower.includes('白菜') || lower.includes('ほうれん草') || lower.includes('小松菜') || lower.includes('野菜') || lower.includes('青菜')) return '🥬';
  if (lower.includes('肉') || lower.includes('豚') || lower.includes('牛') || lower.includes('鶏') || lower.includes('ひき肉') || lower.includes('挽肉') || lower.includes('バラ')) return '🥩';
  if (lower.includes('魚') || lower.includes('鮭') || lower.includes('サバ') || lower.includes('鱈') || lower.includes('刺身') || lower.includes('マグロ') || lower.includes('鮮魚')) return '🐟';
  if (lower.includes('卵') || lower.includes('たまご')) return '🥚';
  if (lower.includes('トマト')) return '🍅';
  if (lower.includes('にんじん') || lower.includes('人参')) return '🥕';
  if (lower.includes('たまねぎ') || lower.includes('玉ねぎ') || lower.includes('タマネギ')) return '🧅';
  if (lower.includes('キノコ') || lower.includes('きのこ') || lower.includes('しめじ') || lower.includes('えのき') || lower.includes('椎茸')) return '🍄';
  if (lower.includes('豆腐') || lower.includes('納豆') || lower.includes('大豆')) return '🧊';
  if (lower.includes('米') || lower.includes('ご飯') || lower.includes('パン')) return '🍚';
  if (lower.includes('じゃがいも') || lower.includes('ポテト')) return '🥔';
  return '🍴';
}

export const CompanionSceneStage: React.FC<CompanionSceneStageProps> = ({
  scene,
  expertMode,
  statusSummary,
  isTyping = false,
  onOpenStatusDetail,
  onOpenHistory,
  historyCount,
}) => {
  const expertMeta = getExpertMeta(expertMode);

  // 1. シーン定義（最上部表示用）
  const sceneHeader = {
    planning: {
      title: '🪑 計画中',
      subtitle: '献立・買い出し相談',
    },
    shopping: {
      title: '🛒 買い物中',
      subtitle: '店内ナビ・食材選び',
    },
    after_shopping: {
      title: '🏠 買い物後',
      subtitle: '調理・段取りサポート',
    },
  }[scene] || {
    title: '🪑 相談中',
    subtitle: 'Shopping AI',
  };

  // 2. Statusカードに表示する状態アイテム（詰め込みすぎず、3〜4行でひと目で把握）
  const candidateCount = statusSummary?.candidates?.length || 0;
  const decidedItems = statusSummary?.decided || [];
  const undecidedItems = statusSummary?.undecided || [];
  const situationItems = statusSummary?.situation || [];
  const possibilities = statusSummary?.possibilities || [];
  const progress = statusSummary?.shoppingProgress;

  // 食材や主要アイテムの抽出
  const ingredientItems: Array<{ icon: string; text: string }> = [];

  // 手持ち食材や可能性から食材テキストを抽出
  possibilities.forEach((p) => {
    // "手持ち食材: キャベツ, 豚肉" や 単純な食材名
    const cleaned = p.replace(/^手持ち食材:\s*/, '').replace(/^候補食材:\s*/, '');
    cleaned.split(/[,、・]/).forEach((part) => {
      const trimmed = part.trim();
      if (trimmed && trimmed.length < 15 && ingredientItems.length < 2) {
        ingredientItems.push({
          icon: getIngredientIcon(trimmed),
          text: trimmed,
        });
      }
    });
  });

  // 状況から食材・条件が取れれば補完
  if (ingredientItems.length === 0) {
    situationItems.forEach((s) => {
      if (ingredientItems.length < 2 && (s.includes('分') || s.includes('円') || s.includes('肉') || s.includes('魚') || s.includes('野菜') || s.includes('時短'))) {
        ingredientItems.push({
          icon: getIngredientIcon(s),
          text: s,
        });
      }
    });
  }

  // 状態リストの組み立て
  const displayStatusLines: Array<{ icon: string; text: string; badge?: string }> = [];

  // A. 決まったことがある場合
  if (decidedItems.length > 0) {
    displayStatusLines.push({
      icon: '✓',
      text: decidedItems[0],
      badge: '決定',
    });
  }

  // B. 候補（店頭で見つかった食材や検討中の選択肢）を優先表示
  if (candidateCount > 0) {
    const latestCandidate = statusSummary?.candidates?.[statusSummary.candidates.length - 1]?.title;
    const firstCandidate = statusSummary?.candidates?.[0]?.title;
    const candTitle = latestCandidate || firstCandidate;
    displayStatusLines.push({
      icon: '✨',
      text: candTitle
        ? `${candidateCount}つの候補 (${candTitle.slice(0, 8)}${candTitle.length > 8 ? '…' : ''})`
        : `${candidateCount}つの候補`,
      badge: `${candidateCount}件`,
    });
  }

  // C. 食材アイテム
  ingredientItems.forEach((item) => {
    if (displayStatusLines.length < 3) {
      displayStatusLines.push({
        icon: item.icon,
        text: item.text,
      });
    }
  });

  // D. 買い物進行度
  if (scene === 'shopping' && progress?.totalItems && displayStatusLines.length < 3) {
    displayStatusLines.push({
      icon: '🛒',
      text: `カゴ入れ: ${progress.collectedItems || 0}/${progress.totalItems}点`,
    });
  }

  // E. まだ決まっていないこと
  if (undecidedItems.length > 0 && displayStatusLines.length < 3) {
    displayStatusLines.push({
      icon: '❓',
      text: `未定: ${undecidedItems[0]}`,
    });
  }

  // 初期状態でまだ何もない場合のデフォルト表示（ユーザーの例に沿った見通しの良いプレビュー）
  if (displayStatusLines.length === 0) {
    if (scene === 'shopping') {
      displayStatusLines.push(
        { icon: '🥬', text: 'キャベツ (野菜コーナー)' },
        { icon: '🥩', text: '肉・メイン食材' },
        { icon: '✨', text: '現在の候補を検討中' }
      );
    } else if (scene === 'after_shopping') {
      displayStatusLines.push(
        { icon: '🍳', text: '買ってきた食材の整理' },
        { icon: '⏱️', text: '調理順・段取りの相談' },
        { icon: '🍴', text: 'おいしく仕上げるコツ' }
      );
    } else {
      displayStatusLines.push(
        { icon: '🥬', text: '手持ち食材・好みの相談' },
        { icon: '🥩', text: '今日のメイン候補' },
        { icon: '✨', text: '献立・買い出し計画' }
      );
    }
  }

  return (
    <div
      id="companion-scene-stage"
      aria-label="現在のシーンとステータス"
      className="relative w-full h-full min-h-[220px] rounded-2xl overflow-hidden shadow-xs select-none border border-stone-200/90 dark:border-stone-800 transition-all"
    >
      {/* ============================================================ */}
      {/* 1. 横長の背景（1つのシーンとして全面に広がる・左右分割なし） */}
      {/* ============================================================ */}

      {/* A. 計画中（自宅・リビング・夕方の机） */}
      {scene === 'planning' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#fcf5ec] via-[#f7e6d0] to-[#ecd3b5] overflow-hidden pointer-events-none">
          {/* 夕暮れのアーチ窓（Statusの背後にも夕景が広がる） */}
          <div className="absolute top-2 right-6 sm:right-16 w-32 sm:w-40 h-44 sm:h-52 rounded-t-full border-3 border-white/85 bg-gradient-to-b from-[#fcd34d] via-[#fb923c] to-[#fda4af] opacity-80 shadow-inner overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/70" />
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/70" />
            <div className="absolute -bottom-2 -left-2 w-20 h-10 rounded-full bg-amber-800/20 blur-xs" />
            <div className="absolute -bottom-3 right-0 w-24 h-12 rounded-full bg-amber-900/25 blur-xs" />
          </div>

          {/* 天井のペンダントライト */}
          <div className="absolute top-0 left-32 sm:left-44 -translate-x-1/2 flex flex-col items-center opacity-85">
            <div className="w-0.5 h-8 bg-stone-500/60" />
            <div className="w-12 h-6 rounded-t-full bg-stone-700 shadow-sm" />
            <div className="w-8 h-2 rounded-b-full bg-amber-200 shadow-md" />
            <div className="w-48 h-56 bg-gradient-to-b from-amber-300/20 to-transparent blur-md pointer-events-none -mt-1" />
          </div>

          {/* 壁の時計 */}
          <div className="absolute top-4 left-6 sm:left-10 w-9 h-9 rounded-full border border-stone-400 bg-white/85 flex items-center justify-center shadow-2xs">
            <div className="w-3 h-0.5 bg-stone-600 origin-right -rotate-45" />
            <div className="w-2.5 h-0.5 bg-stone-600 origin-right rotate-45 absolute" />
          </div>

          {/* 木目のダイニングテーブル（横長全面に広がる） */}
          <div className="absolute bottom-0 left-0 right-0 h-22 sm:h-26 bg-gradient-to-t from-[#c29671] via-[#d4a984] to-[#deb592] border-t-3 border-[#ad7f58] shadow-md">
            {/* テーブル上の献立メモ（ポコ太の右脇に配置） */}
            <div className="absolute top-2 left-38 sm:left-48 w-18 h-14 bg-amber-50 rounded shadow-xs border border-stone-300 -rotate-3 p-1.5 flex flex-col justify-between">
              <span className="text-[8px] font-bold text-stone-600 border-b border-stone-200 pb-0.5">📖 メモ</span>
              <div className="space-y-0.5">
                <div className="w-12 h-0.5 bg-stone-300 rounded" />
                <div className="w-9 h-0.5 bg-stone-300 rounded" />
              </div>
              <div className="absolute -right-1 top-2 w-9 h-0.5 bg-emerald-700 rounded-full rotate-12" />
            </div>

            {/* マグカップ */}
            <div className="absolute top-2 left-60 sm:left-72 flex flex-col items-center">
              <div className="w-0.5 h-2.5 bg-white/60 rounded-full blur-[0.5px] animate-pulse" />
              <div className="w-6 h-7 rounded-b-lg bg-teal-600 border border-teal-700 shadow-xs relative">
                <div className="absolute -right-1.5 top-1.5 w-2 h-3.5 rounded-r-full border border-teal-700" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B. 買い物中（スーパーマーケット店内） */}
      {scene === 'shopping' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#eaf6ee] via-[#d0f2dc] to-[#aee4c1] overflow-hidden pointer-events-none">
          {/* 天井の照明ライン */}
          <div className="absolute top-0 inset-x-0 h-4 bg-stone-200/90 border-b border-stone-300 flex items-center justify-around px-6">
            <div className="w-24 h-1 bg-white rounded-full shadow-xs" />
            <div className="w-24 h-1 bg-white rounded-full shadow-xs" />
            <div className="w-24 h-1 bg-white rounded-full shadow-xs" />
          </div>

          {/* 特売POPバナー */}
          <div className="absolute top-5 left-38 sm:left-48 px-2.5 py-0.5 bg-red-600 text-yellow-300 font-extrabold text-[10px] sm:text-xs rounded shadow-xs -rotate-3 border border-yellow-300 tracking-wider z-0">
            ★ 本日特売市 ★
          </div>

          {/* 陳列棚（中央から右端まで広がり、Statusの背後にも透けて見える） */}
          <div className="absolute top-10 sm:top-12 left-38 sm:left-48 right-4 sm:right-6 h-18 sm:h-22 bg-white/75 dark:bg-stone-900/60 rounded-lg border border-emerald-300/70 shadow-xs p-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-between px-1 text-[9px] sm:text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border-b border-stone-200 dark:border-stone-750">
              <span>新鮮野菜・青果コーナー</span>
              <span className="text-stone-500 dark:text-stone-400 font-normal">産地直送品</span>
            </div>
            <div className="flex items-center justify-around text-base sm:text-lg">
              <span title="トマト">🍅</span>
              <span title="キャベツ">🥬</span>
              <span title="にんじん">🥕</span>
              <span title="たまねぎ">🧅</span>
              <span title="きのこ">🍄</span>
            </div>
            <div className="flex items-center justify-around text-[8px] sm:text-[9px] font-mono font-bold text-red-600 bg-red-50/80 rounded py-0.5">
              <span>¥128</span>
              <span>¥158</span>
              <span>¥98</span>
              <span>¥198</span>
            </div>
          </div>

          {/* 通路の床 */}
          <div className="absolute bottom-0 left-0 right-0 h-22 sm:h-26 bg-gradient-to-t from-[#c6e6d4] to-[#dcf4e5] border-t-2 border-emerald-400/60">
            <div className="w-full h-full opacity-30 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:14px_14px]" />
            {/* 買い物カゴ（ポコ太の足元脇） */}
            <div className="absolute bottom-2 left-38 sm:left-48 w-13 h-10 bg-red-500/90 rounded-b-lg border border-red-700 shadow-xs flex items-center justify-center">
              <div className="w-9 h-6 border border-white/50 rounded flex flex-col justify-around">
                <div className="h-0.5 bg-white/60" />
              </div>
              <div className="absolute -top-2 inset-x-1.5 h-3.5 border-2 border-red-700 rounded-t-full" />
            </div>
          </div>
        </div>
      )}

      {/* C. 帰宅後・調理前（キッチン・調理台） */}
      {scene === 'after_shopping' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#fef5d6] via-[#fae8b0] to-[#f5d084] overflow-hidden pointer-events-none">
          {/* タイル壁 */}
          <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#b45309_1px,transparent_1px),linear-gradient(to_bottom,#b45309_1px,transparent_1px)] [background-size:20px_20px]" />

          {/* 調理器具ラック（Statusの背後まで伸びる） */}
          <div className="absolute top-5 left-36 sm:left-48 right-4 sm:right-8 h-0.5 bg-stone-500 rounded flex items-center justify-around">
            <div className="w-3 h-5 rounded-b-full bg-stone-700" title="おたま" />
            <div className="w-2.5 h-6 rounded-b-sm bg-amber-800" title="木べら" />
            <div className="w-3.5 h-5 rounded-b-full border border-stone-600" title="フライ返し" />
          </div>

          {/* 調理台カウンター */}
          <div className="absolute bottom-0 left-0 right-0 h-22 sm:h-26 bg-gradient-to-t from-[#e2e8f0] via-[#f1f5f9] to-[#ffffff] border-t-3 border-stone-300 shadow-md">
            {/* まな板 */}
            <div className="absolute top-2 left-38 sm:left-48 w-20 h-13 bg-[#fed7aa] rounded border border-[#ea580c]/30 shadow-xs rotate-1 p-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🥕</span>
                <span className="text-xs">🧅</span>
              </div>
              <div className="absolute -right-2 top-2 w-11 h-2 bg-stone-300 border border-stone-400 rounded-r shadow-xs -rotate-6" />
            </div>

            {/* クラフト紙袋（ネギ・フランスパン） */}
            <div className="absolute top-1.5 left-60 sm:left-74 w-13 h-18 bg-[#d97706] rounded-b shadow-sm border border-[#b45309] p-1">
              <div className="absolute -top-5 left-1 text-lg drop-shadow-xs -rotate-12">🥖</div>
              <div className="absolute -top-6 right-1 text-lg drop-shadow-xs rotate-6">🥬</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. 左上：対話履歴ボタン（ポコ太と重ならず、Statusと対をなす半透明デザイン） */}
      {/* ============================================================ */}
      {onOpenHistory && (
        <button
          type="button"
          id="btn-scene-conversation-history"
          onClick={onOpenHistory}
          title="これまでの会話履歴を振り返る"
          className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl sm:rounded-2xl bg-white/50 dark:bg-stone-950/50 hover:bg-white/65 dark:hover:bg-stone-950/65 active:scale-95 backdrop-blur-md border border-white/60 dark:border-white/15 shadow-sm text-xs font-bold text-stone-800 dark:text-stone-100 transition-all cursor-pointer select-none"
        >
          <History className="w-3.5 h-3.5 text-stone-700 dark:text-stone-300" />
          <span>履歴</span>
          {historyCount !== undefined && historyCount > 0 && (
            <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
              ({historyCount})
            </span>
          )}
        </button>
      )}

      {/* ============================================================ */}
      {/* 3. 左側：ポコ太（現在のシーン世界の中に立つアシスタント） */}
      {/* ============================================================ */}
      <div
        id="scene-character-container"
        className="absolute bottom-0 left-1.5 sm:left-4 z-10 flex flex-col items-center pointer-events-auto select-none"
      >
        {/* ポコ太 SVGキャラクター（存在感を保ちつつ、左上履歴ボタン枠のすぐ下に耳が収まる微調整サイズ） */}
        <div className="relative w-[154px] h-[212px] sm:w-[162px] sm:h-[224px] shrink-0 drop-shadow-md transition-transform hover:scale-[1.01]">
          {/* 考え中エフェクト（ポコ太の頭上・耳の間に収まり、画面上端で切れない安全な位置） */}
          {isTyping && (
            <div
              id="pocota-thinking-indicator"
              className="absolute top-1 sm:top-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-md shadow-md border border-emerald-400 dark:border-emerald-600 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-pulse whitespace-nowrap pointer-events-none"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span>考え中...</span>
            </div>
          )}

          <svg
            viewBox="0 0 160 220"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="tanukiBody" x1="80" y1="50" x2="80" y2="210" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8d5b4c" />
                <stop offset="0.6" stopColor="#6e4336" />
                <stop offset="1" stopColor="#543026" />
              </linearGradient>

              <linearGradient id="bellyCream" x1="80" y1="120" x2="80" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fff7ed" />
                <stop offset="1" stopColor="#fed7aa" />
              </linearGradient>

              <linearGradient id="shoppingApron" x1="80" y1="130" x2="80" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="kitchenApron" x1="80" y1="130" x2="80" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f59e0b" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
            </defs>

            {/* ふさふさのタヌキのしっぽ */}
            <g className="animate-pulse" style={{ animationDuration: '3s' }}>
              <path
                d="M115 155 C145 145, 160 170, 145 195 C135 210, 105 205, 100 185 Z"
                fill="#543026"
              />
              <path d="M125 155 C135 160, 140 175, 130 185" stroke="#291813" strokeWidth="6" strokeLinecap="round" />
              <path d="M135 175 C145 180, 145 195, 138 200" stroke="#291813" strokeWidth="6" strokeLinecap="round" />
            </g>

            {/* 耳 */}
            <g>
              <circle cx="48" cy="48" r="18" fill="#543026" />
              <circle cx="48" cy="48" r="10" fill="#fed7aa" />
              <circle cx="112" cy="48" r="18" fill="#543026" />
              <circle cx="112" cy="48" r="10" fill="#fed7aa" />
            </g>

            {/* まんまる胴体 */}
            <ellipse cx="80" cy="155" rx="46" ry="50" fill="url(#tanukiBody)" />
            {/* お腹 */}
            <ellipse cx="80" cy="160" rx="32" ry="36" fill="url(#bellyCream)" />

            {/* まんまる頭部 */}
            <ellipse cx="80" cy="82" rx="44" ry="38" fill="url(#tanukiBody)" />

            {/* 目の周りのマスクパッチ */}
            <ellipse cx="58" cy="82" rx="17" ry="14" fill="#3b2219" transform="rotate(-8 58 82)" />
            <ellipse cx="102" cy="82" rx="17" ry="14" fill="#3b2219" transform="rotate(8 102 82)" />

            {/* マズル（口元） */}
            <ellipse cx="80" cy="92" rx="18" ry="14" fill="#fff7ed" />
            {/* 黒い鼻 */}
            <ellipse cx="80" cy="86" rx="5" ry="3.5" fill="#1c1917" />
            {/* 口 */}
            <path d="M75 92 Q80 96 85 92" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" fill="none" />

            {/* 瞳 */}
            <circle cx="58" cy="80" r="5" fill="#1c1917" />
            <circle cx="60" cy="78" r="2" fill="#ffffff" />
            <circle cx="102" cy="80" r="5" fill="#1c1917" />
            <circle cx="104" cy="78" r="2" fill="#ffffff" />

            {/* ほっぺ */}
            <ellipse cx="44" cy="90" rx="6" ry="3.5" fill="#fca5a5" opacity="0.75" />
            <ellipse cx="116" cy="90" rx="6" ry="3.5" fill="#fca5a5" opacity="0.75" />

            {/* シーン衣装 */}
            {scene === 'shopping' && (
              <g>
                <path
                  d="M52 135 C52 125, 108 125, 108 135 L112 185 C112 195, 48 195, 48 185 Z"
                  fill="url(#shoppingApron)"
                  stroke="#065f46"
                  strokeWidth="1.5"
                />
                <path d="M60 135 Q80 115 100 135" stroke="#065f46" strokeWidth="2.5" fill="none" />
                <rect x="70" y="145" width="20" height="15" rx="3" fill="#047857" />
                <circle cx="80" cy="152" r="3" fill="#34d399" />
              </g>
            )}

            {scene === 'after_shopping' && (
              <g>
                <path
                  d="M52 135 C52 125, 108 125, 108 135 L112 185 C112 195, 48 195, 48 185 Z"
                  fill="url(#kitchenApron)"
                  stroke="#92400e"
                  strokeWidth="1.5"
                />
                <path d="M60 135 Q80 115 100 135" stroke="#92400e" strokeWidth="2.5" fill="none" />
                <circle cx="80" cy="152" r="4" fill="#ffffff" opacity="0.8" />
              </g>
            )}

            {/* 専門家装飾 */}
            {expertMeta?.type === 'fish' && (
              <g>
                <path d="M40 58 C60 48, 100 48, 120 58" stroke="#0284c7" strokeWidth="7" strokeLinecap="round" />
                <path d="M42 58 C62 48, 98 48, 118 58" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 4" />
                <circle cx="38" cy="60" r="4" fill="#0284c7" />
              </g>
            )}

            {expertMeta?.type === 'meat' && (
              <g>
                <path d="M40 58 C60 48, 100 48, 120 58" stroke="#e11d48" strokeWidth="6" strokeLinecap="round" />
                <circle cx="38" cy="60" r="4" fill="#e11d48" />
              </g>
            )}

            {expertMeta?.type === 'vegetable' && (
              <g>
                <path d="M40 58 C60 48, 100 48, 120 58" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" />
                <circle cx="38" cy="60" r="4" fill="#16a34a" />
              </g>
            )}

            {expertMeta?.type === 'chef' && (
              <g>
                <path d="M58 48 C50 30, 60 15, 80 15 C100 15, 110 30, 102 48 Z" fill="#ffffff" stroke="#d6d3d1" strokeWidth="2" />
                <rect x="62" y="44" width="36" height="8" rx="2" fill="#f5f5f4" stroke="#d6d3d1" />
              </g>
            )}

            {expertMeta?.type === 'bargain' && (
              <g transform="translate(100, 115) rotate(15)">
                <circle cx="12" cy="12" r="10" fill="#67e8f9" fillOpacity="0.3" stroke="#eab308" strokeWidth="3" />
                <rect x="10" y="22" width="4" height="12" rx="1.5" fill="#78350f" />
              </g>
            )}

            {/* 手足 */}
            <ellipse cx="44" cy="142" rx="8" ry="7" fill="#44261c" />
            <ellipse cx="116" cy="142" rx="8" ry="7" fill="#44261c" />
            <ellipse cx="64" cy="202" rx="12" ry="8" fill="#3b2219" />
            <ellipse cx="96" cy="202" rx="12" ry="8" fill="#3b2219" />
          </svg>
        </div>

        {/* ポコ太のネームタグ */}
        <div className="-mt-1 mb-1 px-3 py-0.5 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-xs border border-stone-200/90 dark:border-stone-700 shadow-2xs text-xs sm:text-[13px] font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
          <span>ポコ太</span>
          {expertMeta && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
              · {expertMeta.label}
            </span>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. 右側：Statusカード（上部シーン文字は「大」を基準にし、読みやすい大きさ） */}
      {/* ============================================================ */}
      <div
        id="scene-stage-status-card"
        onClick={onOpenStatusDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenStatusDetail();
          }
        }}
        title="タップして詳しいステータス・認識詳細を確認"
        className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bottom-2.5 sm:bottom-3 z-20 w-[185px] sm:w-[215px] md:w-[235px] bg-white/45 dark:bg-stone-950/45 hover:bg-white/55 dark:hover:bg-stone-950/55 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/15 shadow-sm p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99] group text-left"
      >
        {/* カード最上部：現在のシーン表示（「大」基準でハッキリ視認） */}
        <div className="flex items-center justify-between border-b border-stone-800/10 dark:border-white/10 pb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14.5px] sm:text-base font-bold text-stone-950 dark:text-white truncate drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {sceneHeader.title}
            </span>
          </div>
          <span className="w-5 h-5 rounded-full bg-white/70 dark:bg-stone-800/70 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 flex items-center justify-center transition-colors shrink-0 shadow-2xs">
            <ChevronRight className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors" />
          </span>
        </div>

        {/* カード中央〜下部：現在の状態（候補・状態テキストも「大」基準で読みやすく表示） */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 py-1 min-h-0 overflow-hidden">
          {displayStatusLines.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-stone-900 dark:text-stone-100 min-w-0 bg-white/45 dark:bg-black/35 backdrop-blur-xs rounded-lg px-2.5 py-1 border border-white/40 dark:border-white/5 shadow-2xs"
            >
              <span className="text-base shrink-0 leading-none">{item.icon}</span>
              <span className="truncate text-[12.5px] sm:text-[13.5px] font-semibold leading-tight text-stone-900 dark:text-stone-100 drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                {item.text}
              </span>
              {item.badge && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/90 text-white font-bold shadow-2xs">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 最下部の控えめなヒント */}
        <div className="pt-1 border-t border-stone-800/10 dark:border-white/10 flex items-center justify-between text-[10.5px] sm:text-[11px] text-stone-700 dark:text-stone-300 font-medium shrink-0">
          <span className="drop-shadow-2xs">状況タップで詳細</span>
          <span className="text-[9.5px] font-mono font-bold text-stone-800 dark:text-stone-200 opacity-80">STATUS</span>
        </div>
      </div>
    </div>
  );
};
