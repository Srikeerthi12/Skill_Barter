export default function EmptyState({ title = 'Nothing here yet', description = '', children = null }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      {description ? <div className="muted">{description}</div> : null}
      {children ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}
