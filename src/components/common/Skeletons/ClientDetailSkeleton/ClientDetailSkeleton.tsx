export default function ClientDetailSkeleton(): JSX.Element {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div
          className="skeleton skeleton-text"
          style={{ width: 120, height: 16, marginBottom: 12 }}
        />
        <div
          className="skeleton skeleton-text"
          style={{ width: 300, height: 32, marginBottom: 8 }}
        />
        <div className="skeleton skeleton-text" style={{ width: 250, height: 14 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="skeleton-card">
          <div
            className="skeleton skeleton-text"
            style={{ width: 180, height: 20, marginBottom: 16 }}
          />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="skeleton skeleton-text" style={{ width: "100%", height: 48 }} />
            </div>
          ))}
        </div>

        <div className="skeleton-card">
          <div
            className="skeleton skeleton-text"
            style={{ width: 180, height: 20, marginBottom: 16 }}
          />
          {[1, 2].map((i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="skeleton skeleton-text" style={{ width: "100%", height: 60 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
