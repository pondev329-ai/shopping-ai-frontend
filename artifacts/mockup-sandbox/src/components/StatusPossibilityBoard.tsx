import React, { useState } from 'react';
import {
  Clock,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ShoppingBag,
  ListFilter,
  ChevronRight,
  Maximize2,
  Minimize2,
  Utensils,
  Layers,
} from 'lucide-react';
import { SessionStatusSummary } from '../types/session';
import { AppScene } from '../types/chat';

interface StatusPossibilityBoardProps {
  summary: SessionStatusSummary;
  scene: AppScene;
  onSelectCandidate?: (candidateTitle: string, actionType?: 'detail' | 'ingredients') => void;
}

export const StatusPossibilityBoard: React.FC<StatusPossibilityBoardProps> = ({
  summary,
  scene,
  onSelectCandidate,
}) => {
  const [activeTab, setActiveTab] = useState<'candidates' | 'decisions' | 'possibilities'>('candidates');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const candidateCount = summary.candidates?.length || 0;
  const decidedCount = summary.decided?.length || 0;
  const undecidedCount = summary.undecided?.length || 0;

  return (
    <div
      id="status-possibility-board"
      aria-label="状況・可能性・進行状態ボード"
      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs p-3.5 sm:p-4 flex flex-col justify-between transition-all"
    >
      {/* 1. ヘッダー: 認識状況 & タブ切り替え */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">現在の認識と可能性</h2>
        </div>

        {/* タブ切り替え */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg text-[11px] font-medium text-stone-600 dark:text-stone-300">
          <button
            type="button"
            onClick={() => setActiveTab('candidates')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'candidates'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                : 'hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            候補 ({candidateCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decisions')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'decisions'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                : 'hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            決定/未定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('possibilities')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'possibilities'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                : 'hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            手持ち・条件
          </button>
        </div>
      </div>

      {/* 2. 前提・状況タグ（常にコンパクトに把握できる帯） */}
      {summary.situation && summary.situation.length > 0 && (
        <div className="py-2 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-stone-400 dark:text-stone-500 font-medium shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-400 dark:text-stone-500" />
            前提:
          </span>
          {summary.situation.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 shrink-0 font-normal"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {/* 3. メインコンテンツ領域（タブに応じた表示） */}
      <div className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto py-1 pr-0.5 space-y-2">
        {/* A. 現在の候補一覧 (Candidates) */}
        {activeTab === 'candidates' && (
          <div className="space-y-2">
            {summary.candidates && summary.candidates.length > 0 ? (
              summary.candidates.map((cand) => (
                <div
                  key={cand.id}
                  id={`candidate-card-${cand.id}`}
                  className="bg-stone-50/90 dark:bg-stone-800/80 hover:bg-stone-100/80 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700 hover:border-emerald-400 dark:hover:border-emerald-500 rounded-xl p-2.5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                          {cand.title}
                        </h3>
                        {cand.prepTimeMinutes && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-stone-500 dark:text-stone-400 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-1.5 py-0.2 rounded font-mono">
                            約{cand.prepTimeMinutes}分
                          </span>
                        )}
                        {cand.requiresShopping !== undefined && (
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-1.5 py-0.2 rounded">
                            {cand.requiresShopping ? '買い足しあり' : '手持ちで可能'}
                          </span>
                        )}
                      </div>

                      {cand.summary && (
                        <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-1 leading-snug">
                          {cand.summary}
                        </p>
                      )}

                      {/* 理由・利点の提示 */}
                      {cand.reasons && cand.reasons.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {cand.reasons.map((r, ri) => (
                            <span
                              key={ri}
                              className="text-[10px] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded"
                            >
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* タップして深掘りするボタン */}
                    {onSelectCandidate && (
                      <button
                        type="button"
                        id={`btn-ask-candidate-${cand.id}`}
                        onClick={() => onSelectCandidate(cand.title, 'detail')}
                        className="shrink-0 p-1 rounded-lg bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-400 dark:text-stone-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 group-hover:border-emerald-300 dark:group-hover:border-emerald-500 transition-colors cursor-pointer shadow-2xs"
                        title="この候補についてアシスタントに相談"
                        aria-label={`${cand.title}について相談`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-stone-400 dark:text-stone-500 text-xs">
                <Utensils className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>現在提示できる候補を整理中です。</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  「〇〇分の時短で」「手持ちの卵を使いたい」など話しかけてみてください。
                </p>
              </div>
            )}
          </div>
        )}

        {/* B. 決まったこと & まだ決まっていないこと (Decisions) */}
        {activeTab === 'decisions' && (
          <div className="space-y-3">
            {/* 決まったこと */}
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>決まったこと ({decidedCount})</span>
              </div>
              {decidedCount > 0 ? (
                <div className="space-y-1">
                  {summary.decided.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 px-2 bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2 bg-stone-50 dark:bg-stone-800/70 rounded-lg text-[11px] text-stone-400 dark:text-stone-500">
                  まだ確定した項目はありません。候補を比較しながら決められます。
                </div>
              )}
            </div>

            {/* まだ決まっていないこと */}
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>まだ決まっていないこと ({undecidedCount})</span>
              </div>
              {undecidedCount > 0 ? (
                <div className="space-y-1">
                  {summary.undecided.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 px-2 bg-amber-50/70 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-lg text-xs text-amber-950 dark:text-amber-200 flex items-start gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0" />
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2 bg-stone-50 dark:bg-stone-800/70 rounded-lg text-[11px] text-stone-400 dark:text-stone-500">
                  すべての条件が明確になっています。
                </div>
              )}
            </div>
          </div>
        )}

        {/* C. 手持ち食材 & 現在の可能性 (Possibilities) */}
        {activeTab === 'possibilities' && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>利用可能な可能性・前提材料</span>
            </div>

            {summary.possibilities && summary.possibilities.length > 0 ? (
              <div className="space-y-1.5">
                {summary.possibilities.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-800 dark:text-stone-200 leading-snug"
                  >
                    {p}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-stone-400 dark:text-stone-500 text-xs">
                特売情報や手持ちの食材を共有すると、ここに反映されます。
              </div>
            )}

            {/* 買い物進行状態がある場合 */}
            {summary.shoppingProgress && (
              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs">
                <div className="flex items-center justify-between text-emerald-950 dark:text-emerald-200 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    お買物進行状況
                  </span>
                  <span>
                    {summary.shoppingProgress.collectedItems || 0} / {summary.shoppingProgress.totalItems || 0} 点
                  </span>
                </div>
                {summary.shoppingProgress.stepDescription && (
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {summary.shoppingProgress.stepDescription}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. フッターヒント（AIが勝手に決めず、ユーザーが判断できる方針） */}
      <div className="pt-2 mt-1 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[10.5px] text-stone-400 dark:text-stone-500">
        <span>タップして各候補について相談できます</span>
        <span className="font-mono text-[10px]">
          {candidateCount}候補 / {decidedCount}決定
        </span>
      </div>
    </div>
  );
};
