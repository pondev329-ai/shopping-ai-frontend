export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Main Flowが認識している現在のシーン
 * - planning: 食事や買い物について机や自宅で考えている段階
 * - shopping: スーパーなどの売り場で実際に買い物をしている段階
 * - after_shopping: 買い物から帰宅し、キッチンで食材を使って食事につなげる段階
 */
export type AppScene = 'planning' | 'shopping' | 'after_shopping';

export interface DecisionFactor {
  label: string;
  value: string;
  icon?: string;
}

export interface SuggestionOption {
  id: string;
  title: string;
  summary: string;
  reasons: string[];
  prepTimeMinutes?: number;
  effortLevel?: 'very_easy' | 'moderate' | 'involved';
  additionalGroceries?: string[];
  requiresShopping?: boolean;
}

export interface ContextUnderstanding {
  timeLimit?: string;
  energyLevel?: string;
  availableIngredients?: string[];
  targetPeople?: string;
  moodOrPreference?: string;
}

export interface InlineDecisionPayload {
  contextSummary?: ContextUnderstanding;
  options?: SuggestionOption[];
  questionPrompt?: string;
  quickReplies?: string[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  imageUrl?: string;
  decisionData?: InlineDecisionPayload;
  /** 応答時のシーン */
  sceneAtMessage?: AppScene;
  /** 応答時の専門家モード */
  expertAtMessage?: string | null;
}

export interface ChatResponse {
  text: string;
  decisionData?: InlineDecisionPayload;
  rawBackendState?: Record<string, unknown>;
  /** Main Flowから渡された現在のシーン */
  currentScene?: AppScene;
  /** Main Flowから渡された専門家モード */
  expertMode?: string | null;
  /** Main Flowから渡されたルート・候補（routes[].candidates[]） */
  routes?: Array<unknown>;
}
