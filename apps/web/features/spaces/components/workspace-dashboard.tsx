"use client";
import { SpaceSettings, SPACE_MODULES } from "./space-settings";

import { JotiLogo } from "@/components/ui/joti-logo";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { AccountSettings } from "@/features/settings/components/account-settings";
import { AccountGlyph } from "@/features/settings/components/account-glyph";
import {
  BlankIcon,
  HomeIcon,
  LayersIcon,
  LockIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
} from "./icons";
import { WorkspaceSpaceBadge } from "./space-symbol";
import { useWorkspaceDashboard } from "../hooks/use-workspace-dashboard";
import type { SpacePage } from "../types/dashboard.types";
import { ListsModule } from "@/features/lists/components/lists-module";
import { ListIcon } from "@/features/lists/components/list-icon";
import type { ListSummary } from "@/features/lists/types";
import { WorkspaceTreeItem, type TreeAction } from "./workspace-tree-item";
import { RenameDialog } from "@/features/lists/components/list-dialogs";
import {
  PageEditor,
  PageDeleteDialog,
  PageConflictDialog,
} from "@/features/pages/components/page-editor";
import { NotesModule } from "@/features/notes/components/notes-module";
import { GalleryModule } from "@/features/gallery/components/gallery-module";
import { GalleryIcon } from "@/features/gallery/components/gallery-icon";
import { CalendarModule } from "@/features/calendar/components/calendar-module";
import { ListGlyph } from "@/features/lists/components/list-icon";
import { CreateSpaceDialog } from "./create-space-dialog";
import { SpaceRail } from "./space-rail";
import "./workspace.css";
import "./workspace-navigation.css";
import "./workspace-pages-refinement.css";
import { PageIconPicker } from "@/features/pages/components/page-icon-picker";
import "./workspace-tree-controls.css";
import "./space-settings.css";
import "./space-rail.css";

