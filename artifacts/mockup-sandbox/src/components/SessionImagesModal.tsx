import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Loader2,
  HardDrive,
  Calendar,
  Tag,
  ArrowRight,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { ChatService } from '../services/chatService';
import { SessionImageMetadata } from '../types/memory';

export interface SessionImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle: string;
  chatService: ChatService;
  memoryConnectionId: string | null;
  onSelectImageForConsultation: (imageDataUrl: string, filename?: string) => void;
  onOpenMemoryConnect?: () => void;
}

/**
 * このセッションの過去の写真（Session Images）モーダル
 * 
 * 現在のセッション内で撮影・保存したGoogle Drive上のSession Imageを
 * ユーザーが必要としたときに一覧取得し、選択した画像本体のみをオンデマンドで取得・再利用するコンポーネントです。
 * 
 * - Session ImageとShared Flyerを完全に分離
 * - 現在のセッション（sessionId）に厳密に限定
 * - セッション再開時に自動ロードせず、ユーザーが本モーダルを開いた時のみ一覧を取得
 * - 各画像の本体（Base64/DataURL）はユーザーが選択した時のみ1件ずつ取得
 * - 取得した画像は既存の写真相談機能へセットしてMain Flowへ渡すことが可能
 */
export const SessionImagesModal: React.FC<SessionImagesModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  sessionTitle,
  chatService,
  memoryConnectionId,
  onSelectImageForConsultation,
  onOpenMemoryConnect,
}) => {
  const [images, setImages] = useState<SessionImageMetadata[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // 選択中（取得中 / プレビュー中）の画像状態
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [loadedImageDataUrl, setLoadedImageDataUrl] = useState<string | null>(null);
  const [loadedImageMeta, setLoadedImageMeta] = useState<SessionImageMetadata | null>(null);

  // 一覧取得関数 (オンデマンド)
  const fetchImages = useCallback(async () => {
    if (!memoryConnectionId || !chatService.listSessionImages) {
      setImages([]);
      return;
    }

    setIsLoadingList(true);
    setListError(null);

    try {
      const res = await chatService.listSessionImages({
        sessionId,
        connectionId: memoryConnectionId,
      });

      if (res.success) {
        // 新しい順にソート（作成日時がある場合）
        const sorted = [...res.images].sort((a, b) => {
          const tA = a.created_time ? new Date(a.created_time).getTime() : 0;
          const tB = b.created_time ? new Date(b.created_time).getTime() : 0;
          return tB - tA;
        });
        setImages(sorted);
      } else {
        setListError(res.error || '写真一覧の取得に失敗しました。');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '通信エラー';
      setListError(`写真一覧の取得中にエラーが発生しました: ${msg}`);
    } finally {
      setIsLoadingList(false);
    }
  }, [chatService, memoryConnectionId, sessionId]);

  // モーダルが開かれた時に一覧を初回取得
  useEffect(() => {
    if (isOpen) {
      setSelectedFileId(null);
      setLoadedImageDataUrl(null);
      setLoadedImageMeta(null);
      setImageError(null);
      fetchImages();
    }
  }, [isOpen, fetchImages]);

  // 個別画像取得関数 (ユーザーが特定の画像を選択した時のみ実行)
  const handleSelectImage = async (meta: SessionImageMetadata) => {
    setSelectedFileId(meta.drive_file_id);
    setImageError(null);
    setLoadedImageDataUrl(null);
    setLoadedImageMeta(meta);

    if (!memoryConnectionId || !chatService.getSessionImage) {
      setImageError('Google Drive Memoryが未接続です。');
      return;
    }

    setIsLoadingImage(true);
    try {
      const res = await chatService.getSessionImage({
        sessionId,
        driveFileId: meta.drive_file_id,
        connectionId: memoryConnectionId,
      });

      if (res.success && res.file) {
        setLoadedImageDataUrl(res.file);
      } else {
        setImageError(res.error || '画像の取得に失敗しました。');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '通信エラー';
      setImageError(`画像取得通信エラー: ${msg}`);
    } finally {
      setIsLoadingImage(false);
    }
  };

  // 取得した写真を写真相談に適用してモーダルを閉じる
  const handleApplyForConsultation = () => {
    if (!loadedImageDataUrl) return;
    onSelectImageForConsultation(
      loadedImageDataUrl,
      loadedImageMeta?.name || 'session_photo.jpg'
    );
    onClose();
  };

  if (!isOpen) return null;

  // 種別ラベルとバッジスタイルのヘルパー
  const getKindBadge = (kind?: string) => {
    switch (kind) {
      case 'product':
        return { label: '商品・値札', className: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' };
      case 'shelf':
        return { label: '売り場・棚', className: 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800' };
      case 'flyer':
        return { label: 'チラシ', className: 'bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800' };
      default:
        return { label: '写真', className: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700' };
    }
  };

  // 日時の整形ヘルパー
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      id="modal-session-images-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-session-images-card"
        className="w-full sm:max-w-2xl bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92vh] h-[92vh] sm:h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-2xs">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base truncate">
                  このセッションの過去の写真
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium border border-stone-200 dark:border-stone-700 shrink-0">
                  Google Drive
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                対象セッション: <span className="font-medium text-stone-700 dark:text-stone-300">{sessionTitle}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              id="btn-refresh-session-images"
              onClick={fetchImages}
              disabled={isLoadingList}
              className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-40"
              title="一覧を再取得"
              aria-label="一覧を再取得"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              id="btn-close-session-images-modal"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ（2カラム構成: 左側一覧 / 右側選択プレビュー） */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-4 min-h-0">
          {/* 左側: 写真一覧リスト */}
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 shrink-0">
              <span>保存済み写真 ({images.length}件)</span>
              <span className="text-[11px]">タップして画像を取得・表示</span>
            </div>

            {/* 未接続の注意表示 */}
            {!memoryConnectionId && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <HardDrive className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>Google Drive Memory 未接続</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  Google Driveと接続すると、セッション中に送信した写真が安全に保存され、後からいつでも再利用できます。
                </p>
                {onOpenMemoryConnect && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMemoryConnect();
                    }}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Google Driveを接続する
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* 一覧取得中ローダー */}
            {isLoadingList && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs">Google Drive上の写真一覧を確認中...</span>
              </div>
            )}

            {/* 一覧取得エラー */}
            {listError && !isLoadingList && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">写真一覧の取得エラー</p>
                  <p className="text-[11px] mt-0.5">{listError}</p>
                  <button
                    type="button"
                    onClick={fetchImages}
                    className="mt-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    再試行する
                  </button>
                </div>
              </div>
            )}

            {/* 写真が0件の場合 */}
            {!isLoadingList && !listError && memoryConnectionId && images.length === 0 && (
              <div className="py-10 px-4 text-center bg-stone-50 dark:bg-stone-850 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 space-y-2">
                <div className="w-10 h-10 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  このセッションの写真はありません
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs mx-auto leading-relaxed">
                  チャット入力欄のカメラボタンから写真を送信すると、自動的にこのセッションのGoogle Driveに保存されます。
                </p>
              </div>
            )}

            {/* 写真一覧リスト */}
            {!isLoadingList && images.length > 0 && (
              <div className="space-y-2 overflow-y-auto max-h-72 md:max-h-[380px] pr-1">
                {images.map((img) => {
                  const isSelected = selectedFileId === img.drive_file_id;
                  const kindInfo = getKindBadge(img.image_kind);
                  const formattedTime = formatDate(img.created_time);

                  return (
                    <button
                      key={img.drive_file_id}
                      type="button"
                      id={`btn-session-image-${img.drive_file_id}`}
                      onClick={() => handleSelectImage(img)}
                      className={`w-full p-3 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/20'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 hover:bg-stone-100 dark:hover:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      {/* アイコンまたはサムネイル */}
                      <div className="w-11 h-11 rounded-xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center shrink-0 overflow-hidden border border-stone-300/50 dark:border-stone-700">
                        {img.thumbnail_url ? (
                          <img
                            src={img.thumbnail_url}
                            alt={img.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // サムネイル読み込みエラー時はプレースホルダー
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Camera className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                        )}
                      </div>

                      {/* メタデータ */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-md font-semibold border ${kindInfo.className}`}
                          >
                            {kindInfo.label}
                          </span>
                          {formattedTime && (
                            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                              {formattedTime}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate mt-1">
                          {img.name}
                        </p>
                      </div>

                      {/* 選択状態インジケーター */}
                      <div className="shrink-0">
                        {isSelected && isLoadingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                        ) : isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右側: 選択中写真プレビュー & 再利用アクション */}
          <div className="w-full md:w-72 flex flex-col shrink-0 border-t md:border-t-0 md:border-l border-stone-200 dark:border-stone-800 pt-4 md:pt-0 md:pl-4">
            <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-2">
              選択中の写真プレビュー
            </h4>

            {/* プレビュー表示エリア */}
            <div className="flex-1 min-h-[220px] bg-stone-100 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center p-3 relative overflow-hidden">
              {isLoadingImage && (
                <div className="text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                    Google Driveから画像を取得中...
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500">
                    選択した画像のみダウンロードしています
                  </p>
                </div>
              )}

              {imageError && !isLoadingImage && (
                <div className="text-center space-y-2 p-2">
                  <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">取得エラー</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">{imageError}</p>
                  {selectedFileId && loadedImageMeta && (
                    <button
                      type="button"
                      onClick={() => handleSelectImage(loadedImageMeta)}
                      className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer mt-1"
                    >
                      再取得
                    </button>
                  )}
                </div>
              )}

              {!isLoadingImage && !imageError && loadedImageDataUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <div className="w-full h-44 rounded-xl overflow-hidden bg-black/5 dark:bg-black/20 flex items-center justify-center">
                    <img
                      src={loadedImageDataUrl}
                      alt={loadedImageMeta?.name || '選択写真'}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>
                  <div className="text-center w-full min-w-0">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                      {loadedImageMeta?.name}
                    </p>
                  </div>
                </div>
              )}

              {!isLoadingImage && !imageError && !loadedImageDataUrl && (
                <div className="text-center space-y-1.5 p-4 text-stone-400 dark:text-stone-500">
                  <ImageIcon className="w-8 h-8 mx-auto stroke-1" />
                  <p className="text-xs font-medium">写真を選択してください</p>
                  <p className="text-[10px] leading-relaxed">
                    左の一覧から写真を選ぶと、Google Driveからダウンロードして表示します。
                  </p>
                </div>
              )}
            </div>

            {/* 再利用ボタンエリア */}
            <div className="pt-3 space-y-2">
              <button
                type="button"
                id="btn-use-selected-session-image"
                onClick={handleApplyForConsultation}
                disabled={!loadedImageDataUrl || isLoadingImage}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>この写真で相談する</span>
              </button>

              <p className="text-[10px] text-stone-400 dark:text-stone-500 text-center leading-tight">
                チャット入力欄に写真をセットし、AIへの再相談材料として活用できます
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-3 bg-stone-50 dark:bg-stone-900/90 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-stone-400" />
            <span>Google Drive Session Images</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-stone-200/80 hover:bg-stone-300/80 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg font-medium transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
