"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Users, Plus, Building2, Calendar, Trash2 } from "lucide-react";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";
import SearchBar from "@/components/common/SearchBar/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";

import styles from "./ClientsPage.module.scss";

import { useClients } from "@/hooks/useClients";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import ClientCardSkeleton from "@/components/common/Skeletons/ClientCardSkeleton";

const TemplateSelectionModal = dynamic(
  () => import("@/components/modals/TemplateSelectionModal/TemplateSelectionModal"),
  {
    ssr: false,
  }
);

const DeleteClientModal = dynamic(() => import("@/components/modals/DeleteClientModal"), {
  ssr: false,
});

export default function ClientsPage(): JSX.Element {
  const router = useRouter();
  const { clients, isLoading: loading, error, refetch } = useClients();
  const deleteClientFromStore = useClientStore((state) => state.deleteClient);

  useErrorToast(error, "Failed to load clients");

  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [deleteModalData, setDeleteModalData] = useState<{ id: number; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredClients = useMemo(() => {
    if (!debouncedSearch) return clients;
    const q = debouncedSearch.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q)
    );
  }, [clients, debouncedSearch]);

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
        subtitle={`Manage your client relationships and view all proposals associated with each client.${clients.length > 0 ? ` (${clients.length} total)` : ""}`}
        action={
          <Button variant="primary" onClick={handleNewClient}>
            <Plus size={18} />
            New Client
          </Button>
        }
      />

      {loading ? (
        <SkeletonGrid className={styles.clientsGrid} renderItem={() => <ClientCardSkeleton />} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="No clients yet"
          subtitle="Create your first client to start organizing proposals and managing relationships."
          ctaLabel="Create First Client"
          onCtaClick={handleNewClient}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name or industry..."
              className={styles.searchBar}
            />
          </div>

          {filteredClients.length === 0 ? (
            <EmptyState
              icon={<Users size={48} />}
              title="No matching clients"
              subtitle="Try adjusting your search."
            />
          ) : (
            <div className={styles.clientsGrid}>
              {filteredClients.map((client) => (
                <article
                  key={client.id}
                  className={styles.clientCard}
                  data-testid="client-card"
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
        </>
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
