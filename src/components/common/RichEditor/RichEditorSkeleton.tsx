/**
 * RichEditorSkeleton — production-grade loading state for RichEditor
 *
 * Preserves approximate layout dimensions to prevent CLS during lazy loading.
 * Matches the visual structure of the RichEditor component.
 */

export function RichEditorSkeleton(): JSX.Element {
  return (
    <div className="rte-content text-light">
      {/* Toolbar skeleton */}
      <div className="skeleton" style={{ height: 40, marginBottom: 12, borderRadius: 8 }} />
      
      {/* Editor content skeleton */}
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8 }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8 }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8 }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8, width: "85%" }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8, width: "70%" }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8, width: "60%" }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8 }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8, width: "90%" }} />
      <div className="skeleton skeleton-text" style={{ height: 20, marginBottom: 8, width: "75%" }} />
    </div>
  );
}
