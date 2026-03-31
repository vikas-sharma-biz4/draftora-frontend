/**
 * Loading skeleton placeholder for the proposal output page.
 * Displays 3 faux section blocks while content is being fetched.
 */
export default function ProposalSkeleton(): JSX.Element {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="proposal-page">
          <div className="proposal-page-header">
            <div className="skeleton" style={{ height: 20, width: "35%" }} />
          </div>
          <div className="skeleton-page-body">
            <div className="skeleton skeleton-text" style={{ width: "90%" }} />
            <div className="skeleton skeleton-text" style={{ width: "80%" }} />
            <div className="skeleton skeleton-text" style={{ width: "85%" }} />
            <div className="skeleton skeleton-text" style={{ width: "70%" }} />
          </div>
        </div>
      ))}
    </>
  );
}
