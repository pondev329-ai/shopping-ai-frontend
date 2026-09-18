import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Newspaper,
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ExternalLink,
  Plus,
  Calendar,
  Store,
  FileText,
  Clock,
  RefreshCw,
  ZoomIn,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { ChatService } from '../services/chatService';
import { MemoryRomItem, SharedFlyerItem } from '../types/memory';
import { compressImageToDataUrl } from '../utils/imageCompressor';

interface FlyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatService: ChatService;
  memoryConnectionId: string | null;
  onOpenConnectModal?: () => void;
  onPreviewImage?: (url: string) => void;
}

export const FlyerModal: React.FC<FlyerModalProps> = ({
  isOpen,
  onClose,
  chatService,
  memoryConnectionId,
  onOpenConnectModal,
  onPreviewImage,
}) => {
  // 画面モード: 'list' (一覧) または 'create' (新規追加)
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // チラシ一覧取得用ステート
  const [romFlyers, setRomFlyers] = useState<MemoryRomItem[]>([]);
  const [localRegisteredFlyers, setLocalRegisteredFlyers] = useState<SharedFlyerItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // チラシ新規登録フォーム用ステート
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');
  const [validFrom, setValidFrom] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // input refs (iOS対応)
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  // 有効なMemory接続IDの判定
  const validMemoryConnectionId = useMemo(() => {
    if (
      typeof memoryConnectionId === 'string' &&
      memoryConnectionId.trim().length > 0 &&
      memoryConnectionId.trim() !== 'null' &&
      memoryConnectionId.trim() !== 'undefined'
    ) {
      return memoryConnectionId.trim();
    }
    return null;
  }, [memoryConnectionId]);

  // モーダルオープン時に一覧を取得
  useEffect(() => {
    if (isOpen) {
      fetchFlyers();
      setSaveSuccessMessage(null);
      setSaveErrorMessage(null);
    } else {
      // 閉じたときはリセット
      setSelectedImage(null);
      setSelectedFilename('');
      setStoreName('');
      setValidFrom('');
      setValidUntil('');
      setNotes('');
      setSaveSuccessMessage(null);
      setSaveErrorMessage(null);
      setActiveTab('list');
    }
  }, [isOpen, validMemoryConnectionId]);

  // Google Drive ROMからチラシ一覧を取得
  const fetchFlyers = async () => {
    if (!validMemoryConnectionId || !chatService.listMemoryRom) {
      setRomFlyers([]);
      setIsLoadingList(false);
      return;
    }

    setIsLoadingList(true);
    setListError(null);
    try {
      const res = await chatService.listMemoryRom({
        connectionId: validMemoryConnectionId,
      });

      if (res.success && Array.isArray(res.items)) {
        // Shared Flyer / flyer / チラシ に該当するROMデータを抽出
        const flyers = res.items.filter((item) => {
          const itemType = (item.item_type || '').toLowerCase();
          const rawType = (item.raw_type || '').toLowerCase();
          const name = (item.name || '').toLowerCase();
          return (
            itemType === 'shared_rom' ||
            rawType.includes('flyer') ||
            rawType.includes('shared') ||
            name.includes('flyer') ||
            name.includes('チラシ')
          );
        });
        setRomFlyers(flyers);
      } else {
        if (res.error) {
          setListError(res.error);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '通信エラー';
      setListError(msg);
    } finally {
      setIsLoadingList(false);
    }
  };

  // 写真選択ハンドラー
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      setSaveErrorMessage(null);
      setIsProcessingImage(true);
      setSelectedFilename(file.name || `flyer_${Date.now()}.jpg`);
      const compressedDataUrl = await compressImageToDataUrl(file);
      setSelectedImage(compressedDataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '画像の展開に失敗しました。';
      setSaveErrorMessage(msg);
      setSelectedImage(null);
      setSelectedFilename('');
    } finally {
      setIsProcessingImage(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // チラシ登録実行ハンドラー
  const handleSaveFlyer = async () => {
    if (!selectedImage) {
      setSaveErrorMessage('チラシ画像を選択または撮影してください。');
      return;
    }

    if (!validMemoryConnectionId) {
      setSaveErrorMessage('Google Driveが未接続のためチラシを保存できません。');
      return;
    }

    if (!chatService.saveSharedFlyer) {
      setSaveErrorMessage('チラシ保存機能が利用できません。');
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      const res = await chatService.saveSharedFlyer({
        file: selectedImage,
        filename: selectedFilename || `flyer_${Date.now()}.jpg`,
        store: storeName.trim() || undefined,
        valid_from: validFrom || undefined,
        valid_until: validUntil || undefined,
        notes: notes.trim() || undefined,
        connectionId: validMemoryConnectionId,
      });

      if (res.success) {
        setSaveSuccessMessage('Google Driveにチラシを登録しました！');

        // ローカル登録済みリストにも追加して即時反映
        const newLocalFlyer: SharedFlyerItem = {
          id: `local-flyer-${Date.now()}`,
          name: selectedFilename || `チラシ画像 (${new Date().toLocaleDateString()})`,
          store: storeName.trim() || undefined,
          valid_from: validFrom || undefined,
          valid_until: validUntil || undefined,
          notes: notes.trim() || undefined,
          updated_at: new Date().toISOString(),
          imageUrl: selectedImage,
        };
        setLocalRegisteredFlyers((prev) => [newLocalFlyer, ...prev]);

        // フォームリセット
        setSelectedImage(null);
        setSelectedFilename('');
        setStoreName('');
        setValidFrom('');
        setValidUntil('');
        setNotes('');

        // 一覧を再取得
        fetchFlyers();

        // 1.5秒後に一覧タブへ遷移
        setTimeout(() => {
          setActiveTab('list');
          setSaveSuccessMessage(null);
        }, 1200);
      } else {
        setSaveErrorMessage(res.error || 'チラシの保存に失敗しました。');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '通信エラーが発生しました';
      setSaveErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // 全チラシ件数（Drive上のROM + 直近登録したローカルチラシ）
  const totalFlyerCount = romFlyers.length + localRegisteredFlyers.length;

  return (
    <div
      id="modal-flyer-backdrop"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-flyer-content"
        className="w-full sm:max-w-xl h-[90vh] sm:h-auto sm:max-h-[85vh] bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 隠し input 要素（カメラ撮影用 & アルバム選択用） */}
        <input
          ref={cameraInputRef}
          id="input-flyer-camera"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageFileChange}
        />
        <input
          ref={libraryInputRef}
          id="input-flyer-library"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileChange}
        />

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/95 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-600 dark:bg-orange-650 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Newspaper className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm leading-tight">
                  チラシ
                </h3>
                <span className="text-[10px] text-orange-700 dark:text-orange-300 bg-orange-100/80 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 px-1.5 py-0.2 rounded font-medium shrink-0">
                  共有データ
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                買い物用の特売チラシを登録して、Shopping AIの判断材料に活用
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-flyer-modal"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="チラシ画面を閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブ切り替え（一覧 ↔ 新規登録） */}
        <div className="flex items-center border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-5 shrink-0">
          <button
            type="button"
            id="tab-flyer-list"
            onClick={() => {
              setActiveTab('list');
              setSaveSuccessMessage(null);
            }}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'list'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <span>登録済みチラシ</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'list'
                  ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              {totalFlyerCount}
            </span>
          </button>

          <button
            type="button"
            id="tab-flyer-create"
            onClick={() => setActiveTab('create')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'create'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>チラシを追加</span>
          </button>
        </div>

        {/* Google Drive 未接続警告バナー */}
        {!validMemoryConnectionId && (
          <div
            id="flyer-drive-unconnected-banner"
            className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex items-start gap-3 shrink-0"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Google Drive が未接続です
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                チラシ画像を保存して複数セッションで共有するには、Googleアカウントの連携が必要です。
              </p>
              {onOpenConnectModal && (
                <button
                  type="button"
                  id="btn-flyer-goto-drive-connect"
                  onClick={() => {
                    onClose();
                    onOpenConnectModal();
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/60 hover:bg-amber-300/60 dark:hover:bg-amber-800/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Google Drive 接続設定を開く</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-stone-50/50 dark:bg-stone-950/40">
          {/* =========================================================================
              タブ 1: 登録済みチラシ一覧
             ========================================================================= */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* 説明メッセージ */}
              <div className="p-3 bg-white dark:bg-stone-800/70 rounded-xl border border-stone-200 dark:border-stone-700/70 text-xs text-stone-600 dark:text-stone-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="text-[11.5px] leading-relaxed">
                  登録したチラシは、スーパーでの買い物相談や献立決定時の特売・価格・食材判断材料として全セッションで横断的に利用されます。
                </div>
              </div>

              {/* 再読み込みボタン */}
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 px-1">
                <span>登録済みチラシ: {totalFlyerCount} 件</span>
                {validMemoryConnectionId && (
                  <button
                    type="button"
                    id="btn-refresh-flyers"
                    onClick={fetchFlyers}
                    disabled={isLoadingList}
                    className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingList ? 'animate-spin text-orange-600' : ''}`} />
                    <span>更新</span>
                  </button>
                )}
              </div>

              {/* 読み込み中表示 */}
              {isLoadingList && (
                <div className="py-8 text-center text-xs text-stone-500 dark:text-stone-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600 dark:text-orange-400" />
                  <span>Google Drive からチラシデータを取得中...</span>
                </div>
              )}

              {/* エラー表示 */}
              {listError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 rounded-xl flex items-center justify-between">
                  <span>{listError}</span>
                  <button
                    type="button"
                    onClick={fetchFlyers}
                    className="underline text-[11px] font-semibold cursor-pointer shrink-0 ml-2"
                  >
                    再取得
                  </button>
                </div>
              )}

              {/* 0件のときの空表示 */}
              {!isLoadingList && totalFlyerCount === 0 && (
                <div className="text-center py-10 px-4 bg-white dark:bg-stone-800/50 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Newspaper className="w-6 h-6 stroke-1.5" />
                  </div>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    登録されたチラシはまだありません
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    買い物の前やスーパーの入り口で、特売チラシの写真を撮影・登録しておくと、AIが買い物中の提案に活用します。
                  </p>
                  <button
                    type="button"
                    id="btn-empty-add-flyer"
                    onClick={() => setActiveTab('create')}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>チラシを登録する</span>
                  </button>
                </div>
              )}

              {/* チラシカード一覧 */}
              <div className="space-y-3">
                {/* 1. 直近追加されたチラシ（画像プレビュー付き） */}
                {localRegisteredFlyers.map((flyer) => (
                  <div
                    key={flyer.id}
                    className="p-3.5 bg-white dark:bg-stone-800 rounded-2xl border border-orange-200 dark:border-orange-800/80 shadow-2xs flex gap-3 items-start"
                  >
                    {flyer.imageUrl && (
                      <div
                        className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-700 shrink-0 border border-stone-200 dark:border-stone-700 relative group cursor-pointer"
                        onClick={() => onPreviewImage && onPreviewImage(flyer.imageUrl || '')}
                        title="タップして拡大"
                      >
                        <img
                          src={flyer.imageUrl}
                          alt="チラシプレビュー"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {flyer.store ? `${flyer.store} のチラシ` : flyer.name}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded font-medium shrink-0">
                          Drive保存済み
                        </span>
                      </div>
                      {(flyer.valid_from || flyer.valid_until) && (
                        <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>
                            {flyer.valid_from || ''} 〜 {flyer.valid_until || ''}
                          </span>
                        </div>
                      )}
                      {flyer.notes && (
                        <p className="text-[11.5px] text-stone-600 dark:text-stone-300 mt-1 line-clamp-2 bg-stone-50 dark:bg-stone-750 p-1.5 rounded-lg">
                          {flyer.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(flyer.updated_at || Date.now()).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 2. Google Drive から取得した既存のチラシROM */}
                {romFlyers.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700/80 shadow-2xs flex gap-3 items-start"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                      <Newspaper className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.2 rounded font-mono shrink-0">
                          {item.size || 'Shared'}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11.5px] text-stone-600 dark:text-stone-300 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
                        <span className="font-mono">
                          ID: {item.drive_file_id ? `${item.drive_file_id.slice(0, 8)}...` : item.id.slice(0, 8)}
                        </span>
                        <span>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              タブ 2: チラシを新規追加
             ========================================================================= */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              {/* 成功メッセージ */}
              {saveSuccessMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-medium">{saveSuccessMessage}</span>
                </div>
              )}

              {/* エラーメッセージ */}
              {saveErrorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 rounded-xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{saveErrorMessage}</span>
                </div>
              )}

              {/* 写真選択セクション */}
              <div className="p-4 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span>チラシ画像（必須）</span>
                  </label>
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">
                    カメラ撮影 または ライブラリ
                  </span>
                </div>

                {/* 画像未選択時の撮影／選択ボタン (iPhoneタップ最適化) */}
                {!selectedImage ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* カメラ撮影ボタン */}
                    <button
                      type="button"
                      id="btn-flyer-select-camera"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isProcessingImage}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/40 active:bg-orange-100/60 dark:active:bg-orange-900/60 transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/70 text-orange-700 dark:text-orange-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-stone-900 dark:text-stone-100 text-xs">
                          カメラで直接撮影
                        </div>
                        <div className="text-[10.5px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          店頭や家のチラシを撮影
                        </div>
                      </div>
                    </button>

                    {/* 写真ライブラリから選択 */}
                    <button
                      type="button"
                      id="btn-flyer-select-library"
                      onClick={() => libraryInputRef.current?.click()}
                      disabled={isProcessingImage}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 active:bg-blue-100/60 dark:active:bg-blue-900/60 transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-stone-900 dark:text-stone-100 text-xs">
                          写真ライブラリから選択
                        </div>
                        <div className="text-[10.5px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          保存済みのチラシ画像を選択
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  /* 選択済み画像のプレビュー */
                  <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-850 p-2 flex items-center gap-3">
                    <div
                      className="w-20 h-20 rounded-lg overflow-hidden bg-black/10 shrink-0 cursor-pointer relative group"
                      onClick={() => onPreviewImage && onPreviewImage(selectedImage)}
                      title="タップして拡大"
                    >
                      <img
                        src={selectedImage}
                        alt="選択されたチラシ"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                        {selectedFilename || 'チラシ画像'}
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        最適化済み（JPEG圧縮）
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => libraryInputRef.current?.click()}
                          className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                        >
                          選び直す
                        </button>
                        <span className="text-stone-300 dark:text-stone-600">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setSelectedFilename('');
                          }}
                          className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          解除
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 画像最適化中インジケーター */}
                {isProcessingImage && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>画像を準備中...</span>
                  </div>
                )}
              </div>

              {/* 任意情報入力フォーム（店舗名・有効期間・メモ） */}
              <div className="p-4 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    詳細情報（任意）
                  </span>
                  <span className="text-[10.5px] text-stone-400 dark:text-stone-500">
                    未入力のまま画像だけでも登録できます
                  </span>
                </div>

                {/* 1. 店舗名 */}
                <div>
                  <label
                    htmlFor="input-flyer-store"
                    className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                  >
                    店舗名
                  </label>
                  <div className="relative flex items-center">
                    <Store className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
                    <input
                      id="input-flyer-store"
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="例: ○○スーパー、ライフ、イオン"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:border-orange-500 dark:focus:border-orange-400 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
                    />
                  </div>
                </div>

                {/* 2. 有効期間（開始日・終了日） */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="input-flyer-valid-from"
                      className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                    >
                      有効開始日
                    </label>
                    <input
                      id="input-flyer-valid-from"
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:border-orange-500 dark:focus:border-orange-400 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="input-flyer-valid-until"
                      className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                    >
                      有効終了日
                    </label>
                    <input
                      id="input-flyer-valid-until"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:border-orange-500 dark:focus:border-orange-400 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                {/* 3. メモ */}
                <div>
                  <label
                    htmlFor="input-flyer-notes"
                    className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                  >
                    メモ・特売の目玉
                  </label>
                  <textarea
                    id="input-flyer-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="例: 火曜市、豚肉全品2割引、キャベツ1玉98円 など"
                    className="w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:border-orange-500 dark:focus:border-orange-400 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 resize-none"
                  />
                </div>
              </div>

              {/* 登録実行ボタン */}
              <div className="pt-1">
                <button
                  type="button"
                  id="btn-submit-save-flyer"
                  onClick={handleSaveFlyer}
                  disabled={!selectedImage || isSaving || !validMemoryConnectionId}
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Google Drive へチラシを保存中...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4" />
                      <span>Google Drive にチラシを登録する</span>
                    </>
                  )}
                </button>
                {!validMemoryConnectionId && (
                  <p className="text-[11px] text-center text-amber-700 dark:text-amber-400 mt-2">
                    ※ Google Drive未接続のため登録ボタンは無効化されています
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-3.5 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
            <Newspaper className="w-3.5 h-3.5 text-orange-500" />
            <span>Shared Flyer（全セッション共有）</span>
          </div>
          <button
            type="button"
            id="btn-close-flyer-modal-footer"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
