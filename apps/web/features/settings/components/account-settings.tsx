"use client";
/* eslint-disable @next/next/no-img-element -- Convex storage supplies dynamic authenticated-upload URLs. */
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountGlyph } from "./account-glyph";
import { useLocale, useTranslations } from "next-intl";
import { useAccount } from "../hooks/use-account";
import { useLocaleSwitcher } from "@/i18n/use-locale-switcher";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { ListSelect } from "@/features/lists/components/list-select";
import { Modal } from "@/features/lists/components/overlays";
import "@/features/lists/components/lists.css";
import "@/features/lists/components/list-controls.css";
import "./settings.css";
export function AccountSettings({ onClose }: { onClose?: () => void } = {}) {
  const router = useRouter();
  const t = useTranslations("account"),
    locale = useLocale(),
    model = useAccount(),
    { switchLocale } = useLocaleSwitcher(),
    { signOut, signingOut, logoutError } = useLogout();
  const [tab, setTab] = useState("profile"),
    [draft, setDraft] = useState({ name: "", username: "", locale }),
    [initialized, setInitialized] = useState(false),
    [success, setSuccess] = useState(""),
    [localError, setLocalError] = useState(""),
    [file, setFile] = useState<File>(),
    [preview, setPreview] = useState(""),
    [confirm, setConfirm] = useState<"logout" | "sessions" | "close" | null>(
      null,
    );
  const input = useRef<HTMLInputElement>(null),
    data = model.data;
  useEffect(() => {
    if (data && !initialized) {
      setDraft({
        name: data.name,
        username: data.username,
        locale: ["es", "en"].includes(data.locale) ? data.locale : locale,
      });
      setInitialized(true);
    }
  }, [data, initialized, locale]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const dirty = Boolean(
    data &&
    (draft.name !== data.name ||
      draft.username !== data.username ||
      draft.locale !==
        (["en", "es"].includes(data.locale) ? data.locale : locale) ||
      file),
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const message = (code: string) =>
    t(
      `errors.${["UNAUTHORIZED", "USERNAME_TAKEN", "VALIDATION_ERROR", "INVALID_IMAGE", "RATE_LIMITED", "NOT_FOUND"].includes(code) ? code : "UNAVAILABLE"}`,
    );
  const perform = async (
    operation: string,
    extra: Record<string, unknown> = {},
  ) => {
    setSuccess("");
    setLocalError("");
    const result = await model.request({ operation, ...extra });
    if (result && operation === "save") {
      setDraft({
        name: result.name,
        username: result.username,
        locale: result.locale,
      });
      switchLocale(result.locale as "es" | "en");
    }
    if (result)
      setSuccess(t(operation === "resetPassword" ? "emailSent" : "saved"));
    return result;
  };
  const date = (value: number) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  const close = () => {
    if (model.busy || signingOut) return;
    if (dirty) setConfirm("close");
    else if (onClose) onClose();
    else router.replace("/");
  };
  const finishClose = () => {
    if (onClose) onClose();
    else router.replace("/");
  };
  return (
    <Modal label={t("title")} onClose={close} className="settings-dialog">
      <div
        className="settings-shell lists-surface"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !confirm) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <button
          type="button"
          className="settings-close"
          aria-label={t("close")}
          disabled={model.busy || signingOut}
          onClick={close}
        >
          <AccountGlyph name="close" />
        </button>
        <aside className="settings-nav">
          <h1>{t("title")}</h1>
          <div className="settings-nav-identity">
            <span className="settings-mini-avatar">
              {data?.avatarUrl ? (
                <img
                  key={data.avatarUrl}
                  src={data.avatarUrl}
                  alt=""
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
              ) : (
                (data?.name.slice(0, 1).toUpperCase() ?? "N")
              )}
            </span>
            <div>
              <strong>{data?.name ?? "Nook"}</strong>
              <span>{data ? `@${data.username}` : t("loading")}</span>
            </div>
          </div>
          <nav aria-label={t("title")}>
            {["profile", "security", "preferences", "danger"].map((key) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => {
                  setTab(key);
                  setSuccess("");
                }}
              >
                <AccountGlyph name={key} />
                {t(key)}
              </button>
            ))}
          </nav>

          <button
            disabled={signingOut || model.busy}
            onClick={() => (dirty ? setConfirm("logout") : void signOut())}
          >
            <AccountGlyph name="logout" />
            {t("logout")}
          </button>
        </aside>
        <main className="settings-content">
          <header>
            <h2>{t(tab)}</h2>
            <p>{t(`${tab}Intro`)}</p>
          </header>
          {(localError || model.error || logoutError) && (
            <div className="settings-error" role="alert">
              {localError
                ? message(localError)
                : logoutError || message(model.error)}
              {model.error === "UNAUTHORIZED" ? (
                <Link href="/auth/login">{t("login")}</Link>
              ) : (
                !data && (
                  <button onClick={() => void model.request()}>
                    {t("retry")}
                  </button>
                )
              )}
            </div>
          )}
          {success && (
            <p className="settings-success" role="status">
              {success}
            </p>
          )}
          {!data ? (
            <p aria-busy={model.busy}>
              {model.busy ? t("loading") : t("unavailable")}
            </p>
          ) : (
            <>
              {tab === "profile" && (
                <>
                  <section className="settings-avatar-section">
                    <div className="settings-avatar">
                      <span aria-hidden="true">
                        {data.name.slice(0, 1).toUpperCase()}
                      </span>
                      {preview || data.avatarUrl ? (
                        <img
                          key={preview || data.avatarUrl}
                          src={preview || data.avatarUrl!}
                          alt={t("avatar")}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>
                    <div>
                      <h3>{t("avatar")}</h3>
                      <p>{t("imageHint")}</p>
                      <div className="settings-actions">
                        <button
                          className="lists-secondary"
                          disabled={model.busy}
                          onClick={() => input.current?.click()}
                        >
                          {t("chooseImage")}
                        </button>
                        {file ? (
                          <>
                            <button
                              className="lists-primary"
                              disabled={model.busy}
                              onClick={async () => {
                                const form = new FormData();
                                form.set("avatar", file);
                                if (await model.request(form)) {
                                  setFile(undefined);
                                  setSuccess(t("saved"));
                                }
                              }}
                            >
                              {t("saveImage")}
                            </button>
                            <button
                              disabled={model.busy}
                              onClick={() => setFile(undefined)}
                            >
                              {t("cancel")}
                            </button>
                          </>
                        ) : (
                          data.avatarUrl && (
                            <button
                              disabled={model.busy}
                              onClick={() => void perform("removeAvatar")}
                            >
                              {t("removeImage")}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <input
                      ref={input}
                      hidden
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        e.target.value = "";
                        if (!selected) return;
                        if (
                          selected.size > 512 * 1024 ||
                          !["image/png", "image/jpeg", "image/webp"].includes(
                            selected.type,
                          )
                        ) {
                          setLocalError("INVALID_IMAGE");
                          return;
                        }
                        setLocalError("");
                        setFile(selected);
                      }}
                    />
                  </section>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        !draft.name.trim() ||
                        draft.name.length > 100 ||
                        !/^[a-z0-9_]{3,20}$/.test(draft.username)
                      ) {
                        setLocalError("VALIDATION_ERROR");
                        return;
                      }
                      await perform("save", draft);
                    }}
                  >
                    <fieldset disabled={model.busy}>
                      <label>
                        {t("name")}
                        <input
                          value={draft.name}
                          maxLength={100}
                          required
                          onChange={(e) =>
                            setDraft({ ...draft, name: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        {t("username")}
                        <input
                          value={draft.username}
                          minLength={3}
                          maxLength={20}
                          pattern="[a-z0-9_]{3,20}"
                          required
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              username: e.target.value.toLowerCase(),
                            })
                          }
                        />
                        <small>{t("usernameHint")}</small>
                      </label>
                      <label>
                        {t("email")}
                        <input value={data.email} readOnly />
                        <small>{t("emailManaged")}</small>
                      </label>
                      <p className="settings-meta">
                        {t("registered", { date: date(data.createdAt) })}
                      </p>
                      <div className="settings-actions">
                        <button
                          className="lists-primary"
                          disabled={model.busy || !dirty}
                        >
                          {t(model.busy ? "saving" : "save")}
                        </button>
                        <button
                          type="button"
                          className="lists-secondary"
                          onClick={() => {
                            setDraft({
                              name: data.name,
                              username: data.username,
                              locale: ["es", "en"].includes(data.locale)
                                ? data.locale
                                : locale,
                            });
                            setFile(undefined);
                            setLocalError("");
                          }}
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </fieldset>
                  </form>
                </>
              )}
              {tab === "preferences" && (
                <section>
                  <label>
                    {t("language")}
                    <ListSelect
                      label={t("language")}
                      value={draft.locale}
                      options={[
                        { value: "es", label: "Español" },
                        { value: "en", label: "English" },
                      ]}
                      onChange={(value) =>
                        setDraft({ ...draft, locale: value })
                      }
                    />
                  </label>
                  <div className="settings-actions">
                    <button
                      className="lists-primary"
                      disabled={model.busy}
                      onClick={async () => {
                        if (await perform("save", draft))
                          switchLocale(draft.locale as "es" | "en");
                      }}
                    >
                      {t("save")}
                    </button>
                  </div>
                  <dl className="settings-facts">
                    <div>
                      <dt>{t("appearance")}</dt>
                      <dd>{t("light")}</dd>
                    </div>
                    <div>
                      <dt>{t("timezone")}</dt>
                      <dd>
                        {Intl.DateTimeFormat().resolvedOptions().timeZone} ·{" "}
                        {t("automatic")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("weekStarts")}</dt>
                      <dd>{t("monday")}</dd>
                    </div>
                  </dl>
                  <p>{t("preferencesNote")}</p>
                </section>
              )}
              {tab === "security" && (
                <>
                  <section>
                    <h3>{t("password")}</h3>
                    <p>{t("passwordHint", { email: data.email })}</p>
                    <button
                      className="lists-secondary"
                      disabled={model.busy}
                      onClick={() => void perform("resetPassword")}
                    >
                      {t("resetPassword")}
                    </button>
                    <h3>{t("email")}</h3>
                    <p>{data.email}</p>
                    <p>{t("emailManaged")}</p>
                  </section>
                  <section>
                    <header className="settings-section-header">
                      <h3>{t("sessions")}</h3>
                      <button
                        className="lists-secondary"
                        disabled={model.busy || data.sessions.length < 2}
                        onClick={() => setConfirm("sessions")}
                      >
                        {t("revokeOthers")}
                      </button>
                    </header>
                    {data.sessions.map((session) => (
                      <div className="settings-session" key={session.id}>
                        <div>
                          <strong>
                            {t(
                              session.current
                                ? "currentSession"
                                : "otherSession",
                            )}
                          </strong>
                          <p>
                            {t("started", { date: date(session.createdAt) })}
                          </p>
                          <small>
                            {t("expires", { date: date(session.expiresAt) })}
                          </small>
                        </div>
                        {!session.current && (
                          <button
                            disabled={model.busy}
                            className="lists-secondary"
                            onClick={() =>
                              void perform("revoke", { sessionId: session.id })
                            }
                          >
                            {t("revoke")}
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                </>
              )}
              {tab === "danger" && (
                <section>
                  <h3>{t("deleteAccount")}</h3>
                  <p>{t("deleteExplanation")}</p>
                  <button className="lists-secondary" disabled>
                    {t("deleteAccount")}
                  </button>
                  <p>{t("deletionUnavailable")}</p>
                </section>
              )}
            </>
          )}
        </main>
        {confirm && (
          <Modal
            label={t(confirm !== "sessions" ? "unsaved" : "revokeOthers")}
            onClose={() => {
              if (!model.busy) setConfirm(null);
            }}
          >
            <h2>{t(confirm !== "sessions" ? "unsaved" : "revokeOthers")}</h2>
            <p>
              {t(
                confirm === "close"
                  ? "discardHint"
                  : confirm === "logout"
                    ? "unsavedHint"
                    : "revokeHint",
              )}
            </p>
            <div className="lists-modal-actions">
              <button
                className="lists-secondary"
                autoFocus
                disabled={model.busy}
                onClick={() => setConfirm(null)}
              >
                {t("cancel")}
              </button>
              <button
                className="lists-primary"
                disabled={model.busy || signingOut}
                onClick={async () => {
                  if (confirm === "close") finishClose();
                  else if (confirm === "logout") await signOut();
                  else if (await perform("revokeOthers")) setConfirm(null);
                }}
              >
                {t(
                  confirm === "close"
                    ? "discard"
                    : confirm === "logout"
                      ? "logout"
                      : "revokeOthers",
                )}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
}
