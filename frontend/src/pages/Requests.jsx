import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listRequestsApi, respondRequestApi } from '../api/exchange.api';
import { useAuth } from '../hooks/useAuth';

export default function Requests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const res = await listRequestsApi();
      return res.data;
    },
  });

  const requests = data?.requests || [];

  const { mutate: respond, isPending: isResponding } = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await respondRequestApi(id, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Updated request');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: () => toast.error('Failed to update request'),
  });

  const grouped = useMemo(() => {
    const myId = user?.id;
    const incoming = [];
    const outgoing = [];
    for (const r of requests) {
      if (String(r.requester_id) === String(myId)) outgoing.push(r);
      else if (String(r.owner_id) === String(myId)) incoming.push(r);
      else outgoing.push(r);
    }
    return { incoming, outgoing };
  }, [requests, user?.id]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageHeader">
        <div>
          <h2 style={{ margin: 0 }}>Requests</h2>
          <div className="muted">Requests you received and requests you sent.</div>
        </div>
      </div>

      {isLoading ? (
        <div className="card">Loading…</div>
      ) : isError ? (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Couldn’t load requests</div>
          <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
            {error?.message || 'Unknown error'}
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No requests yet</div>
          <div className="muted">Go to Skills and click “Request” on a skill you want.</div>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>Requests you received</div>
              <div className="muted">{grouped.incoming.length}</div>
            </div>
            {grouped.incoming.length === 0 ? (
              <div className="muted">No received requests.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {grouped.incoming.map((r) => (
                  <div key={r.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>Request #{r.id}</div>
                        <div className="muted">From: {r.requester_name || r.requester_id} • Status: {r.status}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.status === 'pending' ? (
                          <>
                            <button
                              className="button"
                              disabled={isResponding}
                              onClick={() => respond({ id: r.id, status: 'accepted' })}
                            >
                              Accept
                            </button>
                            <button
                              className="button danger"
                              disabled={isResponding}
                              onClick={() => respond({ id: r.id, status: 'rejected' })}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {r.message ? (
                      <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{r.message}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>Requests you sent</div>
              <div className="muted">{grouped.outgoing.length}</div>
            </div>
            {grouped.outgoing.length === 0 ? (
              <div className="muted">No sent requests.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {grouped.outgoing.map((r) => (
                  <div key={r.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>Request #{r.id}</div>
                        <div className="muted">To: {r.owner_name || r.owner_id} • Status: {r.status}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.status === 'pending' ? (
                          <button
                            className="button danger"
                            disabled={isResponding}
                            onClick={() => respond({ id: r.id, status: 'cancelled' })}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {r.message ? (
                      <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{r.message}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
