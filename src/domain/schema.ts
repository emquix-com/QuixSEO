import type { PageMetadataEvent } from "emdash/plugin";

type PublicPageContext = PageMetadataEvent["page"];

import type { SchemaConfig, Settings } from "./validation.js";
import { canonicalUrl, httpUrl, schemaConfig } from "./validation.js";
export function validateSchema(config: SchemaConfig): string[] {
  const issues: string[] = [];
  const c = schemaConfig.parse(config);
  if (
    ["Product", "LocalBusiness", "Organization", "Person"].includes(c.type) &&
    !c.name
  )
    issues.push("This type requires a name.");
  if ((c.price || c.currency || c.availability) && !(c.price && c.currency))
    issues.push("An offer requires both a price and ISO currency.");
  if (c.type === "Product" && !(c.image && c.description))
    issues.push("Product requires a real image and description.");
  if (c.type === "LocalBusiness" && !(c.street && c.city && c.country))
    issues.push("LocalBusiness requires a street, city and ISO country code.");
  if (c.type === "FAQPage" && !c.questions.length)
    issues.push("FAQPage requires at least one visible question and answer.");
  if (c.type === "BreadcrumbList" && !c.breadcrumbs.length)
    issues.push("BreadcrumbList requires at least one breadcrumb.");
  if (
    ["FAQPage", "Product", "LocalBusiness"].includes(c.type) &&
    !c.visibleContentConfirmed
  )
    issues.push(
      "Confirm that these facts are accurate and visible on this page.",
    );
  return issues;
}
export function schemaGraph(
  page: PublicPageContext,
  settings: Settings,
  override: SchemaConfig | null,
): Record<string, unknown> | null {
  if (!page.canonical) return null;
  const url = canonicalUrl(page.canonical);
  const root = `${new URL(url).origin}/`;
  const siteId = `${root}#quixseo-website`,
    identityId = `${root}#quixseo-identity`,
    pageId = `${url}#webpage`;
  const title = page.pageTitle || page.title || "";
  const graph: Record<string, unknown>[] = [];
  const identity = settings.identity;
  if (identity.name)
    graph.push({
      "@type": identity.type,
      "@id": identityId,
      name: identity.name,
      ...(identity.url ? { url: httpUrl(identity.url) } : {}),
      ...(identity.logo
        ? identity.type === "Organization"
          ? { logo: { "@type": "ImageObject", url: httpUrl(identity.logo) } }
          : { image: httpUrl(identity.logo) }
        : {}),
    });
  graph.push({
    "@type": "WebSite",
    "@id": siteId,
    url: root,
    name: page.siteName || identity.name || new URL(root).hostname,
    ...(identity.name ? { publisher: { "@id": identityId } } : {}),
  });
  graph.push({
    "@type": "WebPage",
    "@id": pageId,
    url,
    name: title,
    ...(page.description ? { description: page.description } : {}),
    isPartOf: { "@id": siteId },
    ...(page.locale ? { inLanguage: page.locale } : {}),
  });
  const c = override;
  if (c && validateSchema(c).length) return null;
  const type = c?.type ?? "WebPage";
  if (["Article", "BlogPosting"].includes(type))
    graph.push({
      "@type": type,
      "@id": `${url}#article`,
      mainEntityOfPage: { "@id": pageId },
      headline: c?.name || title,
      ...(c?.author ? { author: { "@type": "Person", name: c.author } } : {}),
      ...(page.articleMeta?.publishedTime
        ? { datePublished: page.articleMeta.publishedTime }
        : {}),
      ...(page.articleMeta?.modifiedTime
        ? { dateModified: page.articleMeta.modifiedTime }
        : {}),
      ...(c?.image || page.image ? { image: c?.image || page.image } : {}),
      ...(identity.name ? { publisher: { "@id": identityId } } : {}),
    });
  if (c?.type === "FAQPage")
    Object.assign(graph[graph.length - 1] ?? {}, {
      "@type": "FAQPage",
      mainEntity: c.questions.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    });
  if (
    c &&
    ["Product", "LocalBusiness", "Person", "Organization"].includes(type)
  )
    graph.push({
      "@type": type,
      "@id": `${url}#entity`,
      name: c.name,
      url,
      description: c.description,
      ...(c.image ? { image: c.image } : {}),
      ...(c.sku && type === "Product" ? { sku: c.sku } : {}),
      ...(type === "Product" && c.price && c.currency
        ? {
            offers: {
              "@type": "Offer",
              url,
              price: c.price,
              priceCurrency: c.currency,
              ...(c.availability
                ? { availability: `https://schema.org/${c.availability}` }
                : {}),
            },
          }
        : {}),
      ...(type === "LocalBusiness"
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: c.street,
              addressLocality: c.city,
              addressCountry: c.country,
            },
            ...(c.telephone ? { telephone: c.telephone } : {}),
          }
        : {}),
    });
  const crumbs = c?.breadcrumbs.length ? c.breadcrumbs : page.breadcrumbs;
  if (crumbs?.length)
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: crumbs.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: httpUrl(b.url),
      })),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}
