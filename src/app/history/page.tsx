"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Download, Eye } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";
import { getDownloadUrl, listProposals } from "@/api/proposalApi";
import type { ProposalListItem } from "@/types/proposal.types";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

export default function HistoryPage(): JSX.Element {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory(): Promise<void> {
    try {
      setLoading(true);
      const proposals = await listProposals();
      const history = proposals.filter(
        (p) => p.approvalStatus === "approved" || p.approvalStatus === "rejected"
      );
      setHistoryItems(history);
    } catch (error) {
      console.error("Failed to load history:", error);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string): { label: string; className: string } {
    switch (status) {
      case "approved":
        return { label: "Approved", className: "badge-success" };
      case "rejected":
        return { label: "Rejected", className: "badge-danger" };
      case "pending_approval":
        return { label: "Pending Approval", className: "badge-warning" };
      default:
        return { label: "Draft", className: "badge-muted" };
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <h1 className="page-title">History</h1>
        <p className="page-subtitle">
          View all completed, approved, and rejected proposals.
        </p>

        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Loading history...</div>
          </div>
        ) : historyItems.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <History size={48} />
            </div>
            <div className={styles.emptyTitle}>No History Yet</div>
            <div className={styles.emptyDesc}>
              Approved and rejected proposals will appear here.
            </div>
          </div>
        ) : (
          <div className={styles.historyGrid}>
            {historyItems.map((item) => {
              const statusInfo = getStatusBadge(item.approvalStatus);
              return (
                <div key={item.id} className={styles.historyCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{item.title}</div>
                    <span className={`badge ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className={styles.cardClient}>
                    <span className={styles.clientLabel}>Client:</span>
                    <span className={styles.clientName}>{item.clientName}</span>
                  </div>
                  <div className={styles.cardDate}>
                    {formatDate(item.createdAt)}
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push(`/proposal/${item.id}`)}
                    >
                      <Eye size={14} /> View
                    </button>
                    <a
                      href={getDownloadUrl(item.id)}
                      className="btn btn-secondary btn-sm"
                      download
                      onClick={() => toast.success("Downloading proposal...")}
                    >
                      <Download size={14} /> Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
