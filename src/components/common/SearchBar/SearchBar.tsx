"use client";

import { memo } from "react";
import { Search, X } from "lucide-react";
import styles from "./SearchBar.module.scss";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function SearchBarComponent({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchBarProps): JSX.Element {
  return (
    <div className={`${styles.searchBar} ${className ?? ""}`}>
      <Search size={14} className={styles.searchIcon} />
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
      {value && (
        <button
          className={styles.clearBtn}
          onClick={() => onChange("")}
          aria-label="Clear search"
          type="button"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export const SearchBar = memo(SearchBarComponent);
export default SearchBar;
