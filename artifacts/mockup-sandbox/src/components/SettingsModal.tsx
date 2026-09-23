import React from 'react';
import { X, Sun, Moon, Monitor, Type, Settings } from 'lucide-react';
import { ThemeMode, FontSize } from '../hooks/useTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  fontSize,
  onFontSizeChange,
}) => {
  if (!isOpen) return null;

  const fontOptions: { id: FontSize; label: string; description: string; sample: string }[] = [
    { id: 'small', label: '小', description: '情報量を多くコンパクトに表示 (13.5px)', sample: 'text-xs' },
    { id: 'standard', label: '標準', description: 'すっきりと整った日常サイズ (15px)', sample: 'text-sm' },
    { id: 'large', label: '大', description: '文字が大きくくっきりと見やすい (17.5px)', sample: 'text-base font-semibold' },
    { id: 'extra_large', label: '特大', description: 'さらに大きく、遠くからでも見やすい (19.5px)', sample: 'text-lg font-bold' },
  ];

  const previewClass =
    fontSize === 'small'
      ? 'text-[13.5px]'
      : fontSize === 'standard'
      ? 'text-[15px]'
      : fontSize === 'large'
      ? 'text-[17.5px] leading-[1.7]'
      : 'text-[19.5px] leading-[1.7]';

  return (
    <div
      id="modal-settings-backdrop"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-settings-card"
        className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center shadow-2xs">
              <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight">設定</h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">表示モード・文字サイズ設定</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="設定を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-stone-800 dark:text-stone-200">
          {/* 1. 外観モード（ダークモード切替） */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>ダークモード / 外観テーマ</span>
              </label>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                {theme === 'system' ? '端末設定連動' : theme === 'dark' ? 'ダークモード' : 'ライトモード'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700/80">
              <button
                type="button"
                id="btn-settings-theme-light"
                onClick={() => onThemeChange('light')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs ring-1 ring-stone-900/5 dark:ring-white/10'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>ライト</span>
              </button>

              <button
                type="button"
                id="btn-settings-theme-dark"
                onClick={() => onThemeChange('dark')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs ring-1 ring-stone-900/5 dark:ring-white/10'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>ダーク</span>
              </button>

              <button
                type="button"
                id="btn-settings-theme-system"
                onClick={() => onThemeChange('system')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs ring-1 ring-stone-900/5 dark:ring-white/10'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                <span>自動 (端末連動)</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-normal">
              お好みの表示に合わせてライト・ダークまたは端末のシステム設定と自動連動させることができます。
            </p>
          </div>

          <div className="border-t border-stone-200 dark:border-stone-800" />

          {/* 2. 文字の大きさ設定 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>文字の大きさ (フォントサイズ)</span>
              </label>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                {fontSize === 'small'
                  ? '小'
                  : fontSize === 'standard'
                  ? '標準'
                  : fontSize === 'large'
                  ? '大'
                  : '特大'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {fontOptions.map((opt) => {
                const isSelected = fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    id={`btn-fontsize-${opt.id}`}
                    onClick={() => onFontSizeChange(opt.id)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold shadow-2xs ring-1 ring-emerald-500/20'
                        : 'border-stone-200 dark:border-stone-700/80 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className={`text-stone-500 dark:text-stone-400 leading-none ${opt.sample}`}>
                      あA
                    </span>
                  </button>
                );
              })}
            </div>

            {/* プレビューサンプル */}
            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/70 space-y-1">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                表示サンプル
              </span>
              <p className={`text-stone-800 dark:text-stone-100 ${previewClass} transition-all`}>
                今夜は豚肉とキャベツで回鍋肉はいかがでしょうか？買い足し不要で作れます。
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-900/90 shrink-0">
          <button
            type="button"
            id="btn-settings-confirm"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
