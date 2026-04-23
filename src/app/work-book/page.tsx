'use client';

import { Suspense } from "react";
import DeferredRouteLoader from "../../components/DeferredRouteLoader";
import WorkbookContent from "../../components/workbook/WorkbookContent";
import WorkbookShell from "../../components/WorkbookShell";

export default function WorkBookPage() {
  return (
    <WorkbookShell>
      <Suspense
        fallback={
          <DeferredRouteLoader
            title="Work book"
            detail="Loading workbook entries, filters, and review tools."
          />
        }
      >
        <WorkbookContent />
      </Suspense>
    </WorkbookShell>
  );
}
