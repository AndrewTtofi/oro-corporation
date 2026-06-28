/**
 * The square brand mark shown next to the brand name across the app. Renders the
 * uploaded logo (a data: URL from branding) when present, otherwise the letter
 * wordmark. Keeps the existing `.mk` footprint so every layout stays intact.
 */
export function BrandMark({
  logo,
  mark,
  className = "mk",
  style,
}: {
  logo: string | null;
  mark: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (logo) {
    return (
      // Data-URL branding asset — next/image adds no value and can't optimise it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        className={className}
        style={{ objectFit: "contain", background: "#fff", ...style }}
      />
    );
  }
  return (
    <span className={className} style={style}>
      {mark}
    </span>
  );
}
