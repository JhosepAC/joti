"use client";

import { JotiLogo } from "@/components/ui/joti-logo";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocaleSwitcher } from "@/i18n/use-locale-switcher";
import "./auth.css";

type IconName = "grid" | "check" | "note" | "calendar" | "plus" | "arrow";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    check: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    note: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6M8 13h8M8 17h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function useTabSpring(target: number) {
  const position = useRef(0);
  const velocity = useRef(0);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      position.current = target;
      velocity.current = 0;
      setValue(target);
      return;
    }
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.032);
      previous = now;
      velocity.current +=
        ((target - position.current) * 400 - velocity.current * 40) * dt;
      position.current += velocity.current * dt;
      if (
        Math.abs(target - position.current) < 0.001 &&
        Math.abs(velocity.current) < 0.01
      ) {
        position.current = target;
        setValue(target);
        return;
      }
      setValue(position.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export interface AuthSplitLayoutProps {
  children: ReactNode;
  className?: string;
}
export function AuthSplitLayout({
  children,
  className = "",
}: AuthSplitLayoutProps) {
  const t = useTranslations("auth.shell");
  const visual = useTranslations("auth.visual");
  const settings = useTranslations("common.settings");
  const { locale, switchLocale } = useLocaleSwitcher();
  const [switching, startTransition] = useTransition();
  const [space, setSpace] = useState(0);
  const [tool, setTool] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    "personal-0": true,
    "study-0": true,
    "project-0": true,
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [day, setDay] = useState(2);
  const spring = useTabSpring(tool);
  const examples = ["personal", "study", "project"] as const;
  const selected = examples[space]!;
  const tools = ["tasks", "notes", "calendar"] as const;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeTool = tools[tool]!;
  return (
    <main className={`auth-shell auth-studio ${className}`}>
      <header className="studio-header">
        <Link href="/" className="studio-brand" aria-label="Joti">
          <JotiLogo />
        </Link>
        <nav className="auth-language" aria-label={settings("language")}>
          <button
            type="button"
            lang="es"
            aria-pressed={locale === "es"}
            disabled={switching}
            onClick={() => startTransition(() => switchLocale("es"))}
          >
            Español
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={locale === "en"}
            disabled={switching}
            onClick={() => startTransition(() => switchLocale("en"))}
          >
            English
          </button>
        </nav>
      </header>
      <div className="studio-grid">
        <section
          className="auth-workspace studio-account"
          aria-label={t("account")}
        >
          <div className="studio-form-card">
            <div className="auth-form-region">{children}</div>
          </div>
        </section>
        <aside className="studio-world" aria-label={t("about")}>
          <div className="studio-intro">
            <h2>{visual("title")}</h2>
            <p>{visual("description")}</p>
          </div>
          <div className="studio-stage">
            <div className="studio-app">
              <nav className="studio-rail" aria-label={t("spaces")}>
                {examples.map((name, index) => (
                  <button
                    type="button"
                    key={name}
                    className={`studio-space studio-space-${name}`}
                    aria-label={t(`${name}.name`)}
                    aria-pressed={space === index}
                    onClick={() => setSpace(index)}
                  >
                    <Icon
                      name={
                        index === 0 ? "grid" : index === 1 ? "note" : "calendar"
                      }
                    />
                  </button>
                ))}
              </nav>
              <div className="studio-app-main">
                <div className="studio-app-toolbar">
                  <span>{visual("yourSpaces")}</span>
                  <span className="studio-demo-tag">{visual("demo")}</span>
                </div>
                <div className={`studio-cover studio-cover-${selected}`}>
                  <div>
                    <h3>{t(`${selected}.name`)}</h3>
                    <p>{t(`${selected}.description`)}</p>
                  </div>
                </div>
                <div
                  className="studio-tools"
                  role="tablist"
                  aria-label={visual("tools")}
                >
                  <span
                    className="studio-tool-indicator"
                    style={{ transform: `translateX(${spring * 100}%)` }}
                  />
                  {tools.map((name, index) => (
                    <button
                      key={name}
                      ref={(node) => {
                        tabRefs.current[index] = node;
                      }}
                      type="button"
                      role="tab"
                      id={`demo-tab-${name}`}
                      aria-controls="demo-panel"
                      aria-selected={tool === index}
                      tabIndex={tool === index ? 0 : -1}
                      onClick={() => setTool(index)}
                      onKeyDown={(event) => {
                        let next = index;
                        if (event.key === "ArrowRight") next = (index + 1) % 3;
                        else if (event.key === "ArrowLeft")
                          next = (index + 2) % 3;
                        else if (event.key === "Home") next = 0;
                        else if (event.key === "End") next = 2;
                        else return;
                        event.preventDefault();
                        setTool(next);
                        tabRefs.current[next]?.focus();
                      }}
                    >
                      <Icon
                        name={
                          index === 0
                            ? "check"
                            : index === 1
                              ? "note"
                              : "calendar"
                        }
                        size={16}
                      />
                      {visual(name)}
                    </button>
                  ))}
                </div>
                <div
                  className="studio-panel"
                  role="tabpanel"
                  id="demo-panel"
                  aria-labelledby={`demo-tab-${activeTool}`}
                >
                  {tool === 0 && (
                    <div className="studio-task-list">
                      {[0, 1, 2].map((index) => {
                        const key = `${selected}-${index}`;
                        return (
                          <label
                            key={key}
                            className={`studio-task ${checked[key] ? "is-done" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(checked[key])}
                              onChange={(event) =>
                                setChecked((previous) => ({
                                  ...previous,
                                  [key]: event.target.checked,
                                }))
                              }
                            />
                            <span className="studio-check" aria-hidden="true">
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="m3 8 3 3 7-7" />
                              </svg>
                            </span>
                            <span>{t(`${selected}.task${index}`)}</span>
                          </label>
                        );
                      })}
                      <p className="studio-panel-hint">
                        <Icon name="check" size={14} />
                        {visual("tryTask")}
                      </p>
                    </div>
                  )}
                  {tool === 1 && (
                    <div className="studio-note">
                      <label htmlFor="demo-note">{visual("noteTitle")}</label>
                      <textarea
                        id="demo-note"
                        value={notes[selected] ?? visual("noteDefault")}
                        onChange={(event) =>
                          setNotes((previous) => ({
                            ...previous,
                            [selected]: event.target.value,
                          }))
                        }
                        maxLength={240}
                      />
                      <p className="studio-panel-hint">{visual("localOnly")}</p>
                    </div>
                  )}
                  {tool === 2 && (
                    <div className="studio-calendar">
                      <p>{visual("week")}</p>
                      <div className="studio-week">
                        {Array.from({ length: 7 }, (_, index) => (
                          <button
                            type="button"
                            key={index}
                            aria-pressed={day === index}
                            onClick={() => setDay(index)}
                          >
                            <span>{visual(`day${index}`)}</span>
                            <strong>{index + 12}</strong>
                            <i />
                          </button>
                        ))}
                      </div>
                      <div className="studio-event">
                        <span />
                        <div>
                          <strong>{t(`${selected}.task1`)}</strong>
                          <p>
                            {visual("selectedDay", {
                              day: visual(`day${day}`),
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div
            className="studio-space-picker"
            role="group"
            aria-label={t("spaces")}
          >
            {examples.map((name, index) => (
              <button
                key={name}
                type="button"
                aria-pressed={space === index}
                onClick={() => setSpace(index)}
              >
                <span className={`studio-picker-dot studio-dot-${index}`} />
                {t(`${name}.name`)}
              </button>
            ))}
          </div>
          <p className="studio-play-hint">{visual("invite")}</p>
        </aside>
      </div>
      <footer className="studio-footer">
        <div className="studio-footer-brand">
          <span>Joti</span>
          <span>{t("footer")}</span>
        </div>
        <p className="studio-footer-credit">
          {t("developedBy")}{" "}
          <a
            href="https://jhosep-ac.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jhosep Argomedo
          </a>
        </p>
      </footer>
    </main>
  );
}
