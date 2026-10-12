import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ScanFace } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { getFaceCheck } from "@/lib/server/documents";
import { simulatedFaceCheckAction } from "@/app/doc-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simulated face check" };

type Props = { params: Promise<{ id: string; fcId: string }> };

/** Stand-in for Didit's Biometric Authentication screen when no face is on file at Didit. */
export default async function SimulatedFaceCheck({ params }: Props) {
  const { id, fcId } = await params;
  const user = await requireUser(`/documents/${id}/sign`);
  const fc = await getFaceCheck(fcId);
  if (!fc || fc.user_id !== user.id || fc.document_id !== id || fc.mode !== "simulated" || fc.status !== "pending") redirect(`/documents/${id}/sign`);
  return (
    <div className="page max-w-md">
      <div className="rounded-[28px] bg-midnight text-white p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between text-xs text-white/60"><span>verify.didit.me (simulated)</span><span>Biometric Authentication</span></div>
        <div className="grid place-items-center py-6">
          <div className="relative grid place-items-center size-40 rounded-full border-4 border-dashed border-burly/70">
            <ScanFace size={64} className="text-burly" aria-hidden />
          </div>
        </div>
        <div>
          <h1 className="text-2xl">Look at the camera</h1>
          <p className="text-sm text-white/70 mt-2">In live mode, Didit checks that you&apos;re a real person and compares your face with your earlier verification. Pick a result:</p>
        </div>
        <form action={simulatedFaceCheckAction} className="space-y-2">
          <input type="hidden" name="faceCheckId" value={fc.id} />
          <button name="result" value="pass" className="w-full text-left rounded-xl border border-white/15 px-4 py-3 text-sm hover:border-burly hover:bg-white/5">Same person, live (Approved)</button>
          <button name="result" value="fail" className="w-full text-left rounded-xl border border-white/15 px-4 py-3 text-sm hover:border-burly hover:bg-white/5">Different person or photo of a screen (Declined)</button>
        </form>
      </div>
    </div>
  );
}
