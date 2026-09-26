import React from 'react';
import {
  AppScene,
} from '../types/chat';
import {
  Sparkles,
  ShoppingBag,
  Utensils,
  BookOpen,
  Fish,
  Beef,
  Carrot,
  ChefHat,
  Tag,
  MessageSquareQuote,
  Lightbulb,
} from 'lucide-react';

interface CompanionCharacterProps {
  scene: AppScene;
  expertMode?: string | null;
  latestAssistantMessage?: string;
  isTyping?: boolean;
  onQuickPrompt?: (text: string) => void;
}

/**
 * 専門家モードの表示情報定義
 */
function getExpertInfo(expertMode?: string | null) {
  if (!expertMode) return null;
  const lower = expertMode.toLowerCase();

  if (lower.includes('meat') || lower.includes('肉') || lower.includes('精肉')) {
    return {
      title: '精肉・部位の専門家',
      shortLabel: '精肉専門',
      icon: Beef,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      tagline: '部位の特徴・特売肉の活用法を案内中',
    };
  }
  if (lower.includes('fish') || lower.includes('魚') || lower.includes('鮮魚')) {
    return {
      title: '鮮魚・お魚の専門家',
      shortLabel: '鮮魚専門',
      icon: Fish,
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      tagline: '鮮度・旬・下処理のアドバイス中',
    };
  }
  if (lower.includes('vegetable') || lower.includes('vege') || lower.includes('produce') || lower.includes('野菜') || lower.includes('青果')) {
    return {
      title: '青果・野菜の専門家',
      shortLabel: '青果専門',
      icon: Carrot,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      tagline: '鮮度・旬・保存方法を案内中',
    };
  }
  if (lower.includes('cook') || lower.includes('chef') || lower.includes('料理') || lower.includes('調理')) {
    return {
      title: '調理・時短シェフ担当',
      shortLabel: '調理担当',
      icon: ChefHat,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      tagline: '短時間・手持ち材料での段取りを提案中',
    };
  }
  if (lower.includes('bargain') || lower.includes('offer') || lower.includes('特売') || lower.includes('目利き')) {
    return {
      title: '特売・目利き担当',
      shortLabel: '目利き担当',
      icon: Tag,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      tagline: '値札シール・価格比較を分析中',
    };
  }

  return {
    title: expertMode.endsWith('専門') || expertMode.endsWith('専門家') ? expertMode : `${expertMode} 専門家`,
    shortLabel: expertMode.endsWith('専門') ? expertMode : `${expertMode}専門`,
    icon: Sparkles,
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    tagline: '専門的な知見からサポート中',
  };
}

/**
 * シーン別の表示メタ情報
 */
function getSceneInfo(scene: AppScene) {
  switch (scene) {
    case 'shopping':
      return {
        sceneName: 'スーパー買物中',
        subText: '売り場での選択・写真相談',
        icon: ShoppingBag,
        roleName: 'お買物ナビゲーター',
        ambientColor: 'from-emerald-50 to-teal-50/60 border-emerald-200',
        characterPosture: 'shopping_basket',
        defaultCue: '売り場の商品や値札の写真を送っていただければ、どれが今夜に最適か一緒に見極めます！',
      };
    case 'after_shopping':
      return {
        sceneName: '帰宅・調理前',
        subText: '買った食材からの食事づくり',
        icon: Utensils,
        roleName: 'キッチン調理パートナー',
        ambientColor: 'from-amber-50 to-orange-50/60 border-amber-200',
        characterPosture: 'cooking_apron',
        defaultCue: 'お疲れさまでした！買ってきた食材を使って、無理のない段取りで作っていきましょう。',
      };
    case 'planning':
    default:
      return {
        sceneName: '献立・方針相談',
        subText: '時間や気分・手持ちの整理',
        icon: BookOpen,
        roleName: '献立アシスタント',
        ambientColor: 'from-stone-50 to-neutral-50/80 border-stone-200',
        characterPosture: 'desk_planning',
        defaultCue: '今日の時間や気分、冷蔵庫にあるものを教えてください。いくつかの候補を一緒に考えましょう！',
      };
  }
}

