"use client";

import Image, { ImageProps } from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface ThemedImageProps extends Omit<ImageProps, "src" | "alt"> {
  lightSrc: string;
  darkSrc: string;
  alt: string;
}

/**
 * Renders the light or dark variant of an image based on the active theme.
 *
 * We hold off on swapping until after mount so SSR markup matches the first
 * client render (no hydration mismatch). Once mounted, the correct variant
 * is requested. Browsers will only fetch the variant that actually renders.
 */
export function ThemedImage({ lightSrc, darkSrc, alt, ...rest }: ThemedImageProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active = theme === "system" ? resolvedTheme : theme;
  const src = mounted && active === "dark" ? darkSrc : lightSrc;

  return <Image src={src} alt={alt} {...rest} />;
}
