import { Loader2, CheckCircle, XCircle, FileEdit, Clock } from "lucide-react";
import Badge, { type BadgeVariant } from "@/components/common/Badge";

interface StatusBadgeProps {
  status: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: BadgeVariant; icon: React.ReactNode }
> = {
  // Generation statuses
  generating: {
    label: "Generating...",
    variant: "warning",
    icon: <Loader2 size={11} className="spin-icon" />,
  },
  completed: {
    label: "Complete",
    variant: "success",
    icon: <CheckCircle size={11} />,
  },
  failed: {
    label: "Failed",
    variant: "danger",
    icon: <XCircle size={11} />,
  },
  draft: {
    label: "Draft",
    variant: "muted",
    icon: <FileEdit size={11} />,
  },
  // Approval statuses
  approved: {
    label: "Approved",
    variant: "success",
    icon: <CheckCircle size={11} />,
  },
  rejected: {
    label: "Rejected",
    variant: "danger",
    icon: <XCircle size={11} />,
  },
  pending_approval: {
    label: "Pending Approval",
    variant: "warning",
    icon: <Clock size={11} />,
  },
};

export default function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["draft"];
  return (
    <Badge variant={config.variant}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
