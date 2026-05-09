interface SkeletonGridProps {
  count?: number;
  className?: string;
  renderItem: (index: number) => React.ReactNode;
}

/**
 * Renders `count` skeleton placeholder items inside a grid wrapper.
 * Eliminates the repeated `[1,2,3,4,5,6].map(SkeletonX)` pattern.
 */
export default function SkeletonGrid({
  count = 6,
  className,
  renderItem,
}: SkeletonGridProps): JSX.Element {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderItem(i)}</div>
      ))}
    </div>
  );
}
