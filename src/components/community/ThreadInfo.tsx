import type {
  CommunityChannel,
  CommunityDmThread,
  CommunityThreadType,
} from './types';
import { InfoRow } from './UIComponents';
import { formatDmTitle, formatDate } from './utils';

interface ThreadInfoProps {
  activeChannel?: CommunityChannel;
  activeDm?: CommunityDmThread;
  activeType: CommunityThreadType | null;
  activeLabel: string;
  onClose?: () => void;
}

export function ThreadInfo({ activeChannel, activeDm, activeType, activeLabel, onClose }: ThreadInfoProps) {
  return (
    <aside
      className="w-[300px] shrink-0 space-y-4"
      style={{ animation: 'soft-rise 0.5s ease both', animationDelay: '120ms' }}
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Room info</p>
            <h3 className="text-lg font-semibold text-slate-900">
              {activeType ? activeLabel : 'Community'}
            </h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-0 right-0 p-1 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Close room info"
            >
              <svg
                className="w-5 h-5 text-slate-500 hover:text-slate-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-3 space-y-3 rounded-2xl border border-[var(--community-line)] bg-[var(--community-soft)] p-3 text-sm">
          {activeChannel ? (
            <>
              <InfoRow label="Name" value={activeChannel.name ?? 'channel'} />
              <InfoRow label="Topic" value={activeChannel.description || 'Set a short description.'} />
              <InfoRow label="Visibility" value={activeChannel.isPrivate ? 'Private' : 'Public'} />
              <InfoRow label="Created" value={formatDate(activeChannel.createdAt)} />
            </>
          ) : activeDm ? (
            <>
              <InfoRow label="Participants" value={formatDmTitle(activeDm)} />
              <InfoRow label="Visibility" value={activeDm.isPrivate ? 'Private' : 'Public'} />
              <InfoRow label="Created" value={formatDate(activeDm.createdAt)} />
            </>
          ) : (
            <div className="text-xs text-slate-500">Select a thread to see details and metadata.</div>
          )}
        </div>
      </div>
    </aside>
  );
}