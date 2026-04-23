'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../components/DeferredRouteLoader";

const CalendarPageClient = dynamic(() => import("./CalendarPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Calendar"
      detail="Loading calendars, mailboxes, and scheduling tools."
    />
  ),
});

export default function CalendarPage() {
  return <CalendarPageClient />;
}
