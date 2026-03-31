import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

import StatusBadge from "./StatusBadge";
import { getDownloadUrl } from "@/api/proposalApi";
import type { ProposalListItem } from "@/types/proposal.types";
import styles from "./ProposalCard.module.scss";

interface ProposalCardProps {
  proposal: ProposalListItem;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProposalCard({ proposal }: ProposalCardProps): JSX.Element {
  function handleDownload(e: React.MouseEvent): void {
    e.preventDefault();
    toast.info("Downloading proposal...");
    window.open(getDownloadUrl(proposal.id), "_blank");
  }

  return (
    <div className={styles.card}>
      <div className={styles.iconWrap}>
        <FileText size={22} color="var(--color-primary)" />
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{proposal.title}</h3>
        <p className={styles.client}>{proposal.clientName}</p>
        <p className={styles.date}>{formatDate(proposal.createdAt)}</p>
      </div>

      <div className={styles.footer}>
        <StatusBadge status={proposal.status} />
        <div className={styles.actions}>
          <Link href={`/proposal/${proposal.id}`} className="btn btn-primary btn-sm">
            View
          </Link>
          {proposal.status === "completed" && (
            <button className="btn btn-secondary btn-sm icon-only" onClick={handleDownload} title="Download DOCX">
              <Download size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
