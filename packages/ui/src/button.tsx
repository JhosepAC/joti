"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  className?: string;
  appName: string;
  /**
   * Translated alert text (e.g. from the app's dictionary). When omitted no
   * alert fires: shared UI must never hardcode user-facing copy.
   */
  alertMessage?: string;
}

export const Button = ({ children, className, appName, alertMessage }: ButtonProps) => {
  void appName;
  return (
    <button
      className={className}
      onClick={() => {
        if (alertMessage) alert(alertMessage);
      }}
    >
      {children}
    </button>
  );
};
