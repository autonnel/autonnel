import React, { useEffect, useRef, useState } from 'react';
import { Button as DsButton, Card as DsCard } from '@/components/primitives/ds';
import { apiCall } from '@/lib/api/client';
import type { NotificationLogRow } from './types';
import { LOGS_REFRESH_MS, LOGS_PAGE_SIZE } from './types';
import { dsSelectClass } from '@/components/primitives';
import { cn } from '@/lib/utils';

export default function RecordsTable() {
  const [items, setItems] = useState<NotificationLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(LOGS_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET /api/settings/notifications/logs', null, {
        query: {
          page: String(page),
          pageSize: String(pageSize),
          channel: channelFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      // keep previous data on transient failure (matches prior silent-return behavior)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, channelFilter, statusFilter]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void fetchLogs();
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => void fetchLogs(), LOGS_REFRESH_MS);
      } else {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }
    }
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, channelFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DsCard>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-ds-ink">Notification records</div>
            <div className="text-[12px] text-ds-muted mt-0.5">
              Records are kept for 3 days.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className={cn(dsSelectClass, 'h-8')}
            >
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="webhook">Webhook</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={cn(dsSelectClass, 'h-8')}
            >
              <option value="">All status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-ds-muted border-b border-ds-line">
                <th className="px-2 py-1.5 font-medium">Time</th>
                <th className="px-2 py-1.5 font-medium">Channel</th>
                <th className="px-2 py-1.5 font-medium">Purpose</th>
                <th className="px-2 py-1.5 font-medium">Recipient</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-ds-muted">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-ds-muted">
                    No notification records yet.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isOpen = expanded === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className="border-b border-ds-line cursor-pointer hover:bg-[#F9FAFB]"
                        onClick={() => setExpanded(isOpen ? null : row.id)}
                      >
                        <td className="px-2 py-1.5 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                        <td className="px-2 py-1.5">{row.channel}</td>
                        <td className="px-2 py-1.5">{row.purpose}</td>
                        <td className="px-2 py-1.5 max-w-[180px] truncate">{row.recipient}</td>
                        <td className="px-2 py-1.5">
                          <span
                            className={
                              row.status === 'sent'
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 max-w-[240px] truncate" title={row.error || ''}>
                          {row.error || ''}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-ds-line bg-[#FAFAFA]">
                          <td colSpan={6} className="px-2 py-2">
                            {row.subject && (
                              <div className="text-[12px] text-ds-muted mb-1">Subject: {row.subject}</div>
                            )}
                            <pre className="text-[11.5px] text-ds-ink whitespace-pre-wrap break-words font-ds-mono">
                              {row.content}
                            </pre>
                            {row.error && (
                              <pre className="text-[11.5px] text-red-600 whitespace-pre-wrap break-words font-ds-mono mt-2">
                                {row.error}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-[12.5px] text-ds-muted">
          <span>
            {total} record{total === 1 ? '' : 's'} · page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <DsButton
              variant="default"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Prev
            </DsButton>
            <DsButton
              variant="default"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </DsButton>
          </div>
        </div>
      </div>
    </DsCard>
  );
}
