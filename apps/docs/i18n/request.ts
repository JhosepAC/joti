import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./config";
import es from "../messages/es.json";
import en from "../messages/en.json";

const MESSAGES = { es, en } as const;

export default getRequestConfig(async () => {
  const store = await cookies();
  const headerList = await headers();
  const locale = resolveLocale(
    store.get(LOCALE_COOKIE)?.value,
    headerList.get("accept-language"),
  );
  return {
    locale,
    messages: MESSAGES[locale],
  };
});
