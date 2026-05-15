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

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal"), {
  ssr: false,
});

const DeleteClientModal = dynamic(() => import("@/components/modals/DeleteClientModal"), {
  ssr: false,
});

export default function ClientsPage(): JSX.Element {
  const router = useRouter();
  const { clients, isLoading: loading, refetch } = useClients({ autoFetch: true });
  const deleteClientFromStore = useClientStore(state => state.deleteClient);

  // Ensure clients is always an array to prevent map errors
  const clientsArray = Array.isArray(clients) ? clients : [];
  const safeClientsArray = clientsArray ?? [];

  // Guard against CSS module import returning null in some environments
  const stylesObj = styles || {};

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

        {loading ? (
          <SkeletonGrid
            className={stylesObj.clientsGrid}
            renderItem={() => <ClientCardSkeleton />}
          />
        ) : safeClientsArray.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="No clients yet"
            subtitle="Create your first client to start organizing proposals and managing relationships."
            ctaLabel="Create First Client"
            onCtaClick={handleNewClient}
          />
        ) : (
          <div className={stylesObj.clientsGrid}>
            {safeClientsArray.filter(Boolean).map((client) => (
              <article
                key={client.id}
                className={stylesObj.clientCard}
                onClick={() => handleClientClick(client.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleClientClick(client.id);
                }}
              >
                <div className={stylesObj.clientCardHeader}>
                  <div className={stylesObj.clientCardIcon}>
                    <Building2 size={24} />
                  </div>
                  <div className={stylesObj.clientCardActions}>
                    <span className={`${stylesObj.clientCardStatus} ${client.status === "active" ? stylesObj.statusActive : stylesObj.statusInactive}`}>
                      {client.status}
                    </span>
                    <Button
                      variant="ghost"
                      iconOnly
                      onClick={(e) => handleDeleteClient(client.id, client.name, e)}
                      title="Delete client"
                      aria-label="Delete client"
                      className={stylesObj.deleteClientBtn}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div className={stylesObj.clientCardBody}>
                  <h3 className={stylesObj.clientCardName}>{client.name}</h3>
                  <p className={stylesObj.clientCardIndustry}>{client.industry}</p>
                  <div className={stylesObj.clientCardMeta}>
                    <span className={stylesObj.clientCardMetaItem}>
                      <Calendar size={12} />
                      {formatDate(client.createdAt)}
                    </span>
                    {client.documents && client.documents.length > 0 && (
                      <span className={stylesObj.clientCardMetaItem}>
                        <Building2 size={12} />
                        {client.documents.length} document{client.documents.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>

                <div className={stylesObj.clientCardFooter}>
                  <span className={stylesObj.clientCardTier}>{client.industry}</span>
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
