import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { deleteSkillApi, getSkillApi, getSkillReviewsApi } from '../api/skill.api';
import { listLearningApi } from '../api/exchange.api';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function SkillDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reviewsOffset, setReviewsOffset] = useState(0);
  const reviewsLimit = 10;
  const reviewsPageSize = reviewsOffset + reviewsLimit;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await getSkillApi(id);
      return res.data;
    },
  });

  const skill = data?.skill;

  const { data: learningData } = useQuery({
    queryKey: ['learning'],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await listLearningApi();
      return res.data;
    },
  });

  const { data: reviewsData, isLoading: isLoadingReviews, isError: isReviewsError } = useQuery({
    queryKey: ['skillReviews', id, reviewsPageSize],
    enabled: Boolean(skill?.id),
    queryFn: async () => {
      const res = await getSkillReviewsApi(id, { limit: reviewsPageSize, offset: 0 });
      return res.data;
    },
  });

  const isOwner = Boolean(user?.id && skill?.user_id && String(user.id) === String(skill.user_id));

  const isEnrolled = useMemo(() => {
    if (!skill?.id) return false;
    const rows = learningData?.learning || [];
    return rows.some((ex) => String(ex.skill_requested_id) === String(skill.id) && String(ex.owner_id) === String(skill.user_id));
  }, [learningData?.learning, skill?.id, skill?.user_id]);

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await deleteSkillApi(id);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Skill deleted');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      navigate('/skills');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to delete skill'),
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load skill');
  }, [isError]);

  useEffect(() => {
    if (isReviewsError) toast.error('Failed to load ratings');
  }, [isReviewsError]);

  if (isLoading) return <Loader />;
  if (!skill) return <EmptyState title="Skill not found" description="This skill may have been removed." />;

  const skillAverageRating = skill?.skill_average_rating ?? 0;
  const skillRatingsCount = skill?.skill_ratings_count ?? 0;
  const reviews = reviewsData?.reviews || [];
  const pagination = reviewsData?.pagination;
  const canLoadMore = Boolean(pagination && pagination.offset + pagination.limit < pagination.total);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageActions">
        <div className="muted">Skill details</div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 950, fontSize: '1.2rem' }}>{skill.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>#{skill.id}</div>
        </div>
        <div className="muted">
          By{' '}
          {skill.user_id ? (
            <Link to={`/user/${skill.user_id}`} style={{ fontWeight: 800 }}>
              {skill.owner_name || `User ${skill.user_id}`}
            </Link>
          ) : (
            skill.owner_name || 'Unknown'
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Number(skillRatingsCount) > 0 ? (
            <div className="pill" style={{ cursor: 'default' }}>
              Rating: {Number(skillAverageRating)}/5 ({Number(skillRatingsCount)})
            </div>
          ) : (
            <div className="pill" style={{ cursor: 'default' }}>No ratings yet</div>
          )}
        </div>

        <div style={{ whiteSpace: 'pre-wrap' }}>{skill.description || '—'}</div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          {isOwner ? (
            <>
              <Link className="button secondary" to={`/skills/${skill.id}/edit`}>Edit</Link>
              <button
                className="button danger"
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  const ok = window.confirm('Delete this skill?');
                  if (ok) remove();
                }}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : isEnrolled ? (
            <button className="pill" type="button" disabled>Enrolled</button>
          ) : (
            <button className="button" type="button" onClick={() => navigate(`/skills/${skill.id}/request`)}>
              Request exchange
            </button>
          )}
          <Link className="button secondary" to="/skills">Back to skills</Link>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>Ratings & feedback</div>
          <div className="muted">{Number(skillRatingsCount) || 0}</div>
        </div>
        <div style={{ height: 10 }} />

        {isLoadingReviews ? <div className="muted">Loading…</div> : null}

        {!isLoadingReviews && reviews.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{r.from_name || `User ${r.from_user_id}`}</div>
                  <div className="pill" style={{ cursor: 'default' }}>{r.rating}/5</div>
                </div>
                {r.comment ? (
                  <div className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.comment}</div>
                ) : (
                  <div className="muted" style={{ marginTop: 8 }}>No comment.</div>
                )}
              </div>
            ))}

            {canLoadMore ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => setReviewsOffset((v) => v + reviewsLimit)}
              >
                Load more
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoadingReviews && !reviews.length ? <div className="muted">No feedback yet.</div> : null}
      </div>
    </div>
  );
}
