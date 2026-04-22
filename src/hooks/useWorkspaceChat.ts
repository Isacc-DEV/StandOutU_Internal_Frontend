import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BaseResume,
  WorkspaceAnswerSession,
  WorkspaceChatMessage,
} from "../app/workspace/types";

type UseWorkspaceChatOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  activeSessionKey: string;
  activeResume: BaseResume | null;
  activeJobDescription?: string | null;
};

const EMPTY_CHAT_MESSAGES: WorkspaceChatMessage[] = [];
const EMPTY_CHAT_SESSION: WorkspaceAnswerSession = {
  messages: EMPTY_CHAT_MESSAGES,
  draftInput: "",
  loading: false,
};

function createEmptySession(): WorkspaceAnswerSession {
  return {
    ...EMPTY_CHAT_SESSION,
    messages: [...EMPTY_CHAT_MESSAGES],
  };
}

export function useWorkspaceChat({
  api,
  activeSessionKey,
  activeResume,
  activeJobDescription,
}: UseWorkspaceChatOptions) {
  const [chatSessions, setChatSessions] = useState<Record<string, WorkspaceAnswerSession>>({});
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const removedSessionKeysRef = useRef<Set<string>>(new Set());

  const activeChatSession = useMemo(() => {
    if (!activeSessionKey) return EMPTY_CHAT_SESSION;
    return chatSessions[activeSessionKey] ?? EMPTY_CHAT_SESSION;
  }, [activeSessionKey, chatSessions]);

  const chatMessages = activeChatSession.messages ?? EMPTY_CHAT_MESSAGES;
  const chatInput = activeChatSession.draftInput ?? "";
  const chatLoading = Boolean(activeChatSession.loading);

  const setChatInput = useCallback(
    (value: string) => {
      if (!activeSessionKey) return;
      removedSessionKeysRef.current.delete(activeSessionKey);
      setChatSessions((prev) => {
        const current = prev[activeSessionKey] ?? createEmptySession();
        return {
          ...prev,
          [activeSessionKey]: {
            ...current,
            draftInput: value,
          },
        };
      });
    },
    [activeSessionKey]
  );

  const removeChatSession = useCallback((sessionKey: string) => {
    if (!sessionKey) return;
    removedSessionKeysRef.current.add(sessionKey);
    setChatSessions((prev) => {
      if (!(sessionKey in prev)) return prev;
      const next = { ...prev };
      delete next[sessionKey];
      return next;
    });
  }, []);

  const handleSendChatMessage = useCallback(async () => {
    if (!activeSessionKey || !chatInput.trim() || chatLoading) return;

    const sessionKey = activeSessionKey;
    const question = chatInput.trim();
    const jobDescription = activeJobDescription?.trim() ?? "";
    const resumeJson = activeResume ?? {};
    removedSessionKeysRef.current.delete(sessionKey);

    setChatSessions((prev) => {
      const current = prev[sessionKey] ?? createEmptySession();
      return {
        ...prev,
        [sessionKey]: {
          ...current,
          draftInput: "",
          loading: true,
          messages: [...current.messages, { role: "user", content: question }],
        },
      };
    });

    try {
      const payload: Record<string, unknown> = {
        resumeJson,
        question,
        provider: "OPENAI",
      };
      if (jobDescription) {
        payload.jobDescription = jobDescription;
      }

      const response = (await api("/llm/interview-chat", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as { content?: string; provider?: string; model?: string };
      if (removedSessionKeysRef.current.has(sessionKey)) {
        return;
      }

      setChatSessions((prev) => {
        const current = prev[sessionKey] ?? createEmptySession();
        return {
          ...prev,
          [sessionKey]: {
            ...current,
            loading: false,
            messages: [
              ...current.messages,
              {
                role: "assistant",
                content: response.content || "I'm sorry, I couldn't generate a response.",
              },
            ],
          },
        };
      });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to get response.";
      if (removedSessionKeysRef.current.has(sessionKey)) {
        return;
      }
      setChatSessions((prev) => {
        const current = prev[sessionKey] ?? createEmptySession();
        return {
          ...prev,
          [sessionKey]: {
            ...current,
            loading: false,
            messages: [
              ...current.messages,
              {
                role: "assistant",
                content: `Error: ${message}`,
              },
            ],
          },
        };
      });
    }
  }, [activeJobDescription, activeResume, activeSessionKey, api, chatInput, chatLoading]);

  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSessionKey, chatLoading, chatMessages]);

  useEffect(() => {
    if (!activeSessionKey) return;
    const timer = window.setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [activeSessionKey]);

  return {
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    chatMessagesEndRef,
    chatInputRef,
    removeChatSession,
    handleSendChatMessage,
  };
}
