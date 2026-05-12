/**
 * Memoized search input component for proposal filtering
 * Prevents unnecessary parent re-renders during typing
 */

import React, { memo } from "react";

interface ProposalSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function ProposalSearchComponent({
  value,
  onChange,
  placeholder = "Search by title or client...",
  className = "form-input search-input",
}: ProposalSearchProps): JSX.Element {
  return (
    <input
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export const ProposalSearch = memo(ProposalSearchComponent);
