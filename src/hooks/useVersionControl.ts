import { useState, useCallback, useEffect } from "react";
import {
  getVersionHistory,
  getVersion,
  updateVersionDecision,
  regenerateFromVersion,
  saveEditedVersion,
} from "@/services/versionApi";
import type {
  ProposalVersion,
  VersionHistory,
  VersionDecision,
  RegenerateFromVersionPayload,
} from "@/interfaces/versionInterfaces";

interface UseVersionControlOptions {
  proposalId: number | null;
  autoLoadHistory?: boolean;
  onVersionChange?: (version: ProposalVersion) => void;
  onDecisionUpdate?: (versionId: string, decision: VersionDecision) => void;
  onError?: (error: Error) => void;
}

export function useVersionControl(options: UseVersionControlOptions): {
  versionHistory: VersionHistory | null;
  currentVersion: ProposalVersion | null;
  selectedVersion: ProposalVersion | null;
  isLoading: boolean;
  error: Error | null;
  loadHistory: () => Promise<void>;
  selectVersion: (versionNumber: number) => Promise<void>;
  acceptVersion: (versionId: string) => Promise<void>;
  rejectVersion: (versionId: string) => Promise<void>;
  regenerateVersion: (
    versionId: string,
    modifications: RegenerateFromVersionPayload["modifications"]
  ) => Promise<{ proposalId: number; versionId: string }>;
  saveEdits: (
    versionId: string,
    editedContent: Record<string, string>
  ) => Promise<ProposalVersion>;
  isVersionAccepted: (versionNumber: number) => boolean;
  isVersionRejected: (versionNumber: number) => boolean;
} {
  const {
    proposalId,
    autoLoadHistory = true,
    onVersionChange,
    onDecisionUpdate,
    onError,
  } = options;

  const [versionHistory, setVersionHistory] = useState<VersionHistory | null>(
    null
  );
  const [currentVersion, setCurrentVersion] = useState<ProposalVersion | null>(
    null
  );
  const [selectedVersion, setSelectedVersion] =
    useState<ProposalVersion | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!proposalId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const history = await getVersionHistory(proposalId);
      setVersionHistory(history);

      const latest = history.versions.find(
        (v) => v.version === history.currentVersion
      );
      if (latest) {
        setCurrentVersion(latest);
        setSelectedVersion(latest);
        onVersionChange?.(latest);
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to load version history");
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, onVersionChange, onError]);

  const selectVersion = useCallback(
    async (versionNumber: number): Promise<void> => {
      if (!versionHistory) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const version = versionHistory.versions.find(
          (v) => v.version === versionNumber
        );

        if (!version) {
          throw new Error(`Version ${versionNumber} not found`);
        }

        const fullVersion = await getVersion(version.id);
        setSelectedVersion(fullVersion);
        onVersionChange?.(fullVersion);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to select version");
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [versionHistory, onVersionChange, onError]
  );

  const acceptVersion = useCallback(
    async (versionId: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const updatedVersion = await updateVersionDecision({
          versionId,
          decision: "accepted",
        });

        if (versionHistory) {
          const updatedVersions = versionHistory.versions.map((v) =>
            v.id === versionId ? updatedVersion : v
          );
          setVersionHistory({
            ...versionHistory,
            versions: updatedVersions,
            acceptedVersions: [
              ...versionHistory.acceptedVersions,
              updatedVersion.version,
            ],
          });
        }

        onDecisionUpdate?.(versionId, "accepted");
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to accept version");
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [versionHistory, onDecisionUpdate, onError]
  );

  const rejectVersion = useCallback(
    async (versionId: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const updatedVersion = await updateVersionDecision({
          versionId,
          decision: "rejected",
        });

        if (versionHistory) {
          const updatedVersions = versionHistory.versions.map((v) =>
            v.id === versionId ? updatedVersion : v
          );
          setVersionHistory({
            ...versionHistory,
            versions: updatedVersions,
            rejectedVersions: [
              ...versionHistory.rejectedVersions,
              updatedVersion.version,
            ],
          });
        }

        onDecisionUpdate?.(versionId, "rejected");
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to reject version");
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [versionHistory, onDecisionUpdate, onError]
  );

  const regenerateVersion = useCallback(
    async (
      versionId: string,
      modifications: RegenerateFromVersionPayload["modifications"]
    ): Promise<{ proposalId: number; versionId: string }> => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await regenerateFromVersion({ versionId, modifications });

        await loadHistory();

        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to regenerate version");
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [loadHistory, onError]
  );

  const saveEdits = useCallback(
    async (
      versionId: string,
      editedContent: Record<string, string>
    ): Promise<ProposalVersion> => {
      try {
        setIsLoading(true);
        setError(null);

        const newVersion = await saveEditedVersion(versionId, editedContent);

        await loadHistory();

        return newVersion;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to save edits");
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [loadHistory, onError]
  );

  const isVersionAccepted = useCallback(
    (versionNumber: number): boolean => {
      return versionHistory?.acceptedVersions.includes(versionNumber) ?? false;
    },
    [versionHistory]
  );

  const isVersionRejected = useCallback(
    (versionNumber: number): boolean => {
      return versionHistory?.rejectedVersions.includes(versionNumber) ?? false;
    },
    [versionHistory]
  );

  useEffect(() => {
    if (autoLoadHistory && proposalId) {
      loadHistory();
    }
  }, [autoLoadHistory, proposalId, loadHistory]);

  return {
    versionHistory,
    currentVersion,
    selectedVersion,
    isLoading,
    error,
    loadHistory,
    selectVersion,
    acceptVersion,
    rejectVersion,
    regenerateVersion,
    saveEdits,
    isVersionAccepted,
    isVersionRejected,
  };
}
