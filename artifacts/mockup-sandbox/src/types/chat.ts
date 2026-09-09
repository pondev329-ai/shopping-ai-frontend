export type MessageRole = 'user' | 'assistant' | 'system';

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
  decisionData?: InlineDecisionPayload;
}

export interface ChatResponse {
  text: string;
  decisionData?: InlineDecisionPayload;
  rawBackendState?: Record<string, unknown>;
}
