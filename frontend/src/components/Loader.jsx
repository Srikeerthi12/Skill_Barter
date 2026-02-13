export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      {label}
    </div>
  );
}
