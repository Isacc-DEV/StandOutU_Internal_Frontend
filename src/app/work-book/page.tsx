'use client';

import WorkbookContent from "../../components/workbook/WorkbookContent";
import WorkbookShell from "../../components/WorkbookShell";

export default function WorkBookPage() {
  return (
    <WorkbookShell>
      <WorkbookContent />
    </WorkbookShell>
  );
}
