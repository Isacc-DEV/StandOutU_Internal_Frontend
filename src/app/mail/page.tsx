'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../components/DeferredRouteLoader";

const MailPageClient = dynamic(() => import("./MailPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Mail"
      detail="Loading mailboxes, messages, and mailbox actions."
    />
  ),
});

export default function MailPage() {
  return <MailPageClient />;
}
