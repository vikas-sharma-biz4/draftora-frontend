"use client";

import React from "react";
import { Plus } from "lucide-react";

import Button from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import styles from "./TemplateSelectionModal.module.scss";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";

interface ClientSearchDropdownProps {
  /** Clients visible in the dropdown (already filtered by search query) */
  filteredClients: ClientWithDocuments[];
  /** Full client list — used to detect the "no clients" empty state */
  allClients: ClientWithDocuments[];
  loading: boolean;
  selectedClientId: number | null;
  clientSearchQuery: string;
  showDropdown: boolean;
  highlightedIndex: number;
  onSearchChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClientSelect: (clientId: number, clientName: string) => void;
  onNewClient: () => void;
  hideNewClient?: boolean;
}

export default function ClientSearchDropdown({
  filteredClients,
  allClients,
  loading,
  selectedClientId,
  clientSearchQuery,
  showDropdown,
  highlightedIndex,
  onSearchChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClientSelect,
  onNewClient,
  hideNewClient = false,
}: ClientSearchDropdownProps): JSX.Element {
  return (
    <div className={styles.section}>
      <label className={styles.label}>Client Name</label>

      {loading ? (
        <div className={styles.noClients}>
          <p>Loading clients...</p>
        </div>
      ) : allClients.length === 0 ? (
        <div className={styles.noClients}>
          <p>No clients found. Create your first client to continue.</p>
          {!hideNewClient && (
            <Button variant="primary" size="sm" onClick={onNewClient}>
              <Plus size={16} />
              New Client
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.searchWrapper}>
          <div className={styles.searchInputWrapper}>
            <Input
              type="text"
              placeholder="Search for a client..."
              value={clientSearchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              className={styles.searchInput}
              aria-label="Search clients"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              role="combobox"
            />
            {!hideNewClient && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onNewClient}
                className={styles.newClientBtn}
              >
                <Plus size={16} />
                New Client
              </Button>
            )}
          </div>

          {showDropdown && filteredClients.length > 0 && (
            <ul className={styles.clientDropdown} role="listbox" aria-label="Matching clients">
              {filteredClients.map((client, index) => (
                <li key={client.id} role="option" aria-selected={selectedClientId === client.id}>
                  <button
                    type="button"
                    className={`${styles.clientOption} ${selectedClientId === client.id ? styles.selected : ""} ${index === highlightedIndex ? styles.highlighted : ""}`}
                    onPointerDown={(e) => {
                      // Prevent the search input blur from firing before the click registers
                      e.preventDefault();
                      onClientSelect(client.id, client.name);
                    }}
                  >
                    <div className={styles.clientOptionMain}>
                      <span className={styles.clientOptionName}>{client.name}</span>
                      <span className={styles.clientOptionIndustry}>{client.industry}</span>
                    </div>
                    <div className={styles.clientOptionMeta}>
                      {client.documents?.length || 0} docs
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showDropdown && filteredClients.length === 0 && clientSearchQuery.trim() && (
            <div className={styles.clientDropdown}>
              <div className={styles.noResults}>
                No clients found matching &ldquo;{clientSearchQuery}&rdquo;
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
