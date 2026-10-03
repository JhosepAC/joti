import type es from "./messages/es.json";

type Messages = typeof es;

declare global {
  // next-intl uses this interface to type translation keys and values.
  // `es` is the source locale: every other locale must carry the same keys.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntlMessages extends Messages {}
}
