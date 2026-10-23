import { useCallback, useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { imageFramingStyle, imageGeometry, type Framing, type ImageGeometry } from "../../lib/imageFraming";

/** The image stays whole; the containing slot is responsible for overflow clipping. */
export default function FramedImage({ framing, style, onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement> & { framing: Framing }) {
  const ref = useRef<HTMLImageElement>(null);
  const [geometry, setGeometry] = useState<ImageGeometry>();
  const measure = useCallback(() => {
    if (!ref.current) return;
    const next = imageGeometry(ref.current);
    setGeometry((previous) => previous && Object.keys(next).every((key) => next[key as keyof ImageGeometry] === previous[key as keyof ImageGeometry]) ? previous : next);
  }, []);
  useLayoutEffect(() => {
    const image = ref.current;
    if (!image) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    return () => observer.disconnect();
  }, [props.src, measure]);
  return <img {...props} ref={ref} style={{ ...imageFramingStyle(framing, geometry), ...style }} onLoad={(event) => { measure(); onLoad?.(event); }} />;
}
