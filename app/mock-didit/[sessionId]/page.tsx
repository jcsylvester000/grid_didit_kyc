import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Camera, ScanFace, Cpu } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { getVerificationBySession, MOCK_SCENARIOS } from "@/lib/server/kyc";
import { idTypeLabel } from "@/lib/data";
import { mockCompleteAction } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simulated Didit screen" };

type Props = { params: Promise<{ sessionId: string }> };

/** Stand-in for Didit's hosted verification page while no API key is configured. */
export default async function MockDidit({ params }: Props) {
  const { sessionId } = await params;
  const user = await requireUser(`/mock-didit/${sessionId}`);
  const v = sessionId.startsWith("mock_") ? await getVerificationBySession(sessionId) : null;
  if (!v || v.user_id !== user.id || v.mode !== "mock") redirect("/");
  if (v.outcome !== "in_progress") redirect(`/verify/result?v=${v.id}`);

  return (
    <div className="page max-w-md">
      <div className="rounded-[28px] bg-midnight text-white p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>verify.didit.me (simulated)</span>
          <span>Session {sessionId.slice(5, 13)}</span>
        </div>
        <div>
          <p className="text-sm text-burly">Didit secure verification</p>
          <h1 className="text-2xl mt-1">Simulated capture</h1>
          <p className="text-sm text-white/70 mt-2">
            In live mode this is Didit&apos;s own screen. The camera steps are skipped here. Pick what happens so you can see each
            result in Grid.
          </p>
        </div>
        <ol className="space-y-2 text-sm">
          <li className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"><Camera size={18} className="text-burly" aria-hidden /> Photo of {idTypeLabel(v.id_type_chosen)}, front and back</li>
          <li className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"><ScanFace size={18} className="text-burly" aria-hidden /> Live selfie (passive liveness + face match)</li>
          <li className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"><Cpu size={18} className="text-burly" aria-hidden /> Automatic check</li>
        </ol>
        <form action={mockCompleteAction} className="space-y-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <p className="text-xs uppercase tracking-wider text-white/50">Choose the result</p>
          {Object.entries(MOCK_SCENARIOS).map(([key, label]) => (
            <button
              key={key}
              name="scenario"
              value={key}
              className="w-full text-left rounded-xl border border-white/15 px-4 py-3 text-sm hover:border-burly hover:bg-white/5"
            >
              {label}
            </button>
          ))}
        </form>
      </div>
    </div>
  );
}
