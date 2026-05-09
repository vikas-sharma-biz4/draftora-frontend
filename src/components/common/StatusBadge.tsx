import { Loader2, CheckCircle, XCircle, FileEdit, Clock } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  // Generation statuses
  generating: {
    label: "Generating...",
    className: "badge badge-warning",
    icon: <Loader2 size={11} className="spin-icon" />,
  },
  completed: {
    label: "Complete",
    className: "badge badge-success",
    icon: <CheckCircle size={11} />,
  },
  failed: {
    label: "Failed",
    className: "badge badge-danger",
    icon: <XCircle size={11} />,
  },
  draft: {
    label: "Draft",
    className: "badge badge-muted",
    icon: <FileEdit size={11} />,
  },
  // Approval statuses
  approved: {
    label: "Approved",
    className: "badge badge-success",
    icon: <CheckCircle size={11} />,
  },
  rejected: {
    label: "Rejected",
    className: "badge badge-danger",
    icon: <XCircle size={11} />,
  },
  pending_approval: {
    label: "Pending Approval",
    className: "badge badge-warning",
    icon: <Clock size={11} />,
  },
};

export default function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["draft"];
  return (
    <span className={config.className} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {config.icon}
      {config.label}
    </span>
  );
}
