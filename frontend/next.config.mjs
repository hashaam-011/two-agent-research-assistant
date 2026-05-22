/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type checking runs via `tsc --noEmit` (CI + pre-commit).
  // Skipped here so Docker builds aren't blocked by third-party type issues
  // (e.g. react-markdown v10 referencing the global JSX namespace removed in @types/react v19).
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
