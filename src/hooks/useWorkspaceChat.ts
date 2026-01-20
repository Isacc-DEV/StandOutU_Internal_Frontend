import { useCallback, useEffect, useRef, useState } from "react";
import type { BaseResume } from "../app/workspace/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

type UseWorkspaceChatOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  tailoredResume: BaseResume | null;
  jdDraft: string;
};

export function useWorkspaceChat({
  api,
  tailoredResume,
  jdDraft,
}: UseWorkspaceChatOptions) {
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatProvider, setChatProvider] = useState<"HUGGINGFACE" | "OPENAI" | "GEMINI">(
    "HUGGINGFACE"
  );
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenChatModal = useCallback(async () => {
    setChatModalOpen(true);
    setChatMessages([]);
    setChatInput("");

    // Restore last generated resume_json and job_description
    if (typeof window !== "undefined") {
      try {
        const savedResumeJson = localStorage.getItem("last_resume_json");
        const savedJobDescription = localStorage.getItem("last_job_description");

        if (savedResumeJson && savedJobDescription) {
          JSON.parse(savedResumeJson);
          // Send initial context
          setChatMessages([
            {
              role: "assistant",
              content: "I'm ready. I have your resume and job description. Ask me any interview questions!",
            },
          ]);
        } else {
          setChatMessages([
            {
              role: "assistant",
              content:
                "I'm ready, but I don't have your resume or job description yet. Please generate a resume first, or provide them manually.",
            },
          ]);
        }
      } catch (e) {
        console.error("Failed to restore resume data", e);
        setChatMessages([
          {
            role: "assistant",
            content: "I'm ready. Please provide your resume and job description.",
          },
        ]);
      }
    }
  }, []);

  const handleSendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;

    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);

    try {
      // Get saved resume_json and job_description
      let resumeJson: BaseResume | null = null;
      let jobDescription = "";

      if (typeof window !== "undefined") {
        try {
          const savedResumeJson = localStorage.getItem("last_resume_json");
          const savedJobDescription = localStorage.getItem("last_job_description");

          if (savedResumeJson) {
            resumeJson = JSON.parse(savedResumeJson);
          }
          if (savedJobDescription) {
            jobDescription = savedJobDescription;
          }
        } catch (e) {
          console.error("Failed to load saved data", e);
        }
      }

      // Fallback to current state if not in localStorage
      if (!resumeJson && tailoredResume) {
        resumeJson = tailoredResume;
      }
      if (!jobDescription && jdDraft.trim()) {
        jobDescription = jdDraft.trim();
      }

      if (!jobDescription) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I need a job description to answer your question. Please generate a resume with a job description first.",
          },
        ]);
        return;
      }

      const payload: Record<string, unknown> = {
        resumeJson: resumeJson || {},
        jobDescription,
        question,
        provider: chatProvider,
      };

      const response = (await api("/llm/interview-chat", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as { content?: string; provider?: string; model?: string };

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.content || "I'm sorry, I couldn't generate a response.",
        },
      ]);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to get response.";
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${message}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [api, chatInput, chatLoading, chatProvider, jdDraft, tailoredResume]);

  useEffect(() => {
    if (chatModalOpen) {
      if (chatMessagesEndRef.current) {
        chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      // Auto-focus input when modal opens
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    }
  }, [chatModalOpen, chatMessages]);

  return {
    chatModalOpen,
    setChatModalOpen,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    chatProvider,
    setChatProvider,
    chatMessagesEndRef,
    chatInputRef,
    handleOpenChatModal,
    handleSendChatMessage,
  };
}
