"use client";

import Button from "@/components/common/Button";

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export default function BackButton({
  onClick,
  label = "Back",
  className = ""
}: BackButtonProps): JSX.Element {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      className={`back-button ${className}`}
    >
      {label}
    </Button>
  );
}
