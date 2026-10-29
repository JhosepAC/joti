"use client";
import { useTranslations } from "next-intl";
import { ListSelect } from "@/features/lists/components/list-select";
import { resolveTimezone } from "@/convex/calendar/time";

export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("calendar");
  const device = resolveTimezone("system");
  return (
    <ListSelect
      label={t("timezone")}
      value={value}
      onChange={onChange}
      options={[
        { value: "system", label: t("systemTimezone", { timezone: device }) },
        ...[
          ...new Set([
            ...(value !== "system" ? [value] : []),
            device,
            "UTC",
            ...Intl.supportedValuesOf("timeZone"),
          ]),
        ].map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })),
      ]}
    />
  );
}
