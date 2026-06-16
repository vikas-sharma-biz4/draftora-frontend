export default function HistoryCardSkeleton(): JSX.Element {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <div className="skeleton skeleton-text" style={{ width: "60%", height: 18 }} />
        <div className="skeleton skeleton-badge" style={{ width: 80, height: 22 }} />
      </div>
      <div className="skeleton-card-body">
        <div
          className="skeleton skeleton-text"
          style={{ width: "45%", height: 14, marginBottom: 8 }}
        />
        <div className="skeleton skeleton-text" style={{ width: "35%", height: 12 }} />
      </div>
      <div className="skeleton-card-footer">
        <div className="skeleton skeleton-button" style={{ width: 80, height: 32 }} />
        <div className="skeleton skeleton-button" style={{ width: 100, height: 32 }} />
      </div>
    </div>
  );
}
