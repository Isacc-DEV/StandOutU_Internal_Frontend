import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, Paperclip, Save, Smile, X, XCircle } from 'lucide-react';
import type { CommunityMessage } from './types';
import { EmojiPicker, getEmojiPreview, parseEmojiShortcuts } from './EmojiPicker';

interface MessageInputProps {
  draftMessage: string;
  replyingTo: CommunityMessage | null;
  editingMessage: CommunityMessage | null;
  editDraft: string;
  selectedFiles: File[];
  previewUrls: string[];
  uploading: boolean;
  uploadProgress: number;
  sending: boolean;
  inputDisabled: boolean;
  activeThreadId: string;
  activeLabel: string;
  onDraftChange: (value: string) => void;
  onEditDraftChange: (value: string) => void;
  onSend: () => void;
  onEditSave: () => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFiles: () => void;
  onTyping: () => void;
}

export function MessageInput({
  draftMessage,
  replyingTo,
  editingMessage,
  editDraft,
  selectedFiles,
  previewUrls,
  uploading,
  uploadProgress,
  sending,
  inputDisabled,
  activeThreadId,
  activeLabel,
  onDraftChange,
  onEditDraftChange,
  onSend,
  onEditSave,
  onCancelReply,
  onCancelEdit,
  onFileSelect,
  onClearFiles,
  onTyping,
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPreview, setEmojiPreview] = useState<{ emoji: string; position: number } | null>(null);

  const currentDraft = editingMessage ? editDraft : draftMessage;
  const handleDraftChange = editingMessage ? onEditDraftChange : onDraftChange;

  useEffect(() => {
    setEmojiPreview(getEmojiPreview(currentDraft));
  }, [currentDraft]);

  const handleEmojiSelect = (emoji: string) => {
    handleDraftChange(currentDraft + emoji);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    handleDraftChange(value);
    if (!editingMessage) {
      onTyping();
    }
  };

  const handleSendClick = () => {
    const processedMessage = parseEmojiShortcuts(currentDraft);
    handleDraftChange(processedMessage);
    window.setTimeout(() => {
      if (editingMessage) {
        onEditSave();
      } else {
        onSend();
      }
    }, 0);
  };

  return (
    <div className="border-t border-slate-100 px-6 py-4">
      {replyingTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <div className="flex-1">
            <div className="font-semibold">Replying to {replyingTo.senderName || 'User'}</div>
            <div className="truncate text-slate-600">{replyingTo.body}</div>
          </div>
          <button onClick={onCancelReply} className="text-slate-500 hover:text-slate-700" aria-label="Cancel reply">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {editingMessage ? (
        <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="mb-1 text-xs font-semibold text-blue-900">Editing message</div>
          <input
            value={editDraft}
            onChange={(event) => onEditDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onEditSave();
              }
              if (event.key === 'Escape') {
                onCancelEdit();
              }
            }}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
          <div className="mt-1 flex gap-2">
            <button onClick={onEditSave} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="flex items-center gap-1 text-xs text-slate-600 hover:underline"
            >
              <XCircle className="h-3 w-3 text-slate-600" />
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {selectedFiles.length > 0 ? (
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">
            {selectedFiles.length} file(s) selected
          </div>
          <div className="space-y-2 pb-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{file.name}</div>
                  <div className="text-xs text-slate-500">
                    {file.type.startsWith('image/') ? 'Image attachment' : 'File attachment'}
                    {previewUrls[index] ? ' ready' : ''}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
          {uploading ? (
            <div className="mb-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
          <button
            onClick={onClearFiles}
            className="mt-1 text-xs text-slate-600 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="relative flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={inputDisabled}
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          disabled={inputDisabled}
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          title="Add emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
        {showEmojiPicker ? (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
            buttonRef={emojiButtonRef}
          />
        ) : null}
        <div className="relative flex-1">
          <input
            value={currentDraft}
            onChange={handleInputChange}
            placeholder={activeThreadId ? `Message ${activeLabel}` : 'Select a thread to message'}
            disabled={inputDisabled}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendClick();
              }
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300 disabled:bg-slate-100"
          />
          {emojiPreview ? (
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xl">
              {emojiPreview.emoji}
            </div>
          ) : null}
        </div>
        <button
          onClick={handleSendClick}
          disabled={inputDisabled || (!currentDraft.trim() && selectedFiles.length === 0)}
          className="flex min-w-[80px] items-center justify-center rounded-2xl bg-[var(--community-accent)] px-4 py-3 text-xs font-semibold text-[var(--community-ink)] shadow-[0_10px_25px_-16px_rgba(99,102,241,0.8)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending || uploading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : editingMessage ? (
            'Save'
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
