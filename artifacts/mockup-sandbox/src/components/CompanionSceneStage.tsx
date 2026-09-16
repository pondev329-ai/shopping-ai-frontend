import React from 'react';
import {
  AppScene,
} from '../types/chat';
import { SessionStatusSummary } from '../types/session';
import {
  ShoppingBag,
  Utensils,
  BookOpen,
  Fish,
  Beef,
  ChefHat,
  Tag,
  Sparkles,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';

interface CompanionSceneStageProps {
  scene: AppScene;
  expertMode?: string | null;
  statusSummary?: SessionStatusSummary;
  latestAssistantMessage?: string;
  isTyping?: boolean;
  onOpenStatusDetail: () => void;
  onQuickPrompt?: (text: string) => void;
}

/**
 * 専門家モード定義
 */
function getExpertMeta(expertMode?: string | null) {
  if (!expertMode) return null;
  const lower = expertMode.toLowerCase();

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
    title: `${expertMode} 専門家`,
    label: expertMode,
    icon: Sparkles,
    badgeStyle: 'bg-purple-600 text-white border-purple-500 shadow-xs',
    description: '専門的視点でアドバイス中',
  };
}

export const CompanionSceneStage: React.FC<CompanionSceneStageProps> = ({
  scene,
  expertMode,
  statusSummary,
  latestAssistantMessage,
  isTyping = false,
  onOpenStatusDetail,
  onQuickPrompt,
}) => {
  const expertMeta = getExpertMeta(expertMode);

  // シーンごとの基本情報と背景カラー・環境設定
  const sceneConfig = {
    planning: {
      name: '自宅・リビング（献立計画中）',
      chipLabel: '📝 献立相談',
      characterRole: '今日の相談役（ポコ太）',
      defaultCue: '今夜の献立、一緒に考えよう！「20分で作りたい」「冷蔵庫に豚肉があるよ」など教えてね。',
      quickPrompts: [
        '短時間（20分以内）で作れる候補は？',
        '冷蔵庫の余り物を使い切りたい',
        'がっつり主菜とさっぱり副菜の組み合わせ',
      ],
    },
    shopping: {
      name: 'スーパーマーケット店内（お買い物中）',
      chipLabel: '🛒 買物中',
      characterRole: 'お買物ナビゲーター（ポコ太）',
      defaultCue: 'スーパーに到着！売り場で迷ったら、写真や値札を見せてね。どっちがお得か一緒に見極めるよ！',
      quickPrompts: [
        'この特売シールのお肉、今夜使える？',
        '買い足すべき野菜は何？',
        'いまカゴに入れたもので代用できる？',
      ],
    },
    after_shopping: {
      name: 'キッチン・調理台（帰宅・調理前）',
      chipLabel: '🍳 調理前',
      characterRole: 'キッチン調理パートナー（ポコ太）',
      defaultCue: '買い物お疲れさま！買ってきた食材を使って、一番楽な手順でちゃちゃっと作っちゃおう！',
      quickPrompts: [
        'まず何から切り始める？',
        '余った食材はどう保存するのが正解？',
        'フライパンひとつでできる手順は？',
      ],
    },
  }[scene] || {
    name: '献立・買い物相談',
    chipLabel: '📝 相談中',
    characterRole: '相談役（ポコ太）',
    defaultCue: '今日の食事について何でも聞いてね！',
    quickPrompts: ['今日の提案を教えて'],
  };

  // アシスタントからの最新メッセージの抜粋（吹き出し用）
  const displaySpeech = latestAssistantMessage
    ? latestAssistantMessage
        .replace(/^[#\s*]+/, '')
        .split('\n')[0]
        .slice(0, 95)
    : sceneConfig.defaultCue;

  // 脇役としてのステータス概要サマリー
  const candidateCount = statusSummary?.candidates?.length || 0;
  const undecidedItems = statusSummary?.undecided || [];
  const undecidedPreview =
    undecidedItems.length > 0 ? undecidedItems[0].slice(0, 10) : '条件未確定';
  const hasShoppingProgress =
    scene === 'shopping' && statusSummary?.shoppingProgress?.totalItems;

  return (
    <div
      id="companion-scene-stage"
      aria-label="現在のシーンとアシスタントキャラクター"
      className="relative w-full h-[46vh] min-h-[300px] max-h-[440px] rounded-3xl overflow-hidden shadow-md select-none border border-stone-200/90 transition-all"
    >
      {/* ============================================================ */}
      {/* 1. シーン背景イラスト (Scene Environments) */}
      {/* ============================================================ */}

      {/* A. 計画中（自宅・リビング・夕方の机） */}
      {scene === 'planning' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#fbf3e8] via-[#f7e6d0] to-[#ecd3b5] overflow-hidden">
          {/* 夕暮れの窓 */}
          <div className="absolute top-4 right-6 w-32 h-44 rounded-t-full border-4 border-white/80 bg-gradient-to-b from-[#fcd34d] via-[#fb923c] to-[#fda4af] opacity-80 shadow-inner overflow-hidden">
            {/* 窓の桟 */}
            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/70" />
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-white/70" />
            {/* 遠くの山・木々のシルエット */}
            <div className="absolute -bottom-2 -left-2 w-20 h-10 rounded-full bg-amber-800/20 blur-xs" />
            <div className="absolute -bottom-4 right-0 w-24 h-14 rounded-full bg-amber-900/25 blur-xs" />
          </div>

          {/* 天井のペンダントライト */}
          <div className="absolute top-0 left-1/3 -translate-x-1/2 flex flex-col items-center opacity-85">
            <div className="w-0.5 h-10 bg-stone-500/60" />
            <div className="w-12 h-6 rounded-t-full bg-stone-700 shadow-sm" />
            <div className="w-8 h-2 rounded-b-full bg-amber-200 shadow-md" />
            {/* 柔らかな光の円錐 */}
            <div className="w-48 h-64 bg-gradient-to-b from-amber-300/25 to-transparent blur-md pointer-events-none -mt-1" />
          </div>

          {/* 部屋の壁のインテリア（時計・ポスター） */}
          <div className="absolute top-7 left-6 w-10 h-10 rounded-full border-2 border-stone-400 bg-white/80 flex items-center justify-center shadow-2xs">
            <div className="w-3.5 h-0.5 bg-stone-600 origin-right -rotate-45" />
            <div className="w-2.5 h-0.5 bg-stone-600 origin-right rotate-45 absolute" />
          </div>

          {/* 木目のダイニングテーブル */}
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#c29671] via-[#d4a984] to-[#deb592] border-t-4 border-[#ad7f58] shadow-lg">
            {/* テーブルの上の献立ノート & ペン */}
            <div className="absolute -top-6 left-6 w-24 h-16 bg-amber-50 rounded-lg shadow-sm border border-stone-300 -rotate-3 p-1.5 flex flex-col justify-between">
              <div className="text-[8px] font-bold text-stone-600 flex items-center gap-1 border-b border-stone-200 pb-0.5">
                <span>📖 献立メモ</span>
              </div>
              <div className="space-y-1 py-0.5">
                <div className="w-16 h-1 bg-stone-300/80 rounded" />
                <div className="w-12 h-1 bg-stone-300/80 rounded" />
                <div className="w-14 h-1 bg-stone-300/80 rounded" />
              </div>
              {/* ペン */}
              <div className="absolute -right-2 top-2 w-14 h-1 bg-emerald-700 rounded-full rotate-12 shadow-2xs" />
            </div>

            {/* 温かいマグカップ */}
            <div className="absolute -top-7 right-8 flex flex-col items-center">
              {/* 湯気 */}
              <div className="w-1 h-3 bg-white/60 rounded-full blur-[0.5px] animate-pulse -mb-1" />
              <div className="w-7 h-8 rounded-b-xl bg-teal-600 border border-teal-700 shadow-sm relative">
                <div className="absolute -right-2 top-1.5 w-3 h-4 rounded-r-full border-2 border-teal-700" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B. 買い物中（スーパーマーケット店内） */}
      {scene === 'shopping' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#e6f4ea] via-[#cbf0d8] to-[#a8e2bc] overflow-hidden">
          {/* スーパーの店内天井照明ライン */}
          <div className="absolute top-0 inset-x-0 h-6 bg-stone-200 border-b border-stone-300 flex items-center justify-around px-4">
            <div className="w-20 h-1.5 bg-white rounded-full shadow-xs" />
            <div className="w-20 h-1.5 bg-white rounded-full shadow-xs" />
            <div className="w-20 h-1.5 bg-white rounded-full shadow-xs" />
          </div>

          {/* 店頭の特売・POPバナー */}
          <div className="absolute top-9 left-6 px-2.5 py-1 bg-red-600 text-yellow-300 font-extrabold text-[11px] rounded-md shadow-sm -rotate-6 border border-yellow-300 tracking-wider">
            ★ 本日特売市 ★
          </div>
          <div className="absolute top-10 right-8 px-2 py-0.5 bg-amber-400 text-stone-900 font-bold text-[10px] rounded shadow-sm rotate-3 border border-amber-500">
            鮮度宣言！
          </div>

          {/* 背景の陳列棚（野菜・果物・食材の彩り） */}
          <div className="absolute top-20 inset-x-4 h-24 bg-white/85 rounded-xl border border-emerald-300/80 shadow-xs p-2 flex flex-col justify-between">
            {/* 上段棚 */}
            <div className="flex items-center justify-between px-2 pb-1 border-b border-stone-200">
              <span className="text-[10px] font-bold text-emerald-800">新鮮野菜・青果コーナー</span>
              <span className="text-[9px] text-stone-500">産地直送</span>
            </div>
            {/* 商品アイコン並び */}
            <div className="flex items-center justify-around text-lg">
              <span title="トマト" className="drop-shadow-xs">🍅</span>
              <span title="キャベツ" className="drop-shadow-xs">🥬</span>
              <span title="にんじん" className="drop-shadow-xs">🥕</span>
              <span title="たまねぎ" className="drop-shadow-xs">🧅</span>
              <span title="きのこ" className="drop-shadow-xs">🍄</span>
              <span title="お魚" className="drop-shadow-xs">🐟</span>
            </div>
            {/* 値札POPバー */}
            <div className="flex items-center justify-around text-[9px] font-mono font-bold text-red-600 bg-red-50 py-0.5 rounded">
              <span>¥128</span>
              <span>¥158</span>
              <span>¥98</span>
              <span>¥198</span>
              <span>¥298</span>
            </div>
          </div>

          {/* 店内の通路・床 */}
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#c6e6d4] to-[#dcf4e5] border-t-2 border-emerald-400/60">
            {/* 通路のタイル模様 */}
            <div className="w-full h-full opacity-35 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:16px_16px]" />
            {/* 買い物カゴ */}
            <div className="absolute bottom-3 left-6 w-16 h-12 bg-red-500/90 rounded-b-xl rounded-t-sm border-2 border-red-700 shadow-md flex items-center justify-center">
              <div className="w-12 h-8 border border-white/50 rounded flex flex-col justify-around p-0.5">
                <div className="h-0.5 bg-white/60" />
                <div className="h-0.5 bg-white/60" />
              </div>
              {/* カゴの持ち手 */}
              <div className="absolute -top-3 inset-x-2 h-4 border-2 border-red-700 rounded-t-full" />
            </div>
          </div>
        </div>
      )}

      {/* C. 帰宅後・調理前（キッチン・調理台） */}
      {scene === 'after_shopping' && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#fef3c7] via-[#fae8b0] to-[#f5d084] overflow-hidden">
          {/* キッチンのタイル壁 */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#b45309_1px,transparent_1px),linear-gradient(to_bottom,#b45309_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* 調理器具の吊り下げラック */}
          <div className="absolute top-5 inset-x-8 h-1 bg-stone-500 rounded flex items-center justify-around">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-stone-600" />
              <div className="w-3 h-5 rounded-b-full bg-stone-700" title="おたま" />
            </div>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-stone-600" />
              <div className="w-2.5 h-6 rounded-b-sm bg-amber-800" title="木べら" />
            </div>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-stone-600" />
              <div className="w-4 h-5 rounded-b-full border border-stone-600" title="フライ返し" />
            </div>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-stone-600" />
              <div className="w-3 h-4 rounded-full bg-stone-600" title="計量スプーン" />
            </div>
          </div>

          {/* 清潔なステンレス調理台 / カウンター */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#e2e8f0] via-[#f1f5f9] to-[#ffffff] border-t-4 border-stone-300 shadow-lg">
            {/* まな板 & 包丁 */}
            <div className="absolute top-3 left-6 w-24 h-16 bg-[#fed7aa] rounded-md border border-[#ea580c]/40 shadow-sm rotate-2 p-1">
              {/* 切られた食材 */}
              <div className="flex items-center gap-1 mt-1 ml-1">
                <span className="text-sm">🥕</span>
                <span className="text-xs">🧅</span>
              </div>
              {/* 包丁 */}
              <div className="absolute -right-3 top-2 w-14 h-3 bg-stone-300 border border-stone-400 rounded-r-xs shadow-xs -rotate-12 flex items-center">
                <div className="w-4 h-full bg-stone-800 rounded-l-xs" />
              </div>
            </div>

            {/* 買ってきた食材のクラフト紙袋（ネギ・バゲットが覗く） */}
            <div className="absolute top-1 right-6 w-16 h-22 bg-[#d97706] rounded-t-sm rounded-b-md shadow-md border border-[#b45309] p-1 flex flex-col justify-between">
              {/* 飛び出す長ネギ & フランスパン */}
              <div className="absolute -top-7 left-2 text-xl drop-shadow-xs -rotate-12">
                🥖
              </div>
              <div className="absolute -top-8 right-2 text-xl drop-shadow-xs rotate-6">
                🥬
              </div>
              <div className="text-[7px] text-amber-950/70 font-mono text-center pt-2">
                SHOPPING
              </div>
            </div>

            {/* フライパン */}
            <div className="absolute top-8 left-36 w-14 h-14 rounded-full bg-stone-800 border-2 border-stone-600 shadow-md flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border border-stone-700 bg-stone-900/60" />
              {/* 取っ手 */}
              <div className="absolute -right-7 top-1/2 -translate-y-1/2 w-8 h-2.5 bg-stone-700 rounded-r shadow-xs" />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. 脇役としての現在ステータス（HUD / Floating Status Chip Bar） */}
      {/* ============================================================ */}
      <div
        id="scene-hud-status-bar"
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5"
      >
        <button
          type="button"
          id="btn-scene-hud-open-status"
          onClick={onOpenStatusDetail}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white active:scale-95 text-stone-800 border border-stone-300 shadow-sm backdrop-blur-md transition-all cursor-pointer"
          title="タップして詳細ステータス・認識ボードを表示"
        >
          {/* シーンラベル */}
          <span className="text-xs font-bold text-stone-900 shrink-0">
            {sceneConfig.chipLabel}
          </span>

          <span className="w-1 h-3 bg-stone-300 rounded-full" />

          {/* 候補数 */}
          <span className="text-[11px] font-semibold text-emerald-800 shrink-0 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
            候補 {candidateCount}
          </span>

          {/* 未確定/進行度概要 */}
          {hasShoppingProgress ? (
            <span className="text-[11px] text-teal-800 shrink-0 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 font-mono">
              進行 {statusSummary?.shoppingProgress?.collectedItems || 0}/
              {statusSummary?.shoppingProgress?.totalItems || 0}
            </span>
          ) : (
            <span className="text-[11px] text-amber-900 shrink-0 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 max-w-[80px] truncate">
              {undecidedPreview}
            </span>
          )}

          {/* 展開アイコン */}
          <span className="w-5 h-5 rounded-full bg-stone-100 group-hover:bg-emerald-100 group-hover:text-emerald-800 flex items-center justify-center transition-colors">
            <ChevronRight className="w-3 h-3 text-stone-500 group-hover:text-emerald-700" />
          </span>
        </button>
      </div>

      {/* 左上の専門家モードバッジ（専門家モード発動時のみ表示） */}
      {expertMeta && (
        <div
          id="scene-hud-expert-badge"
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200 bg-white/95 text-stone-800"
          title={expertMeta.title}
        >
          <span className={`p-1 rounded-full ${expertMeta.badgeStyle}`}>
            <expertMeta.icon className="w-3 h-3 text-white" />
          </span>
          <span className="font-bold text-[11px]">{expertMeta.label}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. メインキャラクター：ポコ太（愛嬌あるタヌキのアシスタント） */}
      {/* ============================================================ */}
      <div
        id="scene-character-container"
        className="absolute bottom-2 sm:bottom-3 left-4 sm:left-8 z-10 flex items-end gap-3 pointer-events-auto"
      >
        {/* タヌキのポコ太 SVGキャラクター */}
        <div className="relative w-32 h-44 sm:w-38 sm:h-52 drop-shadow-xl transition-transform hover:scale-[1.02]">
          <svg
            viewBox="0 0 160 220"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* タヌキの毛並みグラデーション */}
              <linearGradient id="tanukiBody" x1="80" y1="50" x2="80" y2="210" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8d5b4c" />
                <stop offset="0.6" stopColor="#6e4336" />
                <stop offset="1" stopColor="#543026" />
              </linearGradient>

              {/* お腹のふんわりクリーム色 */}
              <linearGradient id="bellyCream" x1="80" y1="120" x2="80" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fff7ed" />
                <stop offset="1" stopColor="#fed7aa" />
              </linearGradient>

              {/* シーン別エプロン・服グラデーション */}
              <linearGradient id="shoppingApron" x1="80" y1="130" x2="80" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="kitchenApron" x1="80" y1="130" x2="80" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f59e0b" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
            </defs>

            {/* ふさふさのタヌキのしっぽ（後ろで揺れる） */}
            <g className="animate-pulse" style={{ animationDuration: '3s' }}>
              <path
                d="M115 155 C145 145, 160 170, 145 195 C135 210, 105 205, 100 185 Z"
                fill="#543026"
              />
              {/* しっぽの黒い縞模様 */}
              <path d="M125 155 C135 160, 140 175, 130 185" stroke="#291813" strokeWidth="6" strokeLinecap="round" />
              <path d="M135 175 C145 180, 145 195, 138 200" stroke="#291813" strokeWidth="6" strokeLinecap="round" />
            </g>

            {/* 丸い耳（左耳・右耳） */}
            <g>
              {/* 左耳 */}
              <circle cx="48" cy="48" r="18" fill="#543026" />
              <circle cx="48" cy="48" r="10" fill="#fed7aa" />
              {/* 右耳 */}
              <circle cx="112" cy="48" r="18" fill="#543026" />
              <circle cx="112" cy="48" r="10" fill="#fed7aa" />
            </g>

            {/* まんまる胴体 */}
            <ellipse cx="80" cy="155" rx="46" ry="50" fill="url(#tanukiBody)" />

            {/* お腹のふかふかパッチ */}
            <ellipse cx="80" cy="160" rx="32" ry="36" fill="url(#bellyCream)" />

            {/* まんまる頭部 */}
            <ellipse cx="80" cy="82" rx="44" ry="38" fill="url(#tanukiBody)" />

            {/* タヌキのチャームポイント：目の周りの黒いマスクパッチ */}
            <ellipse cx="58" cy="82" rx="17" ry="14" fill="#3b2219" transform="rotate(-8 58 82)" />
            <ellipse cx="102" cy="82" rx="17" ry="14" fill="#3b2219" transform="rotate(8 102 82)" />

            {/* ふっくら白いマズル（鼻・口元） */}
            <ellipse cx="80" cy="92" rx="18" ry="14" fill="#fff7ed" />

            {/* つやつやの黒いお鼻 */}
            <ellipse cx="80" cy="86" rx="5" ry="3.5" fill="#1c1917" />

            {/* にっこり口元 */}
            <path
              d="M75 92 Q80 96 85 92"
              stroke="#1c1917"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* くりくりのつぶらな瞳 */}
            <g>
              <circle cx="58" cy="80" r="5" fill="#1c1917" />
              <circle cx="60" cy="78" r="2" fill="#ffffff" />
              <circle cx="102" cy="80" r="5" fill="#1c1917" />
              <circle cx="104" cy="78" r="2" fill="#ffffff" />
            </g>

            {/* ほんのりピンクのほっぺ */}
            <ellipse cx="44" cy="90" rx="6" ry="3.5" fill="#fca5a5" opacity="0.75" />
            <ellipse cx="116" cy="90" rx="6" ry="3.5" fill="#fca5a5" opacity="0.75" />

            {/* シーン別・専門家別の衣装 & アイテム */}

            {/* A. 買い物中：緑のエプロン & 買い物かご */}
            {scene === 'shopping' && (
              <g>
                {/* エプロン本体 */}
                <path
                  d="M52 135 C52 125, 108 125, 108 135 L112 185 C112 195, 48 195, 48 185 Z"
                  fill="url(#shoppingApron)"
                  stroke="#065f46"
                  strokeWidth="1.5"
                />
                {/* エプロンの首紐 */}
                <path d="M60 135 Q80 115 100 135" stroke="#065f46" strokeWidth="2.5" fill="none" />
                {/* 胸ポケット & クローバーマーク */}
                <rect x="70" y="145" width="20" height="15" rx="3" fill="#047857" />
                <circle cx="80" cy="152" r="3" fill="#34d399" />
              </g>
            )}

            {/* B. 調理前：オレンジのエプロン & シェフスカーフ */}
            {scene === 'after_shopping' && (
              <g>
                {/* クッキングエプロン */}
                <path
                  d="M52 135 C52 125, 108 125, 108 135 L112 185 C112 195, 48 195, 48 185 Z"
                  fill="url(#kitchenApron)"
                  stroke="#92400e"
                  strokeWidth="1.5"
                />
                <path d="M60 135 Q80 115 100 135" stroke="#92400e" strokeWidth="2.5" fill="none" />
                {/* スプーンマーク */}
                <circle cx="80" cy="152" r="4" fill="#ffffff" opacity="0.8" />
              </g>
            )}

            {/* 専門家モード装飾 */}

            {/* 1. 鮮魚専門：ねじり鉢巻（青白） */}
            {expertMeta?.type === 'fish' && (
              <g>
                <path
                  d="M40 58 C60 48, 100 48, 120 58"
                  stroke="#0284c7"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M42 58 C62 48, 98 48, 118 58"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                />
                {/* 結び目 */}
                <circle cx="38" cy="60" r="4" fill="#0284c7" />
              </g>
            )}

            {/* 2. 調理シェフ：コック帽 */}
            {expertMeta?.type === 'chef' && (
              <g>
                <path
                  d="M58 48 C50 30, 60 15, 80 15 C100 15, 110 30, 102 48 Z"
                  fill="#ffffff"
                  stroke="#d6d3d1"
                  strokeWidth="2"
                />
                <rect x="62" y="44" width="36" height="8" rx="2" fill="#f5f5f4" stroke="#d6d3d1" />
              </g>
            )}

            {/* 3. 目利き専門：虫眼鏡 */}
            {expertMeta?.type === 'bargain' && (
              <g transform="translate(100, 115) rotate(15)">
                <circle cx="12" cy="12" r="10" fill="#67e8f9" fillOpacity="0.3" stroke="#eab308" strokeWidth="3" />
                <rect x="10" y="22" width="4" height="12" rx="1.5" fill="#78350f" />
              </g>
            )}

            {/* 手足（ちいさな手） */}
            <ellipse cx="44" cy="142" rx="8" ry="7" fill="#44261c" />
            <ellipse cx="116" cy="142" rx="8" ry="7" fill="#44261c" />

            {/* ちいさな足 */}
            <ellipse cx="64" cy="202" rx="12" ry="8" fill="#3b2219" />
            <ellipse cx="96" cy="202" rx="12" ry="8" fill="#3b2219" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* キャラクターの発話吹き出し (Dialogue Bubble from Pokota) */}
        {/* ============================================================ */}
        <div className="flex-1 max-w-[240px] sm:max-w-sm mb-4 sm:mb-6 animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="relative bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-stone-200/90 shadow-md">
            {/* 吹き出しの三角ヒゲ */}
            <div className="absolute -left-2.5 bottom-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white border-b-8 border-b-transparent" />

            {/* 発話ヘッダー（名前・状態） */}
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-extrabold text-stone-900 flex items-center gap-1">
                <span>ポコ太</span>
                <span className="text-[10px] font-normal text-stone-500">
                  ({sceneConfig.characterRole})
                </span>
              </span>

              {isTyping && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  考え中...
                </span>
              )}
            </div>

            {/* 発話内容 */}
            <p className="text-xs sm:text-[13px] text-stone-800 leading-relaxed font-normal">
              {displaySpeech}
            </p>

            {/* クイック相談プロンプト（タップしてすぐに質問できる） */}
            {onQuickPrompt && (
              <div className="mt-2 pt-2 border-t border-stone-100 flex flex-wrap gap-1">
                {sceneConfig.quickPrompts.slice(0, 2).map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onQuickPrompt(promptText)}
                    className="text-[10.5px] bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-stone-200 text-stone-700 px-2 py-0.5 rounded-full transition-colors cursor-pointer text-left truncate max-w-full"
                  >
                    💬 {promptText}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* シーン下部の環境名バー（控えめな位置づけ） */}
      <div className="absolute bottom-2 right-3 z-10 px-2 py-0.5 bg-black/40 backdrop-blur-xs text-white text-[10px] rounded-full font-medium">
        📍 {sceneConfig.name}
      </div>
    </div>
  );
};
