import React, { useState } from "react";
import { Send, Bot, User, Sparkles, Terminal, ArrowRight } from "lucide-react";
import type { ChatMessage } from "../types";

interface AgentTerminalProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

const PRESET_PROMPTS = [
  "퇴근길 10분 우회로 갈 수 있는 빠른 조리 맛집",
  "양재역 환승 중 1인석 있는 칼국수 맛집",
  "브레이크타임 걱정 없는 영동고속도로 맛집",
];

export const AgentTerminal: React.FC<AgentTerminalProps> = ({
  messages,
  onSendMessage,
  isLoading,
}) => {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="hud-panel flex flex-col h-full overflow-hidden">
      {/* Terminal Top Bar */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#ff4d12]" />
          <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            WayBite Agent Core (Bedrock + Strands)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Claude 3.7 Sonnet Active</span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "agent" && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#ff4d12] to-amber-500 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl p-3.5 ${
                msg.sender === "user"
                  ? "bg-[#2563eb] text-white font-medium"
                  : "bg-white/[0.04] border border-white/10 text-slate-200"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[10px] text-white/50 mt-1.5 text-right font-mono">
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === "user" && (
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-slate-400 bg-white/[0.02] p-3 rounded-xl border border-white/5 animate-pulse">
            <Sparkles className="w-4 h-4 text-[#ff4d12] animate-spin" />
            <span>시공간 회랑 경로 탐색 및 실시간 카카오 API 호출 중...</span>
          </div>
        )}
      </div>

      {/* Preset Chips */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto border-t border-white/5 bg-black/10 shrink-0">
        <span className="text-[10px] text-slate-500 font-mono shrink-0">추천 질의:</span>
        {PRESET_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSendMessage(prompt)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-[#ff4d12]/50 hover:bg-[#ff4d12]/10 transition-all flex items-center gap-1"
          >
            <span>{prompt}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 flex items-center gap-2 bg-black/20 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="이동 경로와 식사 조건을 자연어로 물어보세요..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d12] transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-[#ff4d12] text-white flex items-center justify-center hover:bg-[#e03d08] disabled:opacity-40 disabled:hover:bg-[#ff4d12] transition-all shadow-md shadow-[#ff4d12]/30 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
