import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { Dialog } from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  tone?: "default" | "danger";
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const {
    open,
    title,
    description,
    children,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    loadingLabel,
    tone = "default",
    isConfirming = false,
    onCancel,
    onConfirm,
  } = props;

  const confirmVariant = tone === "danger" ? "danger" : "primary";
  const confirmText = isConfirming && loadingLabel ? loadingLabel : confirmLabel;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
