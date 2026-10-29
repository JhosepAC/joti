"use client";
import { useTranslations } from "next-intl";
import { Modal } from "./overlays";
export function DeleteDialog({
  name,
  isList = false,
  onClose,
  onDelete,
}: {
  name: string;
  isList?: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("lists");
  return (
    <Modal label={t(isList ? "deleteList" : "deleteRow")} onClose={onClose}>
      <header className="lists-modal-heading">
        <h2>{t(isList ? "deleteList" : "deleteRow")}</h2>
      </header>
      <p>{t(isList ? "deleteListWarning" : "deleteRowWarning", { name })}</p>
      <footer className="lists-modal-actions">
        <button autoFocus className="lists-secondary" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          className="lists-primary lists-delete-confirm"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          {t("deletePermanently")}
        </button>
      </footer>
    </Modal>
  );
}
