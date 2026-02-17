import type { ParsedUrl, UtmParam } from "./types";

const UTM_KEY_PATTERN = /^utm_/i;

export function parseUrlRow(rawUrl: string): ParsedUrl {
  const trimmed = rawUrl.trim();

  const base: ParsedUrl = {
    raw: trimmed,
    protocol: "",
    host: "",
    pathname: "",
    utmParams: [],
    otherParams: {},
    fragment: "",
    duplicateKeys: [],
  };

  if (!trimmed) {
    return { ...base, parseError: "Empty URL" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ...base, parseError: "Malformed URL: unable to parse" };
  }

  const protocol = url.protocol.replace(/:$/, "");
  const host = url.hostname;
  const pathname = url.pathname;
  const fragment = url.hash.replace(/^#/, "");

  const utmParams: UtmParam[] = [];
  const otherParams: Record<string, string> = {};
  const keyCounts = new Map<string, number>();

  Array.from(url.searchParams.entries()).forEach(([rawKey, value]) => {
    const normalizedKey = rawKey.toLowerCase();
    keyCounts.set(normalizedKey, (keyCounts.get(normalizedKey) || 0) + 1);

    if (UTM_KEY_PATTERN.test(rawKey)) {
      utmParams.push({
        key: normalizedKey,
        value,
        rawKey,
      });
    } else {
      otherParams[rawKey] = value;
    }
  });

  const duplicateKeys: string[] = [];
  Array.from(keyCounts.entries()).forEach(([key, count]) => {
    if (count > 1) {
      duplicateKeys.push(key);
    }
  });

  return {
    raw: trimmed,
    protocol,
    host,
    pathname,
    utmParams,
    otherParams,
    fragment,
    duplicateKeys,
  };
}
