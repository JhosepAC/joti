import * as React from "react";
import { cn } from "@/lib/utils";

export interface HalftoneArtProps extends React.HTMLAttributes<HTMLDivElement> {}

export const HalftoneArt: React.FC<HalftoneArtProps> = ({
  className,
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
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 500 700"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="dotPattern"
            x="0"
            y="0"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="7" cy="7" r="4.5" fill="#0F172A" />
          </pattern>
          <mask id="artMask">
            <rect width="500" height="700" fill="white" />
            <path
              d="M 180 0 C 300 150, 100 300, 380 450 C 500 520, 250 700, 500 700 L 500 0 Z"
              fill="black"
            />
            <circle cx="340" cy="280" r="110" fill="black" />
          </mask>
        </defs>
        <rect
          width="500"
          height="700"
          fill="url(#dotPattern)"
          mask="url(#artMask)"
        />
      </svg>
    </div>
  );
};
