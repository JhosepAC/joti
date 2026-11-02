"use client";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GalleryImage } from "../hooks/use-gallery";
export function GalleryMasonry({
  images,
  render,
  size,
  density,
  info,
}: {
  images: GalleryImage[];
  render: (image: GalleryImage) => ReactNode;
  size: string;
  density: string;
  info: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [layout, setLayout] = useState({ columns: 2, width: 220 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const css = getComputedStyle(element),
        width = element.clientWidth,
        gap = parseFloat(css.getPropertyValue("--gallery-gap")) || 16,
        tile = parseFloat(css.getPropertyValue("--gallery-tile")) || 220,
        columns = Math.max(1, Math.floor((width + gap) / (tile + gap)));
      setLayout({ columns, width: (width - gap * (columns - 1)) / columns });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [size, density]);
  const columns = useMemo(() => {
    const result = Array.from({ length: layout.columns }, () => ({
      images: [] as GalleryImage[],
      height: 0,
    }));
    for (const image of images) {
      const col = result.reduce((a, b) => (a.height <= b.height ? a : b));
      col.images.push(image);
      col.height +=
        (layout.width * image.height) / Math.max(1, image.width) +
        (info ? 50 : 0) +
        16;
    }
    return result;
  }, [images, layout, info]);
  return (
    <div
      className="gallery-masonry"
      ref={ref}
      style={{ gridTemplateColumns: `repeat(${layout.columns},minmax(0,1fr))` }}
    >
      {columns.map((c, n) => (
        <div className="gallery-masonry-column" key={n}>
          {c.images.map(render)}
        </div>
      ))}
    </div>
  );
}
