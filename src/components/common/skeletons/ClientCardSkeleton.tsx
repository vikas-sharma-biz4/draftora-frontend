export default function ClientCardSkeleton(): JSX.Element {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <div className="skeleton skeleton-circle" style={{ width: 48, height: 48 }} />
        <div className="skeleton skeleton-badge" style={{ width: 60, height: 20 }} />
      </div>
      <div className="skeleton-card-body">
        <div className="skeleton skeleton-text" style={{ width: '70%', height: 20, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '50%', height: 16, marginBottom: 16 }} />
        <div className="skeleton skeleton-text" style={{ width: '40%', height: 14 }} />
      </div>
      <div className="skeleton-card-footer">
        <div className="skeleton skeleton-text" style={{ width: '35%', height: 16 }} />
      </div>
    </div>
  );
}
