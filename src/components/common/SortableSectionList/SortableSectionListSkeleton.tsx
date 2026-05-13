/**
 * SortableSectionListSkeleton — production-grade loading state for SortableSectionList
 *
 * Preserves approximate layout dimensions to prevent CLS during lazy loading.
 * Matches the visual structure of the SortableSectionList component with drag handles.
 */

export function SortableSectionListSkeleton(): JSX.Element {
  return (
    <div className="sections-ai-loading">
      {/* Simulate 5-6 section items with drag handles */}
      {[1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="skeleton-section-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            marginBottom: 8,
            borderRadius: 8,
          }}
        >
          {/* Drag handle skeleton */}
          <div
            className="skeleton"
            style={{ width: 20, height: 20, borderRadius: 4 }}
          />
          
          {/* Section label skeleton */}
          <div
            className="skeleton skeleton-text"
            style={{ flex: 1, height: 20 }}
          />
          
          {/* Action button skeleton */}
          <div
            className="skeleton"
            style={{ width: 32, height: 32, borderRadius: 6 }}
          />
        </div>
      ))}
    </div>
  );
}
