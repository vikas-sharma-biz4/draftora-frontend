"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Users, Plus, Building2, Calendar } from "lucide-react";

import styles from "./page.module.scss";

import type { Client } from "@/types/client.types";
import { CLIENTS_STORAGE_KEY } from "@/constants";
import { initializeSampleClients } from "@/utils/sampleData";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const NewClientModal = dynamic(() => import("@/components/modals/NewClientModal"), {
  ssr: false,
});

export default function ClientsPage(): JSX.Element {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);

  useEffect(() => {
    initializeSampleClients();
    loadClients();
  }, []);

  function loadClients(): void {
    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      const loadedClients = raw ? (JSON.parse(raw) as Client[]) : [];
      setClients(loadedClients);
    } catch {
      setClients([]);
    }
  }

  function handleClientClick(clientId: string): void {
    router.push(`/clients/${clientId}`);
  }

  function handleNewClient(): void {
    setShowNewClientModal(true);
  }

  function handleClientCreated(): void {
    loadClients();
    setShowNewClientModal(false);
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

        {clients.length === 0 ? (
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
                  <span className={`${styles.clientCardStatus} ${client.status === "active" ? styles.statusActive : styles.statusInactive}`}>
                    {client.status}
                  </span>
                </div>

                <div className={styles.clientCardBody}>
                  <h3 className={styles.clientCardName}>{client.name}</h3>
                  <p className={styles.clientCardIndustry}>{client.industry}</p>
                  
                  <div className={styles.clientCardMeta}>
                    <div className={styles.clientCardMetaItem}>
                      <Calendar size={14} />
                      <span>Onboarded {client.onboardedDate}</span>
                    </div>
                    <div className={styles.clientCardMetaItem}>
                      <span>{client.documents.length} documents</span>
                    </div>
                    <div className={styles.clientCardMetaItem}>
                      <span>{client.proposals.length} proposals</span>
                    </div>
                  </div>
                </div>

                <div className={styles.clientCardFooter}>
                  <span className={styles.clientCardTier}>{client.tier}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {showNewClientModal && (
          <NewClientModal
            onClose={() => setShowNewClientModal(false)}
            onClientCreated={handleClientCreated}
          />
        )}
      </main>
    </div>
  );
}