export function WorkspaceDashboard({ slug }: { slug: string }) {
  const t = useTranslations("spaces.dashboard");
  const ts = useTranslations("spaceSettings");
  const [spaceSettings, setSpaceSettings] = useState<"design" | "tools" | null>(
    null,
  );
  const tLists = useTranslations("lists");
  const locale = useLocale();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const model = useWorkspaceDashboard(slug);
  const { data, view, drafts, error, loading, busy, page, draft, dirty } =
    model;
  const [createSpace, setCreateSpace] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("joti:navigation") ?? "{}");
      setRailCollapsed(saved.rail === true);
      setSidebarCollapsed(saved.sidebar === true);
    } catch {}
  }, []);
  const collapse = (rail: boolean) => {
    const r = rail ? !railCollapsed : railCollapsed,
      s = rail ? sidebarCollapsed : !sidebarCollapsed;
    setRailCollapsed(r);
    setSidebarCollapsed(s);
    try {
      localStorage.setItem(
        "joti:navigation",
        JSON.stringify({ rail: r, sidebar: s }),
      );
    } catch {}
  };
  const [query, setQuery] = useState("");
  const [resolveConflict, setResolveConflict] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [listKey, setListKey] = useState<string>();
  const [listCatalog, setListCatalog] = useState<ListSummary[]>([]);
  const [newListSignal, setNewListSignal] = useState(0);
  const [listAction, setListAction] = useState<{
    sequence: number;
    key: string;
    action: TreeAction;
  }>();
  const [deletePage, setDeletePage] = useState<SpacePage | null>(null);
  const [renamePage, setRenamePage] = useState<SpacePage | null>(null);
  const [listsMounted, setListsMounted] = useState(false);
  useEffect(() => {
    if (view === "lists") setListsMounted(true);
  }, [view]);
  useEffect(() => {
    setListKey(new URLSearchParams(location.search).get("list") ?? undefined);
  }, [slug]);
  const navigation = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { signOut, signingOut, logoutError } = useLogout();
  useEffect(() => {
    const media = matchMedia(
      ["lists", "gallery"].includes(view)
        ? "(max-width: 1100px)"
        : "(max-width: 760px)",
    );
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [view]);
  useEffect(() => {
    if (!drawer || !mobile) return;
    const pane = navigation.current;
    pane?.querySelector<HTMLElement>("a,button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(false);
        return;
      }
      if (event.key !== "Tab" || !pane) return;
      const controls = [
        ...pane.querySelectorAll<HTMLElement>(
          "a,button:not(:disabled),input,select",
        ),
      ].filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      menuButton.current?.focus();
    };
  }, [drawer, mobile]);
  useEffect(() => {
    if (!data) return;
    const module = ["lists", "calendar", "notes", "gallery", "pages"].includes(
      view,
    )
      ? view
      : view === "home"
        ? null
        : "pages";
    if (module && !data.space.modules?.includes(module)) model.select("home");
  }, [data, view, model]);
  const select = (next: string) => {
    const module = ["lists", "calendar", "notes", "gallery", "pages"].includes(
      next,
    )
      ? next
      : next === "home"
        ? null
        : "pages";
    if (module && !data?.space.modules?.includes(module)) {
      setSpaceSettings("tools");
      return;
    }
    model.select(next);
    setDrawer(false);
    const url = new URL(location.href);
    if (["lists", "calendar", "notes", "gallery"].includes(next))
      url.searchParams.set("module", next);
    else {
      url.searchParams.delete("module");
      url.searchParams.delete("list");
    }
    if (
      !["home", "pages", "lists", "calendar", "notes", "gallery"].includes(next)
    )
      url.searchParams.set("page", next);
    else url.searchParams.delete("page");
    history.replaceState(null, "", url);
  };
  const selectList = (key: string) => {
    setListKey(key);
    setDrawer(false);
    if (view !== "lists") return;
    const url = new URL(location.href);
    url.searchParams.set("module", "lists");
    url.searchParams.set("list", key);
    history.replaceState(null, "", url);
  };
  const message = (code: string) =>
    t(
      [
        "UNAUTHORIZED",
        "NOT_FOUND",
        "CONFLICT",
        "VALIDATION_ERROR",
        "PAGE_LIMIT",
      ].includes(code)
        ? `errors.${code}`
        : "errors.UNAVAILABLE",
    );
  if (!data)
    return (
      <div className="joti-workspace workspace-gate">
        <span className="workspace-wordmark" aria-label="Joti">
          <JotiLogo />
        </span>
        {loading ? (
          <p role="status">
            <SpinnerIcon />
            {t("loading")}
          </p>
        ) : (
          <div>
            <h1>{t("unavailable")}</h1>
            <p role="alert">{message(error)}</p>
            <button
              className="workspace-primary"
              onClick={() => void model.load()}
            >
              {t("retry")}
            </button>
            <Link href="/auth/login">{t("signIn")}</Link>
          </div>
        )}
      </div>
    );
  const filtered = data.pages.filter((item) =>
    item.title
      .toLocaleLowerCase(locale)
      .includes(query.toLocaleLowerCase(locale)),
  );
  const date = (value: number) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
      value,
    );
  const initial = Array.from(
    data.profile.displayName || data.profile.username || "N",
  )[0]?.toUpperCase();
  const home = view === "home";
  const isLists = view === "lists";
  const isCalendar = view === "calendar";
  const isNotes = view === "notes";
  const isGallery = view === "gallery";
  const pageRow = (item: SpacePage) => (
    <button
      className="workspace-page-row"
      key={item.id}
      onClick={() => select(item.id)}
    >
      {item.icon ? <ListIcon name={item.icon} /> : <BlankIcon />}
      <span>
        <strong>{item.title}</strong>
        <span>
          {item.body.trim().split("\n").filter(Boolean)[0] || t("emptyPage")}
        </span>
      </span>
      <time dateTime={new Date(item.updatedAt).toISOString()}>
        {date(item.updatedAt)}
      </time>
    </button>
  );
  return (
    <div
      className="joti-workspace"
      data-focus={focusMode}
      data-navigation-desktop={!mobile}
      data-rail-collapsed={!mobile && railCollapsed}
      data-sidebar-collapsed={!mobile && sidebarCollapsed}
      data-module={["lists", "gallery"].includes(view) ? view : undefined}
    >
      {drawer && mobile && (
        <button
          className="workspace-scrim"
          aria-label={t("closeNavigation")}
          onClick={() => setDrawer(false)}
        />
      )}
      <div
        className="workspace-navigation"
        data-open={drawer}
        ref={navigation}
        role={mobile && drawer ? "dialog" : undefined}
        aria-modal={mobile && drawer ? true : undefined}
        aria-label={mobile && drawer ? t("navigation") : undefined}
        inert={mobile && !drawer ? true : undefined}
      >
        <nav className="workspace-space-rail" aria-label={t("spaces")}>
          <Link
            href="/"
            className="workspace-wordmark"
            aria-label="Joti"
            tabIndex={!mobile && railCollapsed ? -1 : undefined}
          >
            <JotiLogo compact />
          </Link>
          <div
            className="workspace-space-list"
            inert={!mobile && railCollapsed ? true : undefined}
          >
            <SpaceRail
              spaces={data.spaces}
              slug={slug}
              configure={model.configureSpace}
            />
            <button
              className="workspace-add-space"
              aria-label={t("newSpace")}
              title={t("newSpace")}
              onClick={() => setCreateSpace(true)}
            >
              <PlusIcon />
            </button>
          </div>
        </nav>
        {!mobile && (
          <>
            <button
              className="workspace-rail-toggle"
              aria-label={t(railCollapsed ? "expandSpaces" : "collapseSpaces")}
              aria-expanded={!railCollapsed}
              onClick={() => collapse(true)}
            >
              <ListGlyph name="right" />
            </button>
            <button
              className="workspace-sidebar-toggle"
              aria-label={t(
                sidebarCollapsed ? "expandModules" : "collapseModules",
              )}
              aria-expanded={!sidebarCollapsed}
              onClick={() => collapse(false)}
            >
              <ListGlyph name="right" />
            </button>
          </>
        )}
        <aside
          className="workspace-module-sidebar"
          inert={!mobile && sidebarCollapsed ? true : undefined}
        >
          <header>
            <WorkspaceSpaceBadge space={data.space} />
            <strong title={data.space.name}>{data.space.name}</strong>
            {mobile && (
              <button
                type="button"
                aria-label={t("closeNavigation")}
                onClick={() => setDrawer(false)}
              >
                ×
              </button>
            )}
          </header>
          <div className="workspace-sidebar-body">
            <nav className="workspace-modules" aria-label={t("modules")}>
              <button
                aria-current={home ? "page" : undefined}
                onClick={() => select("home")}
              >
                <HomeIcon />
                {t("home")}
              </button>
              {data.space.modules?.includes("lists") && (
                <button
                  aria-current={isLists ? "page" : undefined}
                  onClick={() => select("lists")}
                >
                  <ListIcon name="table" />
                  {tLists("moduleName")}
                </button>
              )}
              {data.space.modules?.includes("pages") && (
                <button
                  aria-current={
                    !home && !isLists && !isCalendar && !isNotes && !isGallery
                      ? "page"
                      : undefined
                  }
                  onClick={() => select("pages")}
                >
                  <LayersIcon />
                  {t("pages")}
                </button>
              )}
              {data.space.modules?.includes("calendar") && (
                <button
                  aria-current={isCalendar ? "page" : undefined}
                  onClick={() => select("calendar")}
                >
                  <ListGlyph name="calendar" />
                  {t("calendar")}
                </button>
              )}
              {data.space.modules?.includes("notes") && (
                <button
                  aria-current={isNotes ? "page" : undefined}
                  onClick={() => select("notes")}
                >
                  <ListIcon name="book" />
                  {t("notes")}
                </button>
              )}
              {data.space.modules?.includes("gallery") && (
                <button
                  aria-current={isGallery ? "page" : undefined}
                  onClick={() => select("gallery")}
                >
                  <GalleryIcon />
                  {t("gallery")}
                </button>
              )}
              <button onClick={() => setSpaceSettings("tools")}>
                <PlusIcon />
                {ts("manage")}
              </button>
            </nav>
            <div
              hidden={
                home ||
                isCalendar ||
                isNotes ||
                isGallery ||
                (!isLists && !data.space.modules?.includes("pages"))
              }
            >
              <div className="workspace-pages-heading">
                <span>{isLists ? tLists("yourLists") : t("yourPages")}</span>
                <button
                  aria-label={isLists ? tLists("newList") : t("newPage")}
                  disabled={busy}
                  onClick={() => {
                    if (isLists) setNewListSignal((value) => value + 1);
                    else void model.createPage();
                  }}
                >
                  <PlusIcon />
                </button>
              </div>
              <label className="workspace-search">
                <SearchIcon />
                <input
                  type="search"
                  placeholder={isLists ? tLists("switchList") : t("search")}
                  aria-label={isLists ? tLists("switchList") : t("search")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <nav className="workspace-page-tree" aria-label={t("yourPages")}>
                {isLists
                  ? listCatalog
                      .filter(
                        (item) =>
                          !item.archived &&
                          item.name
                            .toLocaleLowerCase(locale)
                            .includes(query.toLocaleLowerCase(locale)),
                      )
                      .sort((a, b) => Number(b.favorite) - Number(a.favorite))
                      .map((item) => (
                        <WorkspaceTreeItem
                          canDelete
                          key={item.key}
                          name={item.name}
                          icon={<ListIcon name={item.icon} />}
                          selected={listKey === item.key}
                          favorite={item.favorite}
                          href={`/w/${slug}?module=lists&list=${encodeURIComponent(item.key)}`}
                          onSelect={() => selectList(item.key)}
                          onAction={(action) =>
                            setListAction((previous) => ({
                              sequence: (previous?.sequence ?? 0) + 1,
                              key: item.key,
                              action,
                            }))
                          }
                        />
                      ))
                  : [...filtered]
                      .sort(
                        (a, b) =>
                          Number(b.favorite ?? false) -
                          Number(a.favorite ?? false),
                      )
                      .map((item) => (
                        <WorkspaceTreeItem
                          key={item.id}
                          name={drafts[item.id]?.title || item.title}
                          icon={
                            item.icon ? (
                              <ListIcon name={item.icon} />
                            ) : (
                              <BlankIcon />
                            )
                          }
                          canDelete
                          deleteLabel={t("deletePage")}
                          selected={view === item.id}
                          favorite={item.favorite}
                          href={`/w/${slug}?page=${encodeURIComponent(item.id)}`}
                          onSelect={() => select(item.id)}
                          disabled={busy}
                          onAction={(action) => {
                            if (action === "rename") setRenamePage(item);
                            else if (action === "delete") setDeletePage(item);
                            else
                              void model.itemAction(
                                item.id,
                                action,
                                action === "favorite"
                                  ? { favorite: !item.favorite }
                                  : {},
                              );
                          }}
                          dirty={
                            !!(
                              drafts[item.id] &&
                              (drafts[item.id]?.title !== item.title ||
                                drafts[item.id]?.body !== item.body)
                            )
                          }
                        />
                      ))}
                {!isLists && !filtered.length && (
                  <p>{t(query ? "noResults" : "noPages")}</p>
                )}
              </nav>
              <button
                className="workspace-add-page"
                disabled={busy}
                onClick={() => {
                  if (isLists) setNewListSignal((value) => value + 1);
                  else void model.createPage();
                }}
              >
                <PlusIcon />
                {isLists ? tLists("newList") : t("newPage")}
              </button>
            </div>
          </div>
          <footer className="workspace-account">
            <div className="workspace-person">
              <span>
                {data.profile.avatarUrl ? (
                  <img
                    src={data.profile.avatarUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  initial
                )}
              </span>
              <div>
                <strong>
                  {data.profile.displayName || data.profile.username}
                </strong>
                <span>@{data.profile.username}</span>
              </div>
            </div>
            <div className="workspace-account-actions">
              <button
                type="button"
                className="workspace-settings-trigger"
                ref={settingsButton}
                aria-label={t("settings")}
                title={t("settings")}
                onClick={() => setSettingsOpen(true)}
              >
                <AccountGlyph name="settings" />
              </button>
              <button
                aria-label={t("signOut")}
                title={t("signOut")}
                disabled={signingOut}
                onClick={() => void signOut(slug)}
              >
                <LogoutIcon />
              </button>
            </div>
          </footer>
        </aside>
      </div>
      <div
        className="workspace-sheet"
        inert={mobile && drawer ? true : undefined}
      >
        <header className="workspace-toolbar">
          <button
            ref={menuButton}
            className="workspace-menu"
            aria-label={t("openNavigation")}
            aria-expanded={drawer}
            onClick={() => {
              setFocusMode(false);
              setDrawer(true);
            }}
          >
            <LayersIcon />
          </button>
          <div className="workspace-breadcrumb">
            <WorkspaceSpaceBadge space={data.space} />
            <span>{data.space.name}</span>
            <span aria-hidden="true">/</span>
            <strong>
              {home
                ? t("home")
                : isGallery
                  ? t("gallery")
                  : isNotes
                    ? t("notes")
                    : isCalendar
                      ? t("calendar")
                      : isLists
                        ? tLists("moduleName")
                        : page
                          ? draft?.title || t("untitled")
                          : t("pages")}
            </strong>
          </div>
          <div className="workspace-toolbar-actions">
            {page && (
              <>
                <span className="workspace-save-status" role="status">
                  {busy ? t("saving") : dirty ? t("unsaved") : t("saved")}
                </span>
                <button
                  className="workspace-save"
                  onClick={() => void model.savePage()}
                  disabled={busy || !dirty || !draft?.title.trim()}
                >
                  {t("save")}
                </button>
                <button
                  className="workspace-focus"
                  onClick={() => setFocusMode((value) => !value)}
                  aria-pressed={focusMode}
                >
                  {t(focusMode ? "exitFocus" : "focus")}
                </button>
              </>
            )}
            {home && (
              <span className="workspace-private">
                <LockIcon />
                {t("privateSpace")}
              </span>
            )}
          </div>
        </header>
        {(error || logoutError) && (
          <div className="workspace-error" role="alert">
            <span>{logoutError || message(error)}</span>
            {error === "UNAUTHORIZED" ? (
              <Link href="/auth/login">{t("signIn")}</Link>
            ) : (
              <button onClick={() => void model.load()}>{t("retry")}</button>
            )}
            {model.conflictId && (
              <button onClick={() => setResolveConflict(true)}>
                {t("resolveConflict")}
              </button>
            )}
          </div>
        )}
        {loading ? (
          <main className="workspace-loading" aria-busy="true">
            <p>{t("loading")}</p>
          </main>
        ) : (
          <main className="workspace-canvas">
            <div hidden={!isLists}>
              {(isLists || listsMounted) && (
                <ListsModule
                  key={slug}
                  slug={slug}
                  selectedKey={listKey}
                  onSelect={selectList}
                  onCatalog={setListCatalog}
                  newListSignal={newListSignal}
                  treeAction={listAction}
                />
              )}
            </div>
            {isGallery ? (
              <GalleryModule key={slug} slug={slug} />
            ) : isNotes ? (
              <NotesModule
                key={slug}
                slug={slug}
                onPage={(id) => {
                  void model.load();
                  select(id);
                }}
              />
            ) : isCalendar ? (
              <CalendarModule
                key={slug}
                slug={slug}
                timezone={data.profile.timezone}
              />
            ) : isLists ? null : home ? (
              <div className="space-overview">
                <header>
                  <WorkspaceSpaceBadge space={data.space} />
                  <div>
                    <h1>{data.space.name}</h1>
                    <p>{data.space.description || ts("intro")}</p>
                  </div>
                  <button onClick={() => setSpaceSettings("design")}>
                    {ts("title")}
                  </button>
                </header>
                <section>
                  <div className="space-overview-heading">
                    <h2>{ts("modules")}</h2>
                    <button onClick={() => setSpaceSettings("tools")}>
                      <PlusIcon />
                      {ts("add")}
                    </button>
                  </div>
                  {!data.space.modules?.length && (
                    <div className="space-overview-empty">
                      <LayersIcon />
                      <h3>{ts("empty")}</h3>
                      <p>{ts("emptyHint")}</p>
                      <button
                        className="workspace-primary"
                        onClick={() => setSpaceSettings("tools")}
                      >
                        {ts("add")}
                      </button>
                    </div>
                  )}
                  <div className="space-overview-modules">
                    {SPACE_MODULES.filter((key) =>
                      data.space.modules?.includes(key),
                    ).map((key) => (
                      <button key={key} onClick={() => select(key)}>
                        <ListIcon
                          name={
                            key === "pages"
                              ? "book"
                              : key === "lists"
                                ? "table"
                                : key === "notes"
                                  ? "book"
                                  : key === "gallery"
                                    ? "basket"
                                    : "check"
                          }
                        />
                        <span>
                          <strong>{ts(key)}</strong>
                          <small>{ts(`${key}Hint`)}</small>
                        </span>
                        <ListGlyph name="right" />
                      </button>
                    ))}
                  </div>
                </section>
                {data.space.modules?.includes("pages") && (
                  <section>
                    <h2>{ts("recent")}</h2>
                    {[...data.pages]
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .slice(0, 4)
                      .map((item) => (
                        <button
                          className="space-recent"
                          key={item.id}
                          onClick={() => select(item.id)}
                        >
                          <ListIcon name={item.icon || "book"} />
                          <strong>{item.title}</strong>
                          <time>{date(item.updatedAt)}</time>
                        </button>
                      ))}
                  </section>
                )}
                <aside className="space-overview-note">
                  <h2>{ts("yourSpace")}</h2>
                  <p>{ts("preserve")}</p>
                </aside>
              </div>
            ) : page && draft ? (
              <article className="workspace-document">
                <div className="workspace-document-meta">
                  <BlankIcon />
                  <span>{t(page.isStarter ? "starterPage" : "page")}</span>
                  <time dateTime={new Date(page.updatedAt).toISOString()}>
                    {t("edited", { date: date(page.updatedAt) })}
                  </time>
                </div>
                <h1 className="sr-only">{draft.title || t("untitled")}</h1>
                <label className="sr-only" htmlFor="page-title">
                  {t("pageTitle")}
                </label>
                <div className="workspace-title-row">
                  <PageIconPicker
                    icon={page.icon}
                    onChange={(icon) =>
                      void model.itemAction(page.id, "icon", { icon })
                    }
                  />
                  <input
                    id="page-title"
                    className="workspace-document-title"
                    value={draft.title}
                    maxLength={120}
                    onChange={(event) =>
                      model.edit({ ...draft, title: event.target.value })
                    }
                    placeholder={t("untitled")}
                  />
                </div>
                {!draft.title.trim() && (
                  <p className="workspace-field-error" role="alert">
                    {t("titleRequired")}
                  </p>
                )}
                <PageEditor
                  iconOnly
                  key={page.id}
                  body={draft.body}
                  title={draft.title}
                  icon={page.icon}
                  onChange={(body) => model.edit({ ...draft, body })}
                  onIcon={(icon) =>
                    void model.itemAction(page.id, "icon", { icon })
                  }
                  onSave={() => void model.savePage()}
                />
              </article>
            ) : (
              <section className="workspace-all-pages">
                <div className="workspace-section-title">
                  <div>
                    <h1>{t("pages")}</h1>
                    <p>{t("pagesDescription")}</p>
                  </div>
                  <button
                    className="workspace-primary"
                    disabled={busy}
                    onClick={() => void model.createPage()}
                  >
                    <PlusIcon />
                    {t("newPage")}
                  </button>
                </div>
                {filtered.map(pageRow)}
                {!filtered.length && (
                  <p>{t(query ? "noResults" : "noPages")}</p>
                )}
              </section>
            )}
          </main>
        )}
      </div>
      {spaceSettings && (
        <SpaceSettings
          space={data.space}
          save={model.configureSpace}
          initialSection={spaceSettings}
          onClose={() => setSpaceSettings(null)}
        />
      )}
      {createSpace && (
        <CreateSpaceDialog onClose={() => setCreateSpace(false)} />
      )}
      {deletePage && (
        <PageDeleteDialog
          name={deletePage.title}
          busy={busy}
          error={error ? message(error) : undefined}
          onClose={() => setDeletePage(null)}
          onDelete={async () => {
            if (await model.itemAction(deletePage.id, "delete"))
              setDeletePage(null);
          }}
        />
      )}
      {resolveConflict && model.conflictId && (
        <PageConflictDialog
          busy={busy}
          body={drafts[model.conflictId]?.body ?? ""}
          onClose={() => setResolveConflict(false)}
          onResolve={async () => {
            if (await model.useSavedVersion()) setResolveConflict(false);
          }}
        />
      )}
      {settingsOpen && (
        <AccountSettings
          onClose={() => {
            setSettingsOpen(false);
            requestAnimationFrame(() => settingsButton.current?.focus());
          }}
        />
      )}
      {renamePage && (
        <RenameDialog
          name={renamePage.title}
          maxLength={120}
          onClose={() => setRenamePage(null)}
          error={error ? message(error) : undefined}
          onSave={(title) =>
            model.itemAction(renamePage.id, "rename", { title })
          }
        />
      )}
    </div>
  );
}
