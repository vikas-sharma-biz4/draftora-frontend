"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "Confirm",
  message,
  onConfirm,
  onCancel,
}: ConfirmModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          maxWidth: "440px",
          width: "calc(100% - 32px)",
          padding: "28px 28px 24px",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "10px",
              marginTop: 0,
            }}
          >
            {title}
          </h3>
        )}
        <p
          style={{
            fontSize: "14px",
            color: "#4b5563",
            lineHeight: 1.6,
            marginBottom: "24px",
            marginTop: 0,
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              setIsConfirming(true);
              try {
                await onConfirm();
              } catch (error) {
                console.error("[ConfirmModal] Error in onConfirm:", error);
              } finally {
                setIsConfirming(false);
              }
            }}
            disabled={isConfirming}
          >
            {isConfirming ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