export const CompanionCharacter: React.FC<CompanionCharacterProps> = ({
  scene,
  expertMode,
  latestAssistantMessage,
  isTyping = false,
  onQuickPrompt,
}) => {
  const sceneInfo = getSceneInfo(scene);
  const expertInfo = getExpertInfo(expertMode);
  const SceneIcon = sceneInfo.icon;

  // アシスタントからの最新の一言（長すぎる場合は要点を短く抽出）
  const displayCue = latestAssistantMessage
    ? latestAssistantMessage.replace(/^[#\s*]+/, '').split('\n')[0].slice(0, 95)
    : sceneInfo.defaultCue;

  return (
    <div
      id="companion-character-card"
      className={`relative rounded-2xl border p-3.5 sm:p-4 bg-gradient-to-b ${sceneInfo.ambientColor} shadow-2xs transition-all flex flex-col justify-between overflow-hidden`}
    >
      {/* 上部: シーン表示 ＆ 専門家モードバッジ */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        {/* 現在のシーンタグ */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 border border-stone-200 shadow-2xs text-xs font-semibold text-stone-800">
          <SceneIcon className="w-3.5 h-3.5 text-stone-700" />
          <span>{sceneInfo.sceneName}</span>
        </div>

        {/* 専門家モードが有効な場合 */}
        {expertInfo ? (
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold shadow-2xs ${expertInfo.badgeColor} animate-in fade-in duration-200`}
            title={`Main Flowから渡された専門家モード: ${expertInfo.title}`}
          >
            <expertInfo.icon className="w-3 h-3" />
            <span>{expertInfo.shortLabel}</span>
          </div>
        ) : (
          <div className="text-[11px] text-stone-500 font-medium px-1">
            {sceneInfo.roleName}
          </div>
        )}
      </div>

      {/* 中央: キャラクターアバター ＆ 発言吹き出し */}
      <div className="flex items-start gap-3 my-1">
        {/* キャラクターイラスト・アバター */}
        <div className="relative shrink-0 flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center justify-center overflow-hidden p-1">
            {/* シーンと専門家に応じた表現豊かなSVGアバター */}
            <svg
              viewBox="0 0 80 80"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 背景の柔らかなハロー */}
              <circle
                cx="40"
                cy="40"
                r="36"
                className={
                  scene === 'shopping'
                    ? 'fill-emerald-100/70'
                    : scene === 'after_shopping'
                    ? 'fill-amber-100/70'
                    : 'fill-stone-100'
                }
              />

              {/* 身体・服 */}
              {scene === 'shopping' ? (
                // エプロン・買物スタイル
                <path
                  d="M20 74 C20 54, 30 50, 40 50 C50 50, 60 54, 60 74 Z"
                  fill="#059669"
                />
              ) : scene === 'after_shopping' ? (
                // クッキングエプロンスタイル
                <path
                  d="M20 74 C20 54, 30 50, 40 50 C50 50, 60 54, 60 74 Z"
                  fill="#d97706"
                />
              ) : (
                // 普段着・相談スタイル
                <path
                  d="M20 74 C20 54, 30 50, 40 50 C50 50, 60 54, 60 74 Z"
                  fill="#57534e"
                />
              )}

              {/* 胸のアクセント（名札・ノート・ポケット） */}
              <rect x="36" y="56" width="8" height="10" rx="1.5" fill="#ffffff" opacity="0.9" />

              {/* 頭部 */}
              <circle cx="40" cy="32" r="16" fill="#fed7aa" />

              {/* 髪型 */}
              <path
                d="M24 30 C24 18, 30 14, 40 14 C50 14, 56 18, 56 30 C56 22, 52 20, 40 20 C28 20, 24 22, 24 30 Z"
                fill="#44403c"
              />

              {/* 目（穏やかな親しみやすい表情） */}
              <circle cx="34.5" cy="31" r="2.2" fill="#292524" />
              <circle cx="45.5" cy="31" r="2.2" fill="#292524" />
              <circle cx="35.2" cy="30.2" r="0.7" fill="#ffffff" />
              <circle cx="46.2" cy="30.2" r="0.7" fill="#ffffff" />

              {/* ほっぺた */}
              <ellipse cx="32" cy="35" rx="2.5" ry="1.2" fill="#fca5a5" opacity="0.6" />
              <ellipse cx="48" cy="35" rx="2.5" ry="1.2" fill="#fca5a5" opacity="0.6" />

              {/* 口（にっこり） */}
              <path
                d="M37 36 Q40 39 43 36"
                stroke="#78350f"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* 専門家モード時またはシーンごとの持ち物・アクセサリ */}
              {expertInfo ? (
                <circle cx="58" cy="22" r="9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
              ) : null}
            </svg>

            {/* 考え中スピナー */}
            {isTyping && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              </div>
            )}
          </div>

          {/* キャラクター名ラベル */}
          <span className="mt-1 text-[10.5px] font-medium text-stone-600 text-center leading-tight">
            {expertInfo ? expertInfo.title : sceneInfo.roleName}
          </span>
        </div>

        {/* 右側: 会話の導き・最新の気づき吹き出し */}
        <div className="flex-1 min-w-0">
          <div className="relative bg-white border border-stone-200/90 rounded-2xl p-2.5 sm:p-3 shadow-2xs text-stone-800">
            {/* 吹き出しの三角ヒゲ */}
            <div className="absolute top-4 -left-1.5 w-3 h-3 bg-white border-l border-b border-stone-200 rotate-45" />

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 mb-1">
              <MessageSquareQuote className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{isTyping ? '考え中...' : 'アシスタントの視点:'}</span>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed break-words font-normal">
              {isTyping ? 'あなたの状況に合わせて可能性を整理しています...' : displayCue}
            </p>

            {/* 専門家モードの解説テキスト */}
            {expertInfo?.tagline && !isTyping && (
              <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center gap-1 text-[10.5px] text-stone-500">
                <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{expertInfo.tagline}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 下部: シーンに合わせたクイックアクションヒント */}
      <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-500">
        <span className="truncate">{sceneInfo.subText}</span>
        {onQuickPrompt && (
          <div className="flex items-center gap-1 shrink-0">
            {scene === 'shopping' && (
              <button
                type="button"
                onClick={() => onQuickPrompt('値札や商品の写真を送って相談したい')}
                className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 hover:text-emerald-700 hover:border-emerald-400 transition-colors cursor-pointer text-[10.5px]"
              >
                写真で相談する
              </button>
            )}
            {scene === 'planning' && (
              <button
                type="button"
                onClick={() => onQuickPrompt('今日のおすすめ候補を教えて')}
                className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 hover:text-stone-900 hover:border-stone-400 transition-colors cursor-pointer text-[10.5px]"
              >
                候補を聞く
              </button>
            )}
            {scene === 'after_shopping' && (
              <button
                type="button"
                onClick={() => onQuickPrompt('買ってきたもので今すぐ作れる手順を教えて')}
                className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 hover:text-amber-800 hover:border-amber-400 transition-colors cursor-pointer text-[10.5px]"
              >
                調理段取りを確認
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
