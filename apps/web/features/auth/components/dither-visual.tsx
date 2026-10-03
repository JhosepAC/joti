"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dither = dynamic(() => import("@/components/ui/dither"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  ),
});

export interface DitherVisualProps
  extends React.HTMLAttributes<HTMLDivElement> {
  waveColor?: [number, number, number];
  backgroundColor?: [number, number, number];
  waveAmplitude?: number;
  waveFrequency?: number;
  waveSpeed?: number;
  colorNum?: number;
  pixelSize?: number;
  mouseRadius?: number;
}

export const DitherVisual: React.FC<DitherVisualProps> = ({
  className,
  waveColor = [0.06, 0.09, 0.16], // #0F172A
  backgroundColor = [1, 1, 1],    // #FFFFFF (Light Theme)
  waveAmplitude = 0.26,
  waveFrequency = 3,
  waveSpeed = 0.08,
  colorNum = 4,
  pixelSize = 2,
  mouseRadius = 0.15,
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative w-full h-full min-h-screen bg-background overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 w-full h-full">
        <Dither
          waveColor={waveColor}
          backgroundColor={backgroundColor}
          disableAnimation={false}
          enableMouseInteraction
          mouseRadius={mouseRadius}
          colorNum={colorNum}
          waveAmplitude={waveAmplitude}
          waveFrequency={waveFrequency}
          waveSpeed={waveSpeed}
          pixelSize={pixelSize}
        />
      </div>
    </div>
  );
};
