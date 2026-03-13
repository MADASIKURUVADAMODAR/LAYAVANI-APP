import React, { useState } from "react";

const DEFAULT_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='720' viewBox='0 0 480 720'%3E%3Crect width='480' height='720' fill='%23131a2a'/%3E%3Cpath d='M80 560l110-140 90 110 60-80 60 110H80z' fill='%23243657'/%3E%3Ccircle cx='152' cy='192' r='42' fill='%232a3550'/%3E%3C/svg%3E";

export default function SmartImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className,
  style,
  loading = "lazy",
  decoding = "async",
  ...rest
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = hasError || !src ? fallbackSrc : src;

  return (
    <img
      src={resolvedSrc}
      alt={alt || "Image"}
      loading={loading}
      decoding={decoding}
      className={className || ""}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }}
      onError={() => {
        if (!hasError) setHasError(true);
      }}
      {...rest}
    />
  );
}
