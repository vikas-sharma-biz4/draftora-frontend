"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Download, Eye } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";
import { HISTORY_STORAGE_KEY } from "@/constants";
import { getDownloadUrl } from "@/api/proposalApi";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

interface HistoryItem {
  id: string;
  proposalId: number;
  title: string;
  clientName: string;
  status: "approved" | "rejected" | "pending_approval";
  createdAt: string;
  updatedAt: string;
  data: any;
}

export default function HistoryPage(): JSX.Element {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    setHistoryItems(history);
  }, []);

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

        {historyItems.length === 0 ? (
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
              const statusInfo = getStatusBadge(item.status);
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
                      onClick={() => router.push(`/proposal/${item.proposalId}`)}
                    >
                      <Eye size={14} /> View
                    </button>
                    <a
                      href={getDownloadUrl(item.proposalId)}
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
