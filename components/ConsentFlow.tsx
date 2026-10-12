"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, IdCard, ScanFace, Sun, ShieldCheck, ArrowLeft } from "lucide-react";
import { CONSENT_CHECKBOX, ID_TYPES } from "@/lib/data";
import { startVerificationAction } from "@/app/actions";

type Step = "consent" | "id" | "tips";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Opening secure check…" : "Start secure check"}
    </button>
  );
}

export function ConsentFlow({ listingId, listingTitle, resumeId }: { listingId: string; listingTitle: string | null; resumeId: string | null }) {
  const [step, setStep] = useState<Step>("consent");
  const [agreed, setAgreed] = useState(false); // unticked by default (Data Privacy Act)
  const [notNow, setNotNow] = useState(false);
  const [idType, setIdType] = useState<string>("");
  const back = listingId ? `/listings/${listingId}` : "/";

  return (
    <form action={startVerificationAction} className="card p-6 sm:p-8 space-y-6">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="idType" value={idType} />
      <input type="hidden" name="consent" value={agreed ? "yes" : ""} />
      {resumeId && <input type="hidden" name="resumeId" value={resumeId} />}

      <ol className="flex gap-2 text-xs" aria-label="Progress">
        {(["consent", "id", "tips"] as Step[]).map((s, i) => (
          <li key={s} className={`flex-1 h-1.5 rounded-full ${["consent", "id", "tips"].indexOf(step) >= i ? "bg-muesli" : "bg-iron"}`}>
            <span className="sr-only">Step {i + 1}{step === s ? " (current)" : ""}</span>
          </li>
        ))}
      </ol>

      {step === "consent" && (
        <section className="space-y-5" aria-labelledby="consent-h">
          <div>
            <p className="eyebrow">Verify your identity</p>
            <h1 id="consent-h" className="text-3xl text-nile mt-1">Let&apos;s confirm it&apos;s you</h1>
            <p className="mt-3 text-muted">
              To protect owners, tenants and agents, Grid checks your ID once before you {listingTitle ? <>book a viewing of <b className="text-midnight">{listingTitle}</b></> : "book viewings"}, apply or sign. It takes about a minute.
            </p>
          </div>
          <div className="rounded-xl bg-canvas p-4 text-sm space-y-2">
            <p className="font-medium">You will need</p>
            <p className="text-muted">A valid government ID and good light for a quick selfie.</p>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Our verification partner <b className="text-midnight">Didit</b> checks a photo of your ID and a short selfie to confirm the ID is genuine
            and that it is really you. Your data is processed in the <b className="text-midnight">European Union</b>. Grid stores only the
            result, never your ID photo or selfie. You can ask us to delete it at any time.{" "}
            {/* TODO: link Grid's privacy notice and Didit's current notice + end-user terms once confirmed with Didit/counsel. */}
            <span className="underline">Grid Privacy Notice</span> · <span className="underline">Didit Verification Privacy Notice</span> ·{" "}
            <span className="underline">Didit End User Terms</span>
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-iron p-4 cursor-pointer has-[:checked]:border-nile has-[:checked]:bg-nile-soft">
            <input type="checkbox" className="mt-1 size-4 accent-[#1c335e]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span className="text-sm">{CONSENT_CHECKBOX}</span>
          </label>
          {notNow && (
            <p className="text-sm rounded-xl bg-info-soft text-info px-4 py-3" role="status">
              No problem. You can keep browsing, saving and messaging. We&apos;ll ask again only when you book a viewing.
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            {notNow ? (
              <Link href={back} className="btn btn-ghost flex-1">Back to listing</Link>
            ) : (
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setNotNow(true)}>Not now</button>
            )}
            <button type="button" className="btn btn-primary flex-1" disabled={!agreed} onClick={() => setStep("id")}>Continue</button>
          </div>
        </section>
      )}

      {step === "id" && (
        <section className="space-y-5" aria-labelledby="id-h">
          <button type="button" className="text-sm text-muted flex items-center gap-1" onClick={() => setStep("consent")}><ArrowLeft size={14} aria-hidden /> Back</button>
          <div>
            <p className="eyebrow">Step 1 of 3</p>
            <h1 id="id-h" className="text-3xl text-nile mt-1">Choose your ID</h1>
            <p className="mt-2 text-muted">Make sure it is valid and not expired.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="id-h">
            {ID_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={idType === t.value}
                onClick={() => setIdType(t.value)}
                className={`text-left rounded-xl border p-4 transition-colors ${idType === t.value ? "border-nile bg-nile-soft" : "border-iron bg-white hover:border-nile"}`}
              >
                <span className="flex items-center gap-2 font-medium"><IdCard size={18} aria-hidden /> {t.label}</span>
                <span className="block text-xs text-muted mt-1">{t.hint}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary w-full" disabled={!idType} onClick={() => setStep("tips")}>Continue</button>
        </section>
      )}

      {step === "tips" && (
        <section className="space-y-5" aria-labelledby="tips-h">
          <button type="button" className="text-sm text-muted flex items-center gap-1" onClick={() => setStep("id")}><ArrowLeft size={14} aria-hidden /> Back</button>
          <div>
            <p className="eyebrow">Before the camera opens</p>
            <h1 id="tips-h" className="text-3xl text-nile mt-1">Three tips for a first-try pass</h1>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3"><Sun className="text-muesli shrink-0" size={20} aria-hidden /> Move to bright, even light. Avoid glare on the card.</li>
            <li className="flex gap-3"><Camera className="text-muesli shrink-0" size={20} aria-hidden /> Fit the whole ID in the frame, front then back. Hold steady.</li>
            <li className="flex gap-3"><ScanFace className="text-muesli shrink-0" size={20} aria-hidden /> For the selfie, remove sunglasses or a mask and look at the camera.</li>
          </ul>
          <p className="text-xs text-muted flex gap-2"><ShieldCheck size={16} className="shrink-0" aria-hidden /> Didit&apos;s secure screen opens next. Grid never sees your ID photo or selfie.</p>
          <Submit />
        </section>
      )}
    </form>
  );
}
