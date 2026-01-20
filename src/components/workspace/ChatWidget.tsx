import { MessageCircle, RefreshCw, Send, X } from "lucide-react";
import type { RefObject } from "react";

type ChatWidgetProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  chatProvider: "HUGGINGFACE" | "OPENAI" | "GEMINI";
  onChatProviderChange: (value: "HUGGINGFACE" | "OPENAI" | "GEMINI") => void;
  chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  chatLoading: boolean;
  onSendMessage: () => void | Promise<void>;
  chatMessagesEndRef: RefObject<HTMLDivElement | null>;
  chatInputRef: RefObject<HTMLInputElement | null>;
};

export default function ChatWidget({
  open,
  onOpen,
  onClose,
  chatProvider,
  onChatProviderChange,
  chatMessages,
  chatInput,
  onChatInputChange,
  chatLoading,
  onSendMessage,
  chatMessagesEndRef,
  chatInputRef,
}: ChatWidgetProps) {
  return (
    <>
      {!open && (
        <button
          onClick={onOpen}
          className="group fixed bottom-6 right-6 z-50 flex items-center gap-0 rounded-full bg-indigo-500 p-3 text-white shadow-lg transition-all duration-300 hover:bg-indigo-600 hover:shadow-xl hover:px-4 active:scale-95"
          title="AI Assistant"
        >
          <MessageCircle className="h-6 w-6 shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 group-hover:max-w-[120px] group-hover:ml-2 group-hover:opacity-100">
            AI Assistant
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-9999 flex flex-col h-[50vh] w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-semibold text-slate-900">AI Assistant</h2>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={chatProvider}
                onChange={(e) =>
                  onChatProviderChange(e.target.value as "OPENAI" | "HUGGINGFACE" | "GEMINI")
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none ring-1 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="HUGGINGFACE">Hugging Face</option>
                <option value="OPENAI">OpenAI</option>
                <option value="GEMINI">Gemini</option>
              </select>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Starting conversation...
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.role === "user"
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-100 text-slate-900"
                      }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
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
                placeholder="Ask an interview question..."
                disabled={chatLoading}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSendMessage();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="flex items-center justify-center rounded-xl bg-indigo-500 p-2.5 text-white transition hover:bg-indigo-600 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
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
        </div>
      )}
    </>
  );
}
