/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // No eslint devDependency is included (kept the dependency list to
    // exactly what the spec asked for) — skip the auto-lint-on-build step.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
