/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve modern formats so large PNGs don't ship to every visitor as-is.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
