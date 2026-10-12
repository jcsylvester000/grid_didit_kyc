import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AccessGate } from "@/components/AccessGate";
import { hasAccess } from "@/lib/server/session";
import { env } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Access code" };

export default async function UnlockPage() {
  if (await hasAccess()) redirect("/");
  return <AccessGate secretMissing={!env.sessionSecret()} />;
}
