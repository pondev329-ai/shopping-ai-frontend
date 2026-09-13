import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Clock,
  Utensils,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ListTodo,
} from 'lucide-react';
import { SessionStatusSummary } from '../types/session';

interface StatusSummaryCardProps {
  summary: SessionStatusSummary;
  sessionTitle: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectCandidate?: (candidateTitle: string) => void;
}

export const StatusSummaryCard: React.FC<StatusSummaryCardProps> = ({
  summary,
  sessionTitle,
  isExpanded,
  onToggleExpand,
  onSelectCandidate,
}) => {
  const candidateCount = summary.candidates.length;
  const decidedCount = summary.decided.length;
  const undecidedCount = summary.undecided.length;

  return (
    <section
      id="section-current-status-summary"
      aria-label="現在のセッションステータス"
      className="bg-white border-b border-stone-200 shadow-2xs transition-all duration-200"
    >
      {/* 概要バー（常時表示ヘッダー） */}
      <div
        id="status-summary-header-toggle"
        onClick={onToggleExpand}
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-stone-50/80 active:bg-stone-100 transition-colors select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 truncate text-xs">
            <span className="font-semibold text-stone-800">ステータス:</span>
            {candidateCount > 0 ? (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-medium">
                候補 {candidateCount}件
              </span>
            ) : (
              <span className="text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md font-medium">
                条件ヒアリング中
              </span>
            )}
            {decidedCount > 0 && (
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 font-medium hidden sm:inline-block">
                決定 {decidedCount}件
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          id="btn-toggle-status-details"
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 font-medium shrink-0 ml-2"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? '折りたたむ' : '状況を確認'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 詳細展開領域 */}
      {isExpanded && (
        <div
          id="status-summary-expanded-content"
          className="px-4 pb-3.5 pt-1 space-y-3.5 text-xs text-stone-700 animate-in fade-in slide-in-from-top-1 duration-150 border-t border-stone-100 bg-stone-50/50"
        >
          {/* 1. 今日の状況 */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-stone-800 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-600" />
              <span>今日の状況・前提</span>
            </div>
            {summary.situation.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {summary.situation.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-white border border-stone-200 text-stone-800 px-2.5 py-1 rounded-md text-[11px] font-medium shadow-2xs"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-stone-400 italic text-[11px]">アシスタントに今の気分や状況を伝えてみてください</p>
            )}
          </div>

          {/* 2. 現在の候補 */}
          {summary.candidates.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-stone-800 mb-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                <span>現在の候補（タップして深掘り）</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {summary.candidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    id={`btn-status-candidate-${cand.id}`}
                    onClick={() => onSelectCandidate?.(cand.title)}
                    className="w-full text-left p-2.5 bg-white hover:bg-emerald-50/40 active:bg-emerald-100/50 border border-stone-200 hover:border-emerald-300 rounded-lg transition-colors flex items-center justify-between gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-stone-900 group-hover:text-emerald-800 transition-colors truncate text-xs">
                        {cand.title}
                      </div>
                      {cand.summary && (
                        <div className="text-[11px] text-stone-500 truncate mt-0.5">{cand.summary}</div>
                      )}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. 現在の可能性 */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-stone-800 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>現在の可能性・手持ちリソース</span>
            </div>
            <div className="space-y-1">
              {summary.possibilities.map((pos, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-white border border-stone-200 rounded-lg text-[11px] text-stone-700 leading-relaxed shadow-2xs"
                >
                  {pos}
                </div>
              ))}
            </div>
          </div>

          {/* 4. 決まったこと & まだ決まっていないこと */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200/80">
            {/* 決まったこと */}
            <div className="p-2.5 bg-white border border-stone-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>決まったこと</span>
              </div>
              {summary.decided.length > 0 ? (
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-stone-700">
                  {summary.decided.map((item, idx) => (
                    <li key={idx} className="leading-tight">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-stone-400">まだ確定事項はありません</p>
              )}
            </div>

            {/* まだ決まっていないこと */}
            <div className="p-2.5 bg-white border border-stone-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 text-[11px]">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>まだ決まっていないこと</span>
              </div>
              {undecidedCount > 0 ? (
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-stone-700">
                  {summary.undecided.map((item, idx) => (
                    <li key={idx} className="leading-tight">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-emerald-700 font-medium">すべての決定が完了しました</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
