import { MessageCircle, RefreshCw, Send } from "lucide-react";
import type { RefObject } from "react";
import type { WorkspaceChatMessage } from "@/app/workspace/types";

type WorkspaceAnswersPanelProps = {
  profileName?: string;
  activeTabLabel?: string;
  contextDescription: string;
  chatMessages: WorkspaceChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  chatLoading: boolean;
  onSendMessage: () => void | Promise<void>;
  chatMessagesEndRef: RefObject<HTMLDivElement | null>;
  chatInputRef: RefObject<HTMLInputElement | null>;
};

export default function WorkspaceAnswersPanel({
  profileName,
  activeTabLabel,
  contextDescription,
  chatMessages,
  chatInput,
  onChatInputChange,
  chatLoading,
  onSendMessage,
  chatMessagesEndRef,
  chatInputRef,
}: WorkspaceAnswersPanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Apply Answers</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {profileName ? `${profileName} Assistant` : "Answer Panel"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {activeTabLabel
              ? `Active tab: ${activeTabLabel}`
              : "Ask follow-up questions and draft answers for applications."}
          </p>
          <p className="mt-1 text-xs text-slate-500">{contextDescription}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            OpenAI
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {chatMessages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-slate-500">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <MessageCircle className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Ask a question for this application</p>
            <p className="mt-2 max-w-sm text-sm">
              Example: &quot;Write a short answer for why I&apos;m a fit for this role&quot; or
              &quot;Summarize my strongest backend experience.&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatLoading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={chatMessagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSendMessage();
          }}
          className="flex items-center gap-3"
        >
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            placeholder="Ask a question for this application..."
            disabled={chatLoading}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="flex items-center justify-center rounded-xl bg-indigo-500 p-3 text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Send"
          >
            {chatLoading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}
