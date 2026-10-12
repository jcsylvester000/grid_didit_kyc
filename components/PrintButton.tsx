"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-ghost w-full">
      <Printer size={16} aria-hidden /> Download / print (save as PDF)
    </button>
  );
}
