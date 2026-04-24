"use client";

import { FileText, Layers, Box, ArrowRight } from "lucide-react";

interface FollowUpDocumentSelectorProps {
  onSelectDocument: (documentType: "brd" | "frd" | "architecture") => void;
}

interface DocumentOption {
  key: "brd" | "frd" | "architecture";
  title: string;
  description: string;
  icon: typeof FileText;
  color: string;
}

export default function FollowUpDocumentSelector({
  onSelectDocument,
}: FollowUpDocumentSelectorProps): JSX.Element {
  const documentOptions: DocumentOption[] = [
    {
      key: "brd",
      title: "Business Requirements Document",
      description: "Define business objectives, stakeholder requirements, and scope for the project.",
      icon: FileText,
      color: "bg-blue-100 text-blue-600",
    },
    {
      key: "frd",
      title: "Functional Requirements Document",
      description: "Detail functional requirements, system modules, and technical specifications.",
      icon: Layers,
      color: "bg-purple-100 text-purple-600",
    },
    {
      key: "architecture",
      title: "Architecture Document",
      description: "Design system architecture, data flows, and technical infrastructure.",
      icon: Box,
      color: "bg-green-100 text-green-600",
    },
  ];

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Generate Follow-up Document</h3>
      <p className="text-gray-600 mb-6">Select the document type you want to generate from this proposal.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {documentOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              onClick={() => onSelectDocument(option.key)}
              className="group relative bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all p-6 text-left"
            >
              <div className={`p-3 rounded-lg ${option.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={28} />
              </div>
              <h4 className="font-semibold text-base mb-2">{option.title}</h4>
              <p className="text-sm text-gray-600 mb-4">{option.description}</p>
              <div className="flex items-center text-sm text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
                Generate
                <ArrowRight size={16} className="ml-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
