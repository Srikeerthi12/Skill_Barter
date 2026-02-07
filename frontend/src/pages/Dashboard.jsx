import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiArrowRight, FiBookOpen, FiInfo, FiPlusCircle, FiX } from 'react-icons/fi';
import { listLearningApi } from '../api/exchange.api';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useMemo, useState } from 'react';

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['learning'],
    queryFn: async () => {
      const res = await listLearningApi();
      return res.data;
    },
  });

  const learning = data?.learning || [];

  const selected = useMemo(
    () => learning.find((x) => String(x.id) === String(selectedId)) || null,
    [learning, selectedId]
  );

  useEffect(() => {
    if (isError) toast.error('Failed to load learning courses');
  }, [isError]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageActions">
        <div className="muted">Welcome{user?.name ? `, ${user.name}` : ''}.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="button" to="/skills"><FiBookOpen /> Browse skills</Link>
          <Link className="button" to="/skills/add"><FiPlusCircle /> Add a skill</Link>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 950 }}>My Learning</div>
          <div className="muted">{learning.length}</div>
        </div>
        <div style={{ height: 10 }} />

        {isLoading ? <div className="muted">Loading…</div> : null}

        {!isLoading && learning.length ? (
          <div className="learningList">
            {learning.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="learningItem"
                onClick={() => setSelectedId(ex.id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="learningTitle">{ex.requested_title || 'Skill'}</div>
                  <div className="muted learningSub">From {ex.owner_name || 'Unknown'}</div>
                </div>
                <div className="learningIcon" aria-hidden="true"><FiInfo /></div>
              </button>
            ))}
          </div>
        ) : null}

        {!isLoading && !learning.length ? (
          <div className="muted">
            No accepted courses yet. Send a request from the Skills page.
          </div>
        ) : null}
      </div>

      {selected ? (
        <div
          className="modalBackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="modalCard" role="dialog" aria-modal="true">
            <div className="modalHeader">
              <div style={{ minWidth: 0 }}>
                <div className="modalTitle">{selected.requested_title || 'Skill'}</div>
                <div className="muted" style={{ fontSize: 13 }}>From {selected.owner_name || 'Unknown'}</div>
              </div>
              <button className="iconButton" type="button" onClick={() => setSelectedId(null)} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="modalBody">
              <div className="modalRow">
                <div className="muted" style={{ fontSize: 13 }}>You offered</div>
                <div style={{ fontWeight: 900 }}>{selected.offered_title || '—'}</div>
              </div>
              <div className="modalRow" style={{ gap: 8 }}>
                <FiArrowRight style={{ opacity: 0.6 }} />
                <div className="muted" style={{ fontSize: 13 }}>You learn</div>
                <div style={{ fontWeight: 900 }}>{selected.requested_title || '—'}</div>
              </div>

              {selected.message ? (
                <div className="modalMessage">
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Message</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{selected.message}</div>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>No message.</div>
              )}
            </div>

            <div className="modalFooter">
              <button className="button secondary" type="button" onClick={() => setSelectedId(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
