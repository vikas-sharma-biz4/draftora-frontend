interface CardProps {
  /** Adds hover lift interaction styling */
  interactive?: boolean;
  /** Compact padding variant */
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface CardSectionProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Card primitive with compound Header / Body / Footer sub-components.
 *
 * Uses the global `.card` CSS system. Sub-components are optional — use them
 * only when the card has a distinct header or footer section.
 *
 * @example
 * <Card interactive>
 *   <Card.Header>
 *     <h3 className="card-title">Proposal Name</h3>
 *   </Card.Header>
 *   <Card.Body>Content here</Card.Body>
 *   <Card.Footer>
 *     <Button size="sm">Open</Button>
 *   </Card.Footer>
 * </Card>
 */
function Card({ interactive = false, compact = false, className, children }: CardProps): JSX.Element {
  const classes = [
    "card",
    interactive ? "card-interactive" : "",
    compact ? "card-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}

function CardHeader({ className, children }: CardSectionProps): JSX.Element {
  return (
    <div className={["card-header", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function CardBody({ className, children }: CardSectionProps): JSX.Element {
  return (
    <div className={["card-body", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function CardFooter({ className, children }: CardSectionProps): JSX.Element {
  return (
    <div className={["card-footer", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body   = CardBody;
Card.Footer = CardFooter;

export default Card;
