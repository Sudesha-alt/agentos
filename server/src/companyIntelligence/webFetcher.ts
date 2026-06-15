import { logger } from "../utils/logger";

export type WebFetchSource = {
  url: string;
  method: "jina_reader" | "html_meta" | "direct_html";
  chars: number;
  ok: boolean;
};

export type WebFetchBundle = {
  website: string;
  combinedText: string;
  sources: WebFetchSource[];
  technologies: string[];
};

const SUPPLEMENTAL_PATHS = ["/about", "/pricing", "/company", "/product"];
const FETCH_TIMEOUT_MS = 18_000;
const JINA_TIMEOUT_MS = 28_000;
const MAX_CHARS_PER_PAGE = 12_000;
const MAX_COMBINED_CHARS = 36_000;
const MIN_USEFUL_HTML_CHARS = 180;

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || /aborted/i.test(err.message);
}

function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Website URL is required.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }
  return url.origin;
}

function pageUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Jina Reader — LLM-ready markdown extraction (handles many JS-heavy marketing sites). */
async function fetchJinaReader(url: string): Promise<string | null> {
  const readerUrl = `https://r.jina.ai/${url}`;
  try {
    const res = await fetchWithTimeout(readerUrl, {
      headers: {
        Accept: "text/plain",
        "User-Agent": "AgentOS-CompanyIntelligence/1.0",
      },
      timeoutMs: JINA_TIMEOUT_MS,
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.length > 80 ? text.slice(0, MAX_CHARS_PER_PAGE) : null;
  } catch (err) {
    if (isAbortError(err)) {
      logger.debug({ url }, "jina reader timed out — trying html fallback");
    } else {
      logger.warn({ err, url }, "jina reader fetch failed");
    }
    return null;
  }
}

function extractMetaFromHtml(html: string): string {
  const chunks: string[] = [];

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) chunks.push(`Title: ${titleMatch[1].trim()}`);

  for (const prop of ["og:title", "og:description", "description", "twitter:description"]) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop.replace(":", "\\:")}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const m = html.match(re);
    if (m?.[1]) chunks.push(`${prop}: ${m[1].trim()}`);
  }

  const jsonLdBlocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks.slice(0, 3)) {
      const inner = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      if (inner.length > 20 && inner.length < 8000) {
        chunks.push(`JSON-LD: ${inner}`);
      }
    }
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (bodyText.length > 100) {
    chunks.push(`Body excerpt: ${bodyText.slice(0, 2500)}`);
  }

  return chunks.join("\n");
}

async function fetchHtmlMeta(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; AgentOS-CompanyBot/1.0; +https://agentos.ai)",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const meta = extractMetaFromHtml(html);
    return meta.length > 40 ? meta.slice(0, MAX_CHARS_PER_PAGE) : null;
  } catch (err) {
    if (isAbortError(err)) {
      logger.debug({ url }, "html fetch timed out");
    } else {
      logger.warn({ err, url }, "html meta fetch failed");
    }
    return null;
  }
}

/** Prefer fast direct HTML; use Jina only when the page is thin or JS-heavy. */
async function fetchPageContent(
  url: string
): Promise<{ text: string | null; method: WebFetchSource["method"] }> {
  const metaText = await fetchHtmlMeta(url);
  if (metaText && metaText.length >= MIN_USEFUL_HTML_CHARS) {
    return { text: metaText, method: "html_meta" };
  }

  const jinaText = await fetchJinaReader(url);
  if (jinaText) {
    return { text: jinaText, method: "jina_reader" };
  }

  if (metaText) {
    return { text: metaText, method: "html_meta" };
  }

  return { text: null, method: "direct_html" };
}

export async function fetchCompanyWebContext(websiteInput: string): Promise<WebFetchBundle> {
  const origin = normalizeWebsite(websiteInput);
  const urls = [origin, ...SUPPLEMENTAL_PATHS.map((p) => pageUrl(origin, p))];

  const sources: WebFetchSource[] = [];
  const textBlocks: string[] = [];
  const technologies = new Set<string>(["Open Graph / JSON-LD meta", "Jina Reader (fallback)"]);

  for (const url of urls) {
    // Skip extra paths when the homepage already gave enough context.
    if (url !== origin && textBlocks.join("\n").length >= 4_000) {
      break;
    }

    const { text, method } = await fetchPageContent(url);
    if (text) {
      const label =
        method === "jina_reader" ? "Jina Reader" : "HTML meta";
      textBlocks.push(`--- ${url} (${label}) ---\n${text}`);
      sources.push({ url, method, chars: text.length, ok: true });
    } else {
      sources.push({ url, method: "direct_html", chars: 0, ok: false });
    }
  }

  if (!textBlocks.length) {
    throw new Error(
      "Could not fetch readable content from that website. Check the URL or try again later."
    );
  }

  technologies.add("Multi-page crawl (/about, /pricing)");

  return {
    website: origin,
    combinedText: textBlocks.join("\n\n").slice(0, MAX_COMBINED_CHARS),
    sources,
    technologies: [...technologies],
  };
}
