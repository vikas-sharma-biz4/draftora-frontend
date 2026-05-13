export default function DraftCardSkeleton(): JSX.Element {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <div className="skeleton skeleton-circle" style={{ width: 40, height: 40 }} />
        <div className="skeleton skeleton-circle" style={{ width: 32, height: 32 }} />
      </div>
      <div className="skeleton-card-body">
        <div className="skeleton skeleton-text" style={{ width: '80%', height: 18, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '50%', height: 14, marginBottom: 12 }} />
        <div className="skeleton-card-meta">
          <div className="skeleton skeleton-text" style={{ width: '30%', height: 12 }} />
          <div className="skeleton skeleton-text" style={{ width: '40%', height: 12 }} />
        </div>
        <div className="skeleton skeleton-text" style={{ width: '35%', height: 14, marginTop: 8 }} />
      </div>
      <div className="skeleton-card-footer">
        <div className="skeleton skeleton-button" style={{ width: '100%', height: 32 }} />
      </div>
    </div>
  );
}
