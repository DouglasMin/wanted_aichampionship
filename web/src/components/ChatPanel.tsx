import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import type { ChatMessage } from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  isTyping: boolean;
}

export const ChatPanel = ({
  messages,
  inputValue,
  onInputChange,
  onSend,
  isTyping,
}: ChatPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4"
      >
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={msg.sender === "user" ? "chat-bubble-user" : "chat-bubble-agent"}>
              {msg.text}
            </div>
          </motion.div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="chat-bubble-agent flex items-center gap-1.5 py-3 px-4">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Suggestion Chips */}
      <div className="shrink-0 px-3 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          "⏱️ 최단 우회 순으로 정렬해줘",
          "🚫 브레이크타임 걸린 식당 빼줘",
          "👤 혼밥하기 좋은 곳 위주로",
          "🍖 흑돼지 맛집으로 바꿔줘",
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onInputChange(chip)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-[#8e95a5] hover:text-[#f4f6fa] border border-white/[0.06] transition-colors shrink-0 cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div
        className="shrink-0 px-4 py-3 border-t flex items-center gap-2"
        style={{ borderColor: "var(--border-quiet)" }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="추가 질문하기..."
          className="input-field flex-1"
          style={{ padding: "10px 14px", fontSize: "13px", borderRadius: "10px" }}
        />
        <button
          onClick={onSend}
          disabled={!inputValue.trim()}
          className="p-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
          style={{
            background: inputValue.trim() ? "var(--accent-primary)" : "rgba(255,255,255,0.06)",
            color: inputValue.trim() ? "#fff" : "var(--text-faint)",
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
