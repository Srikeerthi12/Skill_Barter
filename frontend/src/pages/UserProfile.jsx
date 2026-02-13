import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { getPublicProfileApi, getUserReviewsApi } from '../api/user.api';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProfileCard from '../components/ProfileCard.jsx';
import SkillCard from '../components/SkillCard.jsx';

export default function UserProfile() {
  const { id } = useParams();
  const [reviewsOffset, setReviewsOffset] = useState(0);
  const reviewsLimit = 10;

  const reviewsPageSize = reviewsOffset + reviewsLimit;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['publicProfile', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await getPublicProfileApi(id);
      return res.data;
    },
  });

  const { data: reviewsData, isLoading: isLoadingReviews, isError: isReviewsError } = useQuery({
    queryKey: ['publicReviews', id, reviewsPageSize],
    enabled: Boolean(id) && !isLoading && !isError && Boolean(data?.profile?.user),
    queryFn: async () => {
      const res = await getUserReviewsApi(id, { limit: reviewsPageSize, offset: 0 });
      return res.data;
    },
  });

  useEffect(() => {
    const status = error?.response?.status;
    if (isError && status !== 404) toast.error('Failed to load profile');
  }, [isError, error]);

  useEffect(() => {
    if (isReviewsError) toast.error('Failed to load reviews');
  }, [isReviewsError]);

  if (isLoading) return <Loader />;

  if (isError) {
    const status = error?.response?.status;
    if (status === 404) {
      return <EmptyState title="Profile not found" description="This user may not exist." />;
    }
    return (
      <EmptyState
        title="Couldn’t load profile"
        description="The server may be offline or the route may not be available yet. Try refreshing after restarting the backend."
      />
    );
  }

  const profile = data?.profile;
  if (!profile?.user) {
    return <EmptyState title="Profile not found" description="This user may not exist." />;
  }

  const skills = profile.skills || [];

  const reviews = reviewsData?.reviews || [];
  const pagination = reviewsData?.pagination;
  const canLoadMore = Boolean(pagination && pagination.offset + pagination.limit < pagination.total);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageActions">
        <div className="muted">Public profile</div>
      </div>

      <ProfileCard
        user={profile.user}
        completedExchangesCount={profile.completedExchangesCount}
        reputation={profile.reputation}
        subtitle="Skills offered and exchange history summary."
      />

      {skills.length ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <div style={{ fontWeight: 900 }}>Skills offered</div>
            <div className="muted">{skills.length}</div>
          </div>
          <div style={{ height: 10 }} />
          <div className="stack">
            {skills.map((s) => (
              <SkillCard key={s.id} skill={{ ...s, owner_name: profile.user.name }} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No skills yet" description="This user hasn’t added any skills." />
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>Reviews</div>
          <div className="muted">{profile.reputation?.ratingsCount || 0}</div>
        </div>
        <div style={{ height: 10 }} />

        {isLoadingReviews ? <div className="muted">Loading…</div> : null}

        {!isLoadingReviews && reviews.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{r.from_name || `User ${r.from_user_id}`}</div>
                  <div className="pill">{r.rating}/5</div>
                </div>

                {r.skill_title ? (
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    For: {r.skill_title}
                  </div>
                ) : null}

                {r.comment ? (
                  <div className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.comment}</div>
                ) : (
                  <div className="muted" style={{ marginTop: 8 }}>No comment.</div>
                )}
              </div>
            ))}

            {canLoadMore ? (
              <button className="button secondary" type="button" onClick={() => setReviewsOffset((v) => v + reviewsLimit)}>
                Load more
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoadingReviews && !reviews.length ? (
          <div className="muted">No reviews yet.</div>
        ) : null}
      </div>
    </div>
  );
}
