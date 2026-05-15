"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Users, Plus, Building2, Calendar, Trash2 } from "lucide-react";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";

import styles from "./ClientsPage.module.scss";

import { useClients } from "@/hooks/useClients";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import ClientCardSkeleton from "@/components/common/skeletons/ClientCardSkeleton";

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal/TemplateSelectionModal"), {
  ssr: false,
});

const DeleteClientModal = dynamic(() => import("@/components/modals/DeleteClientModal"), {
  ssr: false,
});

export default function ClientsPage(): JSX.Element {
  const router = useRouter();
  const { clients, isLoading: loading, refetch } = useClients();
  const deleteClientFromStore = useClientStore(state => state.deleteClient);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [deleteModalData, setDeleteModalData] = useState<{ id: number; name: string } | null>(null);

  function handleClientClick(clientId: number): void {
    router.push(`/clients/${clientId}`);
  }

  function handleNewClient(): void {
    setShowTemplateModal(true);
  }

  function handleCloseTemplateModal(): void {
    setShowTemplateModal(false);
  }

  function handleDeleteClient(clientId: number, clientName: string, e: React.MouseEvent): void {
    e.stopPropagation();
    setDeleteModalData({ id: clientId, name: clientName });
  }

  async function confirmDeleteClient(): Promise<void> {
    if (!deleteModalData) return;

    try {
      await deleteClientFromStore(deleteModalData.id);
      toast.success("Client deleted");
      setDeleteModalData(null);
    } catch (error) {
      logger.error("Failed to delete client:", error);
      toast.error("Failed to delete client");
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Clients"
        subtitle="Manage your client relationships and view all proposals associated with each client."
        action={
          <Button variant="primary" onClick={handleNewClient}>
            <Plus size={18} />
            New Client
          </Button>
        }
      />

      {!mounted ? (
        <SkeletonGrid
          className={styles.clientsGrid}
          renderItem={() => <ClientCardSkeleton />}
        />
      ) : loading ? (
        <SkeletonGrid
          className={styles.clientsGrid}
          renderItem={() => <ClientCardSkeleton />}
        />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="No clients yet"
          subtitle="Create your first client to start organizing proposals and managing relationships."
          ctaLabel="Create First Client"
          onCtaClick={handleNewClient}
        />
      ) : (
        <div className={styles.clientsGrid}>
          {clients.map((client) => (
            <article
              key={client.id}
              className={styles.clientCard}
              onClick={() => handleClientClick(client.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleClientClick(client.id);
              }}
            >
              <div className={styles.clientCardHeader}>
                <div className={styles.clientCardIcon}>
                  <Building2 size={24} />
                </div>
                <div className={styles.clientCardActions}>
                  <span className={`${styles.clientCardStatus} ${client.status === "active" ? styles.statusActive : styles.statusInactive}`}>
                    {client.status}
                  </span>
                  <Button
                    variant="ghost"
                    iconOnly
                    onClick={(e) => handleDeleteClient(client.id, client.name, e)}
                    title="Delete client"
                    aria-label="Delete client"
                    className={styles.deleteClientBtn}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className={styles.clientCardBody}>
                <h3 className={styles.clientCardName}>{client.name}</h3>
                <p className={styles.clientCardIndustry}>{client.industry}</p>

                <div className={styles.clientCardMeta}>
                  <div className={styles.clientCardMetaItem}>
                    <Calendar size={14} />
                    <span>Created {formatDate(client.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className={styles.clientCardFooter}>
                <span className={styles.clientCardTier}>Active Client</span>
              </div>
            </article>
          ))}
        </div>
      )}

        {showTemplateModal && (
          <TemplateSelectionModal
            templateId={null}
            templateName=""
            onClose={handleCloseTemplateModal}
            initialClients={clients}
            initialView="new_client"
          />
        )}

        {deleteModalData && (
          <DeleteClientModal
            clientName={deleteModalData.name}
            onClose={() => setDeleteModalData(null)}
            onConfirm={confirmDeleteClient}
          />
        )}
    </PageLayout>
  );
}
