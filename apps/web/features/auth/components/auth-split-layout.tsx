import * as React from "react";
import { DitherVisual } from "./dither-visual";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils";

export interface AuthSplitLayoutProps {
  children: React.ReactNode;
  visualComponent?: React.ReactNode;
  className?: string;
}

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  children,
  visualComponent = <DitherVisual />,
  className,
}) => {
  return (
    <main
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 w-full min-h-screen bg-background overflow-x-hidden",
        className
      )}
    >
      {/* Panel Izquierdo: Formulario */}
      <section className="flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-20 py-10 w-full min-h-screen">
        {children}
        <div className="pt-8">
          <LanguageSwitcher />
        </div>
      </section>

      {/* Panel Derecho: Fondo Dither con Animación Shader Interactiva */}
      <section className="hidden md:block w-full h-full min-h-screen sticky top-0 overflow-hidden bg-background">
        {visualComponent}
      </section>
    </main>
  );
};
