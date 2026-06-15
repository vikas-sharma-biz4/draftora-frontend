"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Edit, FileText, Mail, Trash2 } from "lucide-react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

import styles from "./ClientDetailPage.module.scss";

import { useClientStore } from "@/store/features/clients/clientSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useClientProposals } from "@/hooks/useClientProposals";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import ClientDetailSkeleton from "@/components/common/skeletons/ClientDetailSkeleton";
import ClientDocumentsPanel from "./components/ClientDocumentsPanel";
import ClientProposalsList from "./components/ClientProposalsList";

const EditClientModal = dynamic(() => import("@/components/modals/EditClientModal"), {
  ssr: false,
});
const TemplateSelectionModal = dynamic(
  () => import("@/components/modals/TemplateSelectionModal/TemplateSelectionModal"),
  { ssr: false }
);
const DeleteClientModal = dynamic(() => import("@/components/modals/DeleteClientModal"), {
  ssr: false,
});
const DeleteDocumentModal = dynamic(() => import("@/components/modals/DeleteDocumentModal"), {
  ssr: false,
});
const DeleteAllDocumentsModal = dynamic(
  () => import("@/components/modals/DeleteAllDocumentsModal"),
  { ssr: false }
);
const GenerateEmailModal = dynamic(
  () => import("@/components/modals/GenerateEmailModal/GenerateEmailModal"),
  { ssr: false }
);
const GenerateInvoiceModal = dynamic(
  () => import("@/components/modals/GenerateInvoiceModal/GenerateInvoiceModal"),
  { ssr: false }
);

export default function ClientWorkspacePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const setCurrentDraftId = useDraftSessionStore((state) => state.setCurrentDraftId);

  const clientIdParam = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const clientId =
    typeof clientIdParam === "string" ? parseInt(clientIdParam, 10) : (clientIdParam as number);

  const client = useClientStore((state) => state.getClientById(clientId));
  const loading = useClientStore((state) => state.isLoading);
  const fetchClients = useClientStore((state) => state.fetchClients);
  const deleteClientFromStore = useClientStore((state) => state.deleteClient);
  const hasFetchedRef = useRef(false);

  const [mounted, setMounted] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [deleteClientModalOpen, setDeleteClientModalOpen] = useState<boolean>(false);
  const [showGenerateEmailModal, setShowGenerateEmailModal] = useState<boolean>(false);
  const [showGenerateInvoiceModal, setShowGenerateInvoiceModal] = useState<boolean>(false);

  const docs = useClientDocuments(client);
  const proposals = useClientProposals(clientId, client?.name ?? "");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!client && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNewProposal(): void {
    setCurrentDraftId(null);
    setShowTemplateModal(true);
  }

  async function confirmDeleteClient(): Promise<void> {
    if (!client) return;
    try {
      await deleteClientFromStore(client.id);
      toast.success("Client deleted");
      router.push("/clients");
    } catch (error) {
      logger.error("[ClientDetailPage] Failed to delete client:", error);
      toast.error("Failed to delete client");
    }
  }

  if (!mounted || loading) {
    return (
      <PageLayout>
        <ClientDetailSkeleton />
      </PageLayout>
    );
  }

  if (!client) {
    return (
      <PageLayout>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Client not found</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className={styles.clientHeader}>
        <div className={styles.clientHeaderLeft}>
          <div className={styles.clientBadge}>
            <span className={styles.clientBadgeLabel}>Client Workspace</span>
            <span className={styles.clientBadgeStatus}>Active</span>
          </div>
          <h1 className={styles.clientName}>{client.name}</h1>
          <p className={styles.clientMeta}>
            {client.industry} Active Created {formatDate(client.createdAt)}
          </p>
        </div>
        <div className={styles.clientHeaderActions}>
          <button className="btn btn-secondary" onClick={() => setShowGenerateEmailModal(true)}>
            <Mail size={18} />
            Generate Email
          </button>
          <button className="btn btn-secondary" onClick={() => setShowGenerateInvoiceModal(true)}>
            <FileText size={18} />
            Generate Invoice
          </button>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            <Edit size={18} />
            Edit Details
          </button>
          <button
            className={styles.deleteClientBtn}
            onClick={() => setDeleteClientModalOpen(true)}
            title="Delete client"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className={styles.splitLayout}>
        <ClientDocumentsPanel documents={client.documents} docs={docs} />
        <ClientProposalsList proposals={proposals} onNewProposal={handleNewProposal} />
      </div>

      {showEditModal && (
        <EditClientModal
          client={client}
          onClose={() => setShowEditModal(false)}
          onClientUpdated={() => setShowEditModal(false)}
        />
      )}

      {showTemplateModal && (
        <TemplateSelectionModal
          templateId={null}
          templateName=""
          onClose={() => setShowTemplateModal(false)}
          onNewClient={() => {}}
          initialClients={[client]}
          newClientData={{
            client: { id: client.id, name: client.name },
            notes: client.notes || "",
            uploadedFiles: [],
          }}
          enableTemplateSelection={true}
        />
      )}

      {deleteClientModalOpen && (
        <DeleteClientModal
          clientName={client.name}
          onClose={() => setDeleteClientModalOpen(false)}
          onConfirm={confirmDeleteClient}
        />
      )}

      {docs.deleteDocModalData && (
        <DeleteDocumentModal
          key={`delete-doc-${docs.deleteDocModalData.id}`}
          documentName={docs.deleteDocModalData.name}
          onClose={() => docs.setDeleteDocModalData(null)}
          onConfirm={docs.confirmDeleteDocument}
        />
      )}

      {docs.deleteAllDocsModalOpen && (
        <DeleteAllDocumentsModal
          documentCount={client.documents.length}
          onClose={() => docs.setDeleteAllDocsModalOpen(false)}
          onConfirm={docs.confirmDeleteAllDocuments}
        />
      )}

      {showGenerateEmailModal && (
        <GenerateEmailModal client={client} onClose={() => setShowGenerateEmailModal(false)} />
      )}

      {showGenerateInvoiceModal && (
        <GenerateInvoiceModal client={client} onClose={() => setShowGenerateInvoiceModal(false)} />
      )}
    </PageLayout>
  );
}
