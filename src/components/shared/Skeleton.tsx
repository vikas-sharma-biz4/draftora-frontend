export function SkeletonCard(): JSX.Element {
  return (
    <div className="proposal-card skeleton-card">
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 16 }} />
      <div className="skeleton" style={{ width: "70%", height: 18, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: "50%", height: 14, marginBottom: 20 }} />
      <div className="skeleton" style={{ width: "40%", height: 22, borderRadius: 99 }} />
    </div>
  );
}

export function SkeletonSection(): JSX.Element {
  return (
    <div className="section-card">
      <div className="skeleton" style={{ width: "40%", height: 22, marginBottom: 16 }} />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" style={{ width: "90%" }} />
      <div className="skeleton skeleton-text" style={{ width: "80%" }} />
    </div>
  );
}
