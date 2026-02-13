import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { getMyProfileApi, getUserReviewsApi } from '../api/user.api';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProfileCard from '../components/ProfileCard.jsx';

import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const { user } = useAuth();
  const [reviewsOffset, setReviewsOffset] = useState(0);
  const reviewsLimit = 10;

  const reviewsPageSize = reviewsOffset + reviewsLimit;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['myProfile'],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await getMyProfileApi();
      return res.data;
    },
  });

  const myUserId = data?.profile?.user?.id;
  const { data: reviewsData, isLoading: isLoadingReviews, isError: isReviewsError } = useQuery({
    queryKey: ['myReviews', myUserId, reviewsPageSize],
    enabled: Boolean(myUserId) && !isLoading && !isError,
    queryFn: async () => {
      const res = await getUserReviewsApi(myUserId, { limit: reviewsPageSize, offset: 0 });
      return res.data;
    },
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load profile');
  }, [isError]);

  useEffect(() => {
    if (isReviewsError) toast.error('Failed to load reviews');
  }, [isReviewsError]);

  if (isLoading) return <Loader />;

  const profile = data?.profile;
  if (!profile?.user) {
    return <EmptyState title="Profile unavailable" description="Please try again." />;
  }

  const skills = profile.skills || [];

  const reviews = reviewsData?.reviews || [];
  const pagination = reviewsData?.pagination;
  const canLoadMore = Boolean(pagination && pagination.offset + pagination.limit < pagination.total);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageActions">
        <div className="muted">Your account and skill listing.</div>
      </div>

      <ProfileCard
        user={profile.user}
        completedExchangesCount={profile.completedExchangesCount}
        reputation={profile.reputation}
      />

      {skills.length ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <div style={{ fontWeight: 900 }}>My Skills</div>
            <div className="muted">{skills.length}</div>
          </div>
          <div style={{ height: 10 }} />
          <div className="miniList">
            {skills.map((s) => (
              <div key={s.id} className="miniRow">
                <div style={{ minWidth: 0 }}>
                  <div className="miniTitle">{s.title}</div>
                  <div className="muted miniSub">Tap to manage</div>
                </div>
                <Link className="button secondary" to={`/skills/${s.id}`}>View</Link>
                <Link className="button secondary" to={`/skills/${s.id}/edit`}>Edit</Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No skills yet" description="Add a skill so others can request it.">
          <Link className="button" to="/skills/add">+ Add Skill</Link>
        </EmptyState>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>Reviews you received</div>
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

