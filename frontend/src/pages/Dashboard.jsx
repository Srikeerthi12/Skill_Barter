import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiArrowRight, FiBookOpen, FiInfo, FiPlusCircle, FiX } from 'react-icons/fi';
import {
  completeExchangeApi,
  getExchangeFeedbackApi,
  listLearningApi,
  listTeachingApi,
  upsertExchangeFeedbackApi,
} from '../api/exchange.api';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useMemo, useState } from 'react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error: learningError } = useQuery({
    queryKey: ['learning'],
    queryFn: async () => {
      const res = await listLearningApi();
      return res.data;
    },
  });

  const {
    data: teachingData,
    isLoading: isTeachingLoading,
    isError: isTeachingError,
    error: teachingError,
  } = useQuery({
    queryKey: ['teaching'],
    queryFn: async () => {
      const res = await listTeachingApi();
      return res.data;
    },
  });

  const learning = data?.learning || [];
  const teaching = teachingData?.teaching || [];

  const allExchanges = useMemo(() => {
    const map = new Map();
    for (const ex of learning) map.set(String(ex.id), ex);
    for (const ex of teaching) map.set(String(ex.id), ex);
    return Array.from(map.values());
  }, [learning, teaching]);

  const selected = useMemo(
    () => allExchanges.find((x) => String(x.id) === String(selectedId)) || null,
    [allExchanges, selectedId]
  );

  const otherPartyName = useMemo(() => {
    if (!selected) return '';
    const me = String(user?.id || '');
    const requesterId = String(selected.requester_id ?? selected.requesterId ?? '');
    return requesterId === me ? (selected.owner_name || 'Unknown') : (selected.requester_name || 'Unknown');
  }, [selected, user?.id]);

  const iAmRequester = useMemo(() => {
    if (!selected || !user?.id) return false;
    return String(selected.requester_id ?? selected.requesterId) === String(user.id);
  }, [selected, user?.id]);

  const myCompletionAt = useMemo(() => {
    if (!selected) return null;
    return iAmRequester ? selected.completed_by_requester_at : selected.completed_by_owner_at;
  }, [selected, iAmRequester]);

  const otherCompletionAt = useMemo(() => {
    if (!selected) return null;
    return iAmRequester ? selected.completed_by_owner_at : selected.completed_by_requester_at;
  }, [selected, iAmRequester]);

  const { data: feedbackData } = useQuery({
    queryKey: ['exchangeFeedback', selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const res = await getExchangeFeedbackApi(selectedId);
      return res.data;
    },
  });


  const myFeedback = useMemo(() => {
    const rows = feedbackData?.feedback || [];
    if (!user?.id) return null;
    return rows.find((f) => String(f.from_user_id) === String(user.id)) || null;
  }, [feedbackData?.feedback, user?.id]);

  const feedbackReceived = useMemo(() => {
    const rows = feedbackData?.feedback || [];
    if (!user?.id) return null;
    return rows.find((f) => String(f.to_user_id) === String(user.id)) || null;
  }, [feedbackData?.feedback, user?.id]);

  useEffect(() => {
    setRating('');
    setComment('');
  }, [selectedId]);

  useEffect(() => {
    if (!myFeedback) return;
    setRating(String(myFeedback.rating ?? ''));
    setComment(String(myFeedback.comment ?? ''));
  }, [myFeedback]);

  const { mutate: markCompleted, isPending: isCompleting } = useMutation({
    mutationFn: async (id) => {
      const res = await completeExchangeApi(id);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Completion confirmed');
      queryClient.invalidateQueries({ queryKey: ['learning'] });
      queryClient.invalidateQueries({ queryKey: ['teaching'] });
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to complete exchange'),
  });

  const { mutate: saveFeedback, isPending: isSavingFeedback } = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing exchange');
      const payload = { rating: Number(rating), comment };
      const res = await upsertExchangeFeedbackApi(selectedId, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Feedback saved');
      queryClient.invalidateQueries({ queryKey: ['exchangeFeedback', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['learning'] });
      queryClient.invalidateQueries({ queryKey: ['teaching'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save feedback'),
  });

  useEffect(() => {
    if (!isError) return;
    const status = learningError?.response?.status;
    const message = learningError?.response?.data?.message || 'Failed to load learning courses';
    if (status === 401) {
      toast.error('Session expired. Please login again.');
      logout();
      return;
    }
    toast.error(message);
  }, [isError, learningError, logout]);

  useEffect(() => {
    if (!isTeachingError) return;
    const status = teachingError?.response?.status;
    const message = teachingError?.response?.data?.message || 'Failed to load teaching courses';
    if (status === 401) {
      toast.error('Session expired. Please login again.');
      logout();
      return;
    }
    toast.error(message);
  }, [isTeachingError, teachingError, logout]);

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
              (() => {
                const iAmRequesterRow = String(ex.requester_id) === String(user?.id);
                const otherPartyRow = iAmRequesterRow ? ex.owner_name : ex.requester_name;
                const youLearnTitleRow = iAmRequesterRow ? ex.requested_title : ex.offered_title;

                return (
              <button
                key={ex.id}
                type="button"
                className="learningItem"
                onClick={() => setSelectedId(ex.id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="learningTitle">{youLearnTitleRow || 'Skill'}</div>
                  <div className="muted learningSub">
                    With {otherPartyRow || 'Unknown'}{ex.status ? ` • ${ex.status}` : ''}
                  </div>
                </div>
                <div className="learningIcon" aria-hidden="true"><FiInfo /></div>
              </button>
                );
              })()
            ))}
          </div>
        ) : null}

        {!isLoading && !learning.length ? (
          <div className="muted">
            No accepted courses yet. Send a request from the Skills page.
          </div>
        ) : null}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 950 }}>My Teaching</div>
          <div className="muted">{teaching.length}</div>
        </div>
        <div style={{ height: 10 }} />

        {isTeachingLoading ? <div className="muted">Loading…</div> : null}

        {!isTeachingLoading && teaching.length ? (
          <div className="learningList">
            {teaching.map((ex) => (
              (() => {
                const iAmRequesterRow = String(ex.requester_id) === String(user?.id);
                const otherPartyRow = iAmRequesterRow ? ex.owner_name : ex.requester_name;
                const youTeachTitleRow = iAmRequesterRow ? ex.offered_title : ex.requested_title;

                return (
              <button
                key={ex.id}
                type="button"
                className="learningItem"
                onClick={() => setSelectedId(ex.id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="learningTitle">{youTeachTitleRow || 'Skill'}</div>
                  <div className="muted learningSub">
                    With {otherPartyRow || 'Unknown'}{ex.status ? ` • ${ex.status}` : ''}
                  </div>
                </div>
                <div className="learningIcon" aria-hidden="true"><FiInfo /></div>
              </button>
                );
              })()
            ))}
          </div>
        ) : null}

        {!isTeachingLoading && !teaching.length ? (
          <div className="muted">
            No accepted teaching yet. When someone requests your skill and you accept, it will show here.
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
                <div className="muted" style={{ fontSize: 13 }}>
                  With {otherPartyName || 'Unknown'}{selected.status ? ` • ${selected.status}` : ''}
                </div>
              </div>
              <button className="iconButton" type="button" onClick={() => setSelectedId(null)} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="modalBody">
              <div className="modalRow">
                <div className="muted" style={{ fontSize: 13 }}>{iAmRequester ? 'You offered' : 'They offered'}</div>
                <div style={{ fontWeight: 900 }}>{selected.offered_title || '—'}</div>
              </div>
              <div className="modalRow" style={{ gap: 8 }}>
                <FiArrowRight style={{ opacity: 0.6 }} />
                <div className="muted" style={{ fontSize: 13 }}>{iAmRequester ? 'You learn' : 'You teach'}</div>
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

              {selected.status === 'accepted' ? (
                <div className="modalMessage">
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Completion</div>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    Both users must confirm to mark this exchange completed.
                  </div>

                  <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                    <div className="muted" style={{ fontSize: 13 }}>
                      You: {myCompletionAt ? 'Confirmed' : 'Not confirmed'}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {otherPartyName || 'Other user'}: {otherCompletionAt ? 'Confirmed' : 'Waiting'}
                    </div>
                  </div>

                  <button
                    className="button"
                    type="button"
                    disabled={isCompleting || Boolean(myCompletionAt)}
                    onClick={() => markCompleted(selected.id)}
                  >
                    {myCompletionAt ? 'You confirmed' : isCompleting ? 'Confirming…' : 'Confirm completion'}
                  </button>
                </div>
              ) : null}


              {selected.status === 'completed' ? (
                <div className="modalMessage">
                  {feedbackReceived ? (
                    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Feedback you received</div>
                      <div style={{ fontWeight: 900 }}>
                        Rating: {feedbackReceived.rating}/5
                      </div>
                      {feedbackReceived.comment ? (
                        <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{feedbackReceived.comment}</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Leave feedback</div>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    Rate your experience with {otherPartyName || 'the other user'}.
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Rating</div>
                      <select className="input" value={rating} onChange={(e) => setRating(e.target.value)}>
                        <option value="">Select…</option>
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Good</option>
                        <option value="3">3 - Okay</option>
                        <option value="2">2 - Bad</option>
                        <option value="1">1 - Very bad</option>
                      </select>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Comment (optional)</div>
                      <textarea
                        className="input"
                        rows={4}
                        placeholder="Write a short note…"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </div>

                    <button
                      className="button"
                      type="button"
                      disabled={isSavingFeedback || !rating}
                      onClick={() => saveFeedback()}
                    >
                      {isSavingFeedback ? 'Saving…' : myFeedback ? 'Update feedback' : 'Submit feedback'}
                    </button>
                  </div>

                  {(feedbackData?.feedback || []).length ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Feedback on this exchange</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {(feedbackData?.feedback || []).map((f) => (
                          <div key={f.id} className="card" style={{ padding: 12 }}>
                            <div style={{ fontWeight: 900 }}>
                              {f.from_name || `User ${f.from_user_id}`} → {f.to_name || `User ${f.to_user_id}`}
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>Rating: {f.rating}/5</div>
                            {f.comment ? <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{f.comment}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
