"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTeacher,
  deleteTeacher,
  updateTeacher,
  type ActionResult,
} from "../actions";
import type { AdminData } from "../types";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initialState: ActionResult = {};

export function TeachersTab({ data }: { data: AdminData }) {
  const [createState, createAction, createPending] = useActionState(
    createTeacher,
    initialState
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionCard title="Add teacher">
        <form action={createAction} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea name="bio" rows={3} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Specialty</label>
              <input name="specialty" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Display order</label>
              <input
                name="display_order"
                type="number"
                min={0}
                defaultValue={0}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Contact link</label>
            <input
              name="contact_link"
              type="url"
              placeholder="https://"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Photo</label>
            <input
              name="photo"
              type="file"
              accept="image/*"
              className={inputClass}
            />
          </div>
          <FormMessage state={createState} />
          <button type="submit" disabled={createPending} className={buttonClass}>
            {createPending ? "Saving…" : "Add teacher"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Teachers (${data.teachers.length})`}>
        {data.teachers.length === 0 ? (
          <p className="text-sm text-zinc-500">No teachers yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.teachers.map((teacher) =>
              editingId === teacher.id ? (
                <TeacherEditRow
                  key={teacher.id}
                  teacher={teacher}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <li
                  key={teacher.id}
                  className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex gap-4">
                    {teacher.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={teacher.photo_url}
                        alt=""
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-2xl">
                        👤
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-zinc-900">{teacher.name}</p>
                      {teacher.specialty && (
                        <p className="text-sm text-violet-600">
                          {teacher.specialty}
                        </p>
                      )}
                      {teacher.bio && (
                        <p className="mt-1 text-sm text-zinc-500">{teacher.bio}</p>
                      )}
                      {teacher.contact_link && (
                        <a
                          href={teacher.contact_link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-sm text-violet-600 hover:underline"
                        >
                          Contact
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(teacher.id)}
                      className={secondaryButtonClass}
                    >
                      Edit
                    </button>
                    <DeleteTeacherButton id={teacher.id} />
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function TeacherEditRow({
  teacher,
  onCancel,
  onSaved,
}: {
  teacher: AdminData["teachers"][0];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateTeacher, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="py-4">
      <form action={action} className="space-y-3 rounded-lg bg-zinc-50 p-4">
        <input type="hidden" name="id" value={teacher.id} />
        <input name="name" defaultValue={teacher.name} className={inputClass} />
        <textarea
          name="bio"
          defaultValue={teacher.bio ?? ""}
          rows={3}
          className={inputClass}
        />
        <input
          name="specialty"
          defaultValue={teacher.specialty ?? ""}
          className={inputClass}
        />
        <input
          name="contact_link"
          defaultValue={teacher.contact_link ?? ""}
          className={inputClass}
        />
        <input
          name="display_order"
          type="number"
          defaultValue={teacher.display_order}
          className={inputClass}
        />
        <input name="photo" type="file" accept="image/*" className={inputClass} />
        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            Save
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function DeleteTeacherButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this teacher?")) return;
        setPending(true);
        await deleteTeacher(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
