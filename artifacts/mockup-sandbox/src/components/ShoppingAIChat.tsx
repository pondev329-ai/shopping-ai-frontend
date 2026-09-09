import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Clock, Sparkles, ShoppingBag, Utensils, CheckCircle2, ChevronRight } from 'lucide-react';
import { ChatMessage, InlineDecisionPayload, SuggestionOption } from '../types/chat';
import { defaultChatService, ChatService } from '../services/chatService';

interface ShoppingAIChatProps {
  chatService?: ChatService;
}

const INITIAL_GREETING: ChatMessage = {
  id: 'msg-init',
  role: 'assistant',
  content: 'こんにちは！Shopping AIです。\n\n今日のあなたの状況（疲労度、使える時間、冷蔵庫の余り、買い物に行けるかなど）に合わせて、無理のない選択肢を一緒に整理します。\n\n今日の晩ごはんや買い物について、今の状況を教えてください。',
  timestamp: Date.now(),
  decisionData: {
    quickReplies: [
      '今日は疲れてるから手軽に済ませたい',
      '冷蔵庫にある食材を使い切りたい',
      '20分で作れるものがいい',
      '買い足しを最小限にしたい',
    ],
  },
};

export const ShoppingAIChat: React.FC<ShoppingAIChatProps> = ({
  chatService = defaultChatService,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('shopping_ai_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore parse error
      }
    }
    return [INITIAL_GREETING];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 永続化
  useEffect(() => {
    localStorage.setItem('shopping_ai_chat_history', JSON.stringify(messages));
  }, [messages]);

  // スクロール調整
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // テキストエリアの高さ自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText ?? input).trim();
    if (!textToSend || isTyping) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!overrideText) {
      setInput('');
    }
    setIsTyping(true);

    try {
      const response = await chatService.sendMessage(newMessages, textToSend);
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        decisionData: response.decisionData,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: '通信エラーが発生しました。もう一度入力してみてください。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // PC環境でCmd+Enter/Ctrl+Enter送信をサポート（スマホでは改行自由）
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    if (window.confirm('会話をリセットして、新しく相談を始めますか？')) {
      setMessages([INITIAL_GREETING]);
      localStorage.removeItem('shopping_ai_chat_history');
      if (chatService.resetConversation) {
        chatService.resetConversation();
      }
    }
  };

  const handleOptionSelect = (option: SuggestionOption) => {
    handleSend(`「${option.title}」が気になります。これについて詳しく教えてください。`);
  };

  return (
    <div id="shopping-ai-root" className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-stone-50 text-stone-900 overflow-hidden font-sans border-x border-stone-200 shadow-sm">
      {/* 1. Header (Mobile First) */}
      <header id="chat-header" className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur border-b border-stone-200 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-stone-800 leading-tight">Shopping AI</h1>
            <p className="text-xs text-stone-500">買い物・食事の意思決定サポート</p>
          </div>
        </div>
        <button
          id="btn-reset-conversation"
          onClick={handleReset}
          className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors active:scale-95 touch-manipulation"
          title="会話をリセット"
          aria-label="会話をリセット"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* 2. Messages Stream */}
      <main id="chat-messages-container" className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {messages.map((msg) => (
          <div
            key={msg.id}
            id={`message-row-${msg.id}`}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Balloon */}
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-xs shadow-xs font-normal'
                  : 'bg-white text-stone-800 border border-stone-200 rounded-tl-xs shadow-2xs'
              }`}
            >
              {msg.content}
            </div>

            {/* Inline Decision Support (AI側のみ拡張表示) */}
            {msg.role === 'assistant' && msg.decisionData && (
              <div className="w-full max-w-[94%] mt-3 space-y-3">
                {/* 状況整理タグ (Context Understanding) */}
                {msg.decisionData.contextSummary && (
                  <div className="bg-stone-100/90 rounded-xl p-3 border border-stone-200 text-xs text-stone-600 space-y-1">
                    <div className="font-medium text-stone-700 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      現在の理解・前提条件:
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {msg.decisionData.contextSummary.timeLimit && (
                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700">
                          <Clock className="w-3 h-3 text-stone-500" />
                          {msg.decisionData.contextSummary.timeLimit}
                        </span>
                      )}
                      {msg.decisionData.contextSummary.energyLevel && (
                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700">
                          {msg.decisionData.contextSummary.energyLevel}
                        </span>
                      )}
                      {msg.decisionData.contextSummary.availableIngredients?.map((ing, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700">
                          <Utensils className="w-3 h-3 text-stone-500" />
                          {ing}
                        </span>
                      ))}
                      {msg.decisionData.contextSummary.moodOrPreference && (
                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-medium text-stone-700">
                          {msg.decisionData.contextSummary.moodOrPreference}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 選択肢カード (Options for Decision) */}
                {msg.decisionData.options && msg.decisionData.options.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-500 px-1">
                      判断のヒント・候補となる方向性:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.decisionData.options.map((opt) => (
                        <button
                          key={opt.id}
                          id={`btn-option-${opt.id}`}
                          onClick={() => handleOptionSelect(opt)}
                          className="w-full text-left bg-white hover:bg-stone-50 active:bg-stone-100 border border-stone-200 hover:border-emerald-500 rounded-xl p-3.5 transition-all shadow-2xs group relative"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-semibold text-stone-900 text-sm group-hover:text-emerald-700 transition-colors">
                              {opt.title}
                            </h2>
                            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors shrink-0 mt-0.5" />
                          </div>
                          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                            {opt.summary}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-stone-100 text-[11px] text-stone-500">
                            {opt.prepTimeMinutes && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-400" />
                                目安: 約{opt.prepTimeMinutes}分
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3 text-stone-400" />
                              {opt.requiresShopping ? '買い足し少しあり' : '手持ちで完結'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 問いかけ / クイックリプライボタン */}
                {msg.decisionData.quickReplies && msg.decisionData.quickReplies.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[11px] text-stone-500 mb-1.5 px-0.5">タップしてすぐに伝える:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.decisionData.quickReplies.map((reply, i) => (
                        <button
                          key={i}
                          id={`btn-quick-reply-${i}`}
                          onClick={() => handleSend(reply)}
                          className="text-xs bg-white active:bg-stone-100 text-stone-700 border border-stone-300 hover:border-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-full transition-colors shadow-2xs touch-manipulation text-left font-normal"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <span className="text-[10px] text-stone-400 mt-1 px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* AI Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-2xl rounded-tl-xs px-4 py-3 w-fit text-stone-400 text-xs shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="ml-1 text-stone-500">考え中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 3. Input Form (Mobile Optimized) */}
      <footer id="chat-input-footer" className="p-3 bg-white border-t border-stone-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 bg-stone-100 rounded-2xl border border-stone-200 focus-within:border-emerald-500 focus-within:bg-white transition-colors px-3.5 py-1.5 flex items-center">
            <textarea
              id="input-chat-message"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="今の状況や気分を入力... (例: 疲れてるから20分で)"
              rows={1}
              className="w-full resize-none bg-transparent border-0 focus:outline-hidden text-sm text-stone-900 placeholder:text-stone-400 max-h-28 py-1 leading-relaxed"
            />
          </div>

          <button
            id="btn-send-message"
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 active:scale-95 transition-all shrink-0 touch-manipulation shadow-xs"
            aria-label="送信"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
};
