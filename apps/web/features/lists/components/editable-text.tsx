"use client";
import { useEffect, useRef, useState } from "react";
export function EditableText({
  value,
  onCommit,
  label,
  className = "",
  maxLength = 2000,
  multiline = false,
  placeholder = "",
  required = false,
  disabled = false,
  version = 0,
  invalid = false,
  onDraftChange,
}: {
  value: string;
  onCommit: (value: string, baseVersion: number) => unknown;
  label: string;
  className?: string;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  version?: number;
  invalid?: boolean;
  onDraftChange?: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const composing = useRef(false);
  const sent = useRef<string | null>(null);
  const callback = useRef(onCommit);
  callback.current = onCommit;
  const modified = useRef(false);
  const rejected = useRef(false);
  const base = useRef(version);
  useEffect(() => {
    if ((!focused || !modified.current) && !rejected.current) {
      setDraft(value);
      sent.current = null;
      base.current = version;
    }
  }, [value, version, focused]);
  const commit = () => {
    if (
      modified.current &&
      draft !== value &&
      sent.current !== draft &&
      !composing.current &&
      (!required || draft.trim())
    ) {
      sent.current = draft;
      const result = callback.current(draft, base.current);
      rejected.current = result === false;
      if (!rejected.current) {
        modified.current = false;
      }
    }
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    if (!focused || draft === value) return;
    const timer = setTimeout(() => commitRef.current(), 450);
    return () => clearTimeout(timer);
  }, [draft, focused, value]);
  const props = {
    value: draft,
    maxLength,
    disabled,
    placeholder,
    "aria-label": label,
    "aria-invalid": invalid || (required && !draft.trim()),
    className,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      modified.current = true;
      rejected.current = false;
      sent.current = null;
      onDraftChange?.(event.target.value);
      setDraft(event.target.value);
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      commit();
      setFocused(false);
    },
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: () => {
      composing.current = false;
      commitRef.current();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        modified.current = false;
        rejected.current = false;
        setDraft(value);
        sent.current = value;
        event.currentTarget.blur();
      } else if (event.key === "Enter" && !multiline && !composing.current) {
        event.preventDefault();
        commit();
        event.currentTarget.blur();
      }
    },
  };
  return multiline ? <textarea rows={1} {...props} /> : <input {...props} />;
}
