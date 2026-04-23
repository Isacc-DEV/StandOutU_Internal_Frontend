import type { NextConfig } from "next";

function extractAllowedDevOrigin(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).hostname;
  } catch {
    const normalized = trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .trim();
    return normalized || null;
  }
}

function getAllowedDevOrigins() {
  const values = new Set<string>();
  const add = (raw?: string) => {
    if (!raw) return;
    raw
      .split(",")
      .map((part) => extractAllowedDevOrigin(part))
      .filter((part): part is string => Boolean(part))
      .forEach((part) => values.add(part));
  };

  add(process.env.ALLOWED_DEV_ORIGINS);
  add(process.env.NEXTAUTH_URL);
  add(process.env.FRONTEND_URL);
  values.add("89.117.21.252");

  return Array.from(values);
}

const allowedDevOrigins = getAllowedDevOrigins();

const nextConfig: NextConfig = {
  output: 'standalone',
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  onDemandEntries: {
    maxInactiveAge: 15 * 60 * 1000,
    pagesBufferLength: 32,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
