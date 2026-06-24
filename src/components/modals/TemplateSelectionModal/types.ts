import type { ParsedFileResult } from "@/services/upload.service";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";

export type ModalView = "template_selection" | "new_client";

export interface UploadedFile {
  file: File;
  id: string;
  status: "pending" | "parsing" | "parsed" | "error";
  error?: string;
  parsedData?: ParsedFileResult;
}

export interface TemplateSelectionModalProps {
  templateId?: string | null;
  templateName?: string;
  onClose: () => void;
  onNewClient?: () => void;
  initialClients?: ClientWithDocuments[];
  isScratch?: boolean;
  newClientData?: {
    client: { id: number; name: string };
    notes: string;
    uploadedFiles: File[];
  };
  enableTemplateSelection?: boolean;
  initialView?: ModalView;
  hideNewClient?: boolean;
}
