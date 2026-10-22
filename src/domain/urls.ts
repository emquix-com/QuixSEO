/** URL parsing for analysis only. Does not fetch, infer routes or change metadata. */
export function usableUrl(value: unknown): URL | null {
  if (
    typeof value !== "string" ||
    !/^https?:\/\/[^/?#]+(?:[/?#]|$)/iu.test(value) ||
    value.length > 4096 ||
    /[\s\u0000-\u001f\u007f\\]/u.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url : null;
  } catch (error) {
    // Only the URL constructor is guarded; API and storage errors must propagate.
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export interface AnalysisUrls {
  site: string | null;
  page: string | null;
  origin: string | null;
}
export function analysisUrls(site: unknown, page: unknown): AnalysisUrls {
  const parsedSite = usableUrl(site);
  const siteUrl =
    parsedSite && !parsedSite.search && !parsedSite.hash ? parsedSite : null;
  // EmDash 1.3.1 concatenates site.url + route after stripping one trailing
  // slash. A setting of "https://" becomes "https:/" and can turn /posts/a
  // into the plausible but invented host https://posts/a. Reject that
  // derivation while still accepting independently usable content URLs.
  const derivedFromInvalidSite =
    !siteUrl &&
    typeof site === "string" &&
    site.length > 0 &&
    typeof page === "string" &&
    page.startsWith(`${site}/`);
  const pageUrl = derivedFromInvalidSite ? null : usableUrl(page);
  return {
    site: siteUrl?.href ?? null,
    page: pageUrl?.href.replace(/#.*$/u, "") ?? null,
    origin: (pageUrl ?? siteUrl)?.origin ?? null,
  };
}

export const siteUrlWarning = {
  title: "Site URL not configured",
  description:
    "QuixSEO can analyze your content, but some URL-related checks are unavailable. Configure your Site URL in EmDash → Settings to enable complete SEO analysis.",
};

export function resolveCanonical(
  value: string,
  urls: AnalysisUrls,
): string | null {
  const absolute = usableUrl(value);
  if (absolute) return absolute.href.replace(/#.*$/u, "");
  // Native canonicals are relative to the site root, not an inferred entry path.
  if (!urls.origin || !/^\/(?!\/)/u.test(value) || /[\s\\]/u.test(value))
    return null;
  return usableUrl(`${urls.origin}${value}`)?.href.replace(/#.*$/u, "") ?? null;
}
