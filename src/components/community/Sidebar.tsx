import type { CommunityChannel, DirectoryUser, CommunityDmThread } from './types';
import { SectionHeader, AvatarBubble } from './UIComponents';
import { formatTime } from './utils';

type SidebarProps = {
  channels: CommunityChannel[];
  dms: CommunityDmThread[];
  memberList: DirectoryUser[];
  activeThreadId: string;
  unreadMap: Map<string, number>;
  overviewLoading: boolean;
  creatingDmId: string | null;
  dmLookup: Map<string, CommunityDmThread>;
  onThreadSelect: (id: string) => void;
  onStartDm: (targetId: string) => void;
};

export function Sidebar({
  channels,
  memberList,
  activeThreadId,
  unreadMap,
  overviewLoading,
  creatingDmId,
  dmLookup,
  onThreadSelect,
  onStartDm,
}: SidebarProps) {
  return (
    <aside
      className="w-full space-y-4"
      style={{ animation: 'soft-rise 0.5s ease both' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Community</p>
          <h1 className="text-lg font-semibold text-slate-100">Shared space</h1>
        </div>
        <span className="rounded-full bg-slate-700 px-3 py-1 text-[10px] font-semibold text-[var(--community-accent)]">
          Live
        </span>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Channels" count={channels.length} variant="dark" />
        {overviewLoading && !channels.length ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-xs text-slate-400">
            Loading channels...
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800 px-3 py-3 text-xs text-slate-400">
            No channels yet.
          </div>
        ) : (
          <div className="space-y-1">
            {channels.map((channel) => {
              const active = channel.id === activeThreadId;
              const unread = unreadMap.get(channel.id) || 0;
              return (
                <button
                  key={channel.id}
                  onClick={() => onThreadSelect(channel.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={`text-xs font-semibold ${active ? 'text-[var(--community-accent)]' : 'text-slate-500'}`}>#</span>
                      {channel.name ?? 'channel'}
                      {unread > 0 && (
                        <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                          {unread}
                        </span>
                      )}
                    </span>
                    {channel.description && (
                      <span className={`text-[11px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                        {channel.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                      {formatTime(channel.lastMessageAt ?? channel.createdAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-100">Direct Message</div>
        <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
          {overviewLoading && memberList.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-xs text-slate-400">
              Loading members...
            </div>
          ) : memberList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800 px-3 py-3 text-xs text-slate-400">
              No members available.
            </div>
          ) : (
            memberList.map((member) => {
              const isStarting = creatingDmId === member.id;
              const dm = dmLookup.get(member.id);
              const unread = dm ? unreadMap.get(dm.id) || 0 : 0;
              const isActive = dm?.id === activeThreadId;
              return (
                <button
                  key={member.id}
                  onClick={() => onStartDm(member.id)}
                  disabled={Boolean(creatingDmId)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive ? 'bg-slate-700/30' : ''
                  }`}
                >
                  <AvatarBubble name={member.userName} active={isActive} avatarUrl={member.avatarUrl} />
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-200'}`}>{member.userName}</div>
                    {isStarting && <div className="mt-1 text-[10px] text-slate-400">Starting DM...</div>}
                  </div>
                  {unread > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
