'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../../components/DeferredRouteLoader";

const ProfilesPageClient = dynamic(() => import("./ProfilesPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Profile Management"
      detail="Loading profile records, assignments, and management tools."
    />
  ),
});

export default function ManagerProfilesPage() {
  return <ProfilesPageClient />;
}
