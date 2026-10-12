"use client";

import { useRef } from "react";
import { switchUserAction } from "@/app/actions";

export function UserSwitcher({ users, current }: { users: { id: string; label: string }[]; current: string }) {
  const form = useRef<HTMLFormElement>(null);
  const next = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={switchUserAction} className="flex items-center gap-2">
      <input ref={next} type="hidden" name="next" defaultValue="/" />
      <label htmlFor="demo-user" className="hidden sm:block text-xs text-white/70">
        Demo user
      </label>
      <select
        id="demo-user"
        name="userId"
        defaultValue={current}
        onChange={() => {
          if (next.current) next.current.value = window.location.pathname + window.location.search;
          form.current?.requestSubmit();
        }}
        className="bg-deep-code text-white text-sm rounded-full border border-white/20 px-3 py-2 max-w-[11rem] sm:max-w-[18rem]"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
    </form>
  );
}
