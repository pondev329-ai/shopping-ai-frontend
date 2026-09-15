/**
 * Google Drive Memory ROM のデータ型および分類定義
 * 
 * Shopping AIではGoogle Drive上のROM（Read-Only / Persistent Memory）を
 * 以下の5つのカテゴリに分類して管理します：
 * 1. Session ROM: セッション復元用コンテキスト（セッション再開用状態データ）
 * 2. Conversation Record: 過去の対話履歴ログ（会話ターンアーカイブ）
 * 3. Session Image: セッション中に相談・解析された商品やチラシの写真
 * 4. Shared ROM: セッション横断の共有データ（チラシ情報、共通レシピカタログ等）
 * 5. Unknown: 未知または未分類のROMデータ
 */

export type MemoryRomCategory =
  | 'session_rom'
  | 'conversation_record'
  | 'session_image'
  | 'shared_rom'
  | 'unknown';

export interface MemoryRomCategoryMeta {
  category: MemoryRomCategory;
  label: string;
  subtitle: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isSessionScoped: boolean;
  scopeLabel: string;
  scopeDescription: string;
}

export const MEMORY_ROM_CATEGORIES: Record<MemoryRomCategory, MemoryRomCategoryMeta> = {
  session_rom: {
    category: 'session_rom',
    label: 'Session ROM',
    subtitle: 'セッション復元データ',
    description: 'セッション再開時にバックエンド側の意思決定状態（可能性・買い物コンテキスト等）を復元するためのデータ',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    isSessionScoped: true,
    scopeLabel: 'セッション固有',
    scopeDescription: 'セッション削除時に連動して削除されます',
  },
  conversation_record: {
    category: 'conversation_record',
    label: 'Conversation Record',
    subtitle: '対話記録ログ',
    description: 'セッション内で行われたユーザーとAIの全発言・提案のアーカイブ記録',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
    isSessionScoped: true,
    scopeLabel: 'セッション固有',
    scopeDescription: 'セッション削除時に連動して削除されます',
  },
  session_image: {
    category: 'session_image',
    label: 'Session Image',
    subtitle: '相談写真・画像',
    description: 'スーパーの売り場、商品、値札、特売シールなど相談時にアップロードされた画像データ',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    isSessionScoped: true,
    scopeLabel: 'セッション固有',
    scopeDescription: 'セッション削除時に連動して削除されます',
  },
  shared_rom: {
    category: 'shared_rom',
    label: 'Shared ROM',
    subtitle: 'セッション横断 共有ROM',
    description: '店舗の特売チラシ情報や定番レシピカタログなど、複数セッションで共通利用される知識データ',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    isSessionScoped: false,
    scopeLabel: '共有ROM（保持）',
    scopeDescription: '個別のセッションを削除してもGoogle Drive上に安全に保持されます',
  },
  unknown: {
    category: 'unknown',
    label: 'Unknown',
    subtitle: '未分類ROMデータ',
    description: '種別が未指定または拡張されたGoogle Drive上のROMファイル',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-700',
    badgeBorder: 'border-stone-200',
    isSessionScoped: false,
    scopeLabel: 'その他',
    scopeDescription: '未分類のデータファイルです',
  },
};

export interface MemoryRomItem {
  /** 一意識別子 (drive_file_id または unique ID) */
  id: string;
  /** Google Drive 上のファイルID */
  drive_file_id: string;
  /** ファイル名・表示名 */
  name: string;
  /** 正規化されたROM種別 */
  item_type: MemoryRomCategory;
  /** バックエンドから返却された生の種別文字列 */
  raw_type?: string;
  /** 関連するセッションID（セッション固有データの場合） */
  session_id?: string;
  /** 更新日時（ISO 8601 または 日時文字列） */
  updated_at?: string;
  /** ファイルサイズ（バイト数またはフォーマット済み文字列） */
  size?: number | string;
  /** 説明文・要約（バックエンドから提供された場合） */
  description?: string;
  /** MIMEタイプ（画像等） */
  mime_type?: string;
  /** セッション削除の対象となるか否か */
  is_session_scoped: boolean;
  /** バックエンドから返された追加メタデータ */
  metadata?: Record<string, unknown>;
}

export interface ListMemoryRomParams {
  connectionId?: string;
  sessionId?: string;
  itemType?: string;
}

export interface ListMemoryRomResult {
  success: boolean;
  items: MemoryRomItem[];
  error?: string;
  totalCount?: number;
}

/**
 * バックエンドから返却された rawType や name から
 * 5つの正規化カテゴリ（session_rom / conversation_record / session_image / shared_rom / unknown）
 * へ高精度に判定・分類します。
 */
export function classifyMemoryRomType(
  rawType?: string,
  name?: string,
  mimeType?: string
): MemoryRomCategory {
  const t = (rawType || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();
  const m = (mimeType || '').toLowerCase().trim();

  // 1. Session Image（画像・写真）
  if (
    t.includes('session_image') ||
    t === 'image' ||
    t === 'photo' ||
    t.includes('image') ||
    t.includes('photo') ||
    m.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|heic|bmp)$/i.test(n)
  ) {
    return 'session_image';
  }

  // 2. Conversation Record（対話履歴・会話ログ）
  if (
    t.includes('conversation') ||
    t.includes('record') ||
    t === 'chat_history' ||
    t.includes('history') ||
    n.includes('conversation') ||
    n.includes('chat_record') ||
    n.includes('dialogue')
  ) {
    return 'conversation_record';
  }

  // 3. Shared ROM（チラシ・共有レシピ・セッション横断知識）
  if (
    t.includes('shared') ||
    t.includes('flyer') ||
    t.includes('recipe_catalog') ||
    t.includes('catalog') ||
    t.includes('common') ||
    n.includes('shared_rom') ||
    n.includes('flyer') ||
    n.includes('catalog')
  ) {
    return 'shared_rom';
  }

  // 4. Session ROM（セッション状態・復元データ）
  if (
    t.includes('session_rom') ||
    t === 'session' ||
    t.includes('session_state') ||
    t.includes('restore_state') ||
    t.includes('session') ||
    n.includes('session_rom') ||
    n.includes('session_state') ||
    n.includes('restore_state')
  ) {
    return 'session_rom';
  }

  // 5. 不明・未分類
  return 'unknown';
}
