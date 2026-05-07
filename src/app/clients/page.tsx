"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Users, Plus, Building2, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { listClients, deleteClient, type Client } from "@/api/clientApi";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const NewClientModal = dynamic(() => import("@/components/modals/NewClientModal"), {
  ssr: false,
});

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal"), {
  ssr: false,
});

export default function ClientsPage(): JSX.Element {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [newClientData, setNewClientData] = useState<{
    client: { id: number; name: string };
    notes: string;
    uploadedFiles: File[];
  } | null>(null);
  const [enableTemplateSelection, setEnableTemplateSelection] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients(silent = false): Promise<void> {
    try {
      if (!silent) setLoading(true);
      const loadedClients = await listClients();
      setClients(loadedClients);
    } catch (error) {
      console.error("Failed to load clients:", error);
      toast.error("Failed to load clients");
      if (!silent) setClients([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function handleClientClick(clientId: number): void {
    router.push(`/clients/${clientId}`);
  }

  function handleNewClient(): void {
    setShowNewClientModal(true);
  }

  function handleClientCreated(client: { id: number; name: string }, notes: string, uploadedFiles: File[]): void {
    loadClients(true); // Silent refresh — keeps existing list visible while updating
    setNewClientData({ client, notes, uploadedFiles });
    setEnableTemplateSelection(true);
    setShowNewClientModal(false);
    setShowTemplateModal(true);
  }

  function handleCloseTemplateModal(): void {
    setShowTemplateModal(false);
    setNewClientData(null);
    setEnableTemplateSelection(false);
  }

  async function handleDeleteClient(clientId: number, e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      await deleteClient(clientId);
      toast.success("Client deleted");
      setClients((prev) => prev.filter((c) => c.id !== clientId));
    } catch (error) {
      console.error("Failed to delete client:", error);
      toast.error("Failed to delete client");
    }
  }

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <div className={styles.header}>
          <div>
            <h1 className="page-title">Clients</h1>
            <p className="page-subtitle">
              Manage your client relationships and view all proposals associated with each client.
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleNewClient}>
            <Plus size={18} />
            New Client
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Users size={48} />
            </div>
            <div className={styles.emptyTitle}>No clients yet</div>
            <div className={styles.emptyDesc}>
              Create your first client to start organizing proposals and managing relationships.
            </div>
            <button className="btn btn-primary" onClick={handleNewClient}>
              <Plus size={18} />
              Create First Client
            </button>
          </div>
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
                    <button
                      className={styles.deleteClientBtn}
                      onClick={(e) => handleDeleteClient(client.id, e)}
                      title="Delete client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className={styles.clientCardBody}>
                  <h3 className={styles.clientCardName}>{client.name}</h3>
                  <p className={styles.clientCardIndustry}>{client.industry}</p>
                  
                  <div className={styles.clientCardMeta}>
                    <div className={styles.clientCardMetaItem}>
                      <Calendar size={14} />
                      <span>Created {new Date(client.created_at).toLocaleDateString()}</span>
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

        {showNewClientModal && (
          <NewClientModal
            onClose={() => setShowNewClientModal(false)}
            onClientCreated={handleClientCreated}
            existingClients={clients.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}

        {showTemplateModal && newClientData && (
          <TemplateSelectionModal
            templateId={null}
            templateName=""
            onClose={handleCloseTemplateModal}
            onNewClient={() => {}}
            initialClients={clients.map((c) => ({ ...c, documents: [] }))}
            newClientData={newClientData}
            enableTemplateSelection={enableTemplateSelection}
          />
        )}
      </main>
    </div>
  );
}
