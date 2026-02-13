export default function ProfileCard({ user, completedExchangesCount = 0, subtitle = '', reputation = null }) {
  if (!user) return null;

  const created = user.created_at ? new Date(user.created_at) : null;
  const since = created && !Number.isNaN(created.valueOf()) ? created.toLocaleDateString() : '';

  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ fontWeight: 950, fontSize: '1.1rem' }}>{user.name || 'User'}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {reputation?.ratingsCount ? (
            <div className="pill">Rating: {reputation.averageRating}/5 ({reputation.ratingsCount})</div>
          ) : (
            <div className="pill">No ratings yet</div>
          )}
          <div className="pill">Completed: {completedExchangesCount}</div>
        </div>
      </div>

      {subtitle ? <div className="muted">{subtitle}</div> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {user.email ? <div className="muted" style={{ fontSize: 13 }}>Email: {user.email}</div> : null}
        {since ? <div className="muted" style={{ fontSize: 13 }}>Member since: {since}</div> : null}
      </div>
    </div>
  );
}
