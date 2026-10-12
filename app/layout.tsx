import type { Metadata } from "next";
import "@fontsource/cantata-one/400.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/judson/400.css";
import "@fontsource/judson/400-italic.css";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: { default: "GRID Verified", template: "%s · GRID Verified" },
  description: "Prototype: identity checks with Didit for GRID Property Ventures listings.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH">
      <body className="min-h-dvh flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 btn btn-primary">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-line bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted flex flex-col sm:flex-row gap-2 sm:justify-between">
            <p>Prototype · sample listings and people are invented · not legal advice.</p>
            <p>
              Identity checks by Didit. Images processed in the EU; Grid keeps only the result.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
