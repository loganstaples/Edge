import RssParser from "rss-parser";
import { isDuplicate } from "@/lib/utils/dedup";

const parser = new RssParser();

interface RawArticle {
  title: string;
  description: string | null;
  source: string;
  url: string | null;
  publishedAt: string;
  category: string | null;
}

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE = "https://newsapi.org/v2";

export async function fetchNewsAPIHeadlines(category?: string): Promise<RawArticle[]> {
  if (!NEWS_API_KEY) {
    console.warn("NEWS_API_KEY not set, skipping NewsAPI");
    return [];
  }
  const params = new URLSearchParams({
    apiKey: NEWS_API_KEY,
    language: "en",
    pageSize: "20",
  });
  if (category) params.set("category", category);

  const res = await fetch(`${NEWS_API_BASE}/top-headlines?${params}`);
  if (!res.ok) {
    console.error(`NewsAPI error: ${res.status}`);
    return [];
  }
  const json = await res.json();
  return (json.articles ?? []).map((a: any) => ({
    title: a.title ?? "",
    description: a.description ?? null,
    source: a.source?.name ?? "Unknown",
    url: a.url ?? null,
    publishedAt: a.publishedAt ?? new Date().toISOString(),
    category: category ?? null,
  }));
}

const RSS_FEEDS = [
  { url: "https://feeds.reuters.com/reuters/topNews", source: "Reuters" },
  { url: "https://feeds.bbci.co.uk/news/rss.xml", source: "BBC News" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", source: "NY Times" },
];

export async function fetchRSSArticles(): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items?.slice(0, 15) ?? []) {
        if (!item.title) continue;
        articles.push({
          title: item.title,
          description: item.contentSnippet ?? item.content ?? null,
          source: feed.source,
          url: item.link ?? null,
          publishedAt: item.isoDate ?? new Date().toISOString(),
          category: null,
        });
      }
    } catch (err) {
      console.error(`RSS fetch failed for ${feed.source}:`, err);
    }
  }

  return articles;
}

/**
 * Fetch historical articles from NewsAPI /everything endpoint.
 * Supports date range and keyword filtering for backtesting.
 * Free tier: up to 1 month back, 100 results per page.
 */
export async function fetchHistoricalNews(opts: {
  keywords?: string;
  from: string;   // ISO date, e.g. "2026-03-20"
  to: string;     // ISO date
  pageSize?: number;
}): Promise<RawArticle[]> {
  if (!NEWS_API_KEY) return [];

  const params = new URLSearchParams({
    apiKey: NEWS_API_KEY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(opts.pageSize ?? 30),
    from: opts.from,
    to: opts.to,
  });

  // Use keyword search if provided, otherwise broad business/politics query
  if (opts.keywords && opts.keywords.trim()) {
    params.set("q", opts.keywords.trim());
  } else {
    params.set("q", "economy OR politics OR markets OR election OR crisis");
  }

  try {
    const res = await fetch(`${NEWS_API_BASE}/everything?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.articles ?? [])
      .filter((a: any) => a.title && a.title !== "[Removed]")
      .map((a: any) => ({
        title: a.title ?? "",
        description: a.description ?? null,
        source: a.source?.name ?? "Unknown",
        url: a.url ?? null,
        publishedAt: a.publishedAt ?? opts.from,
        category: null,
      }));
  } catch {
    return [];
  }
}

export async function ingestAllNews(existingTitles: string[]): Promise<RawArticle[]> {
  const categories = ["business", "technology", "science", "politics"];
  const allArticles: RawArticle[] = [];

  const randomCat = categories[Math.floor(Math.random() * categories.length)];
  const newsApiArticles = await fetchNewsAPIHeadlines(randomCat);
  allArticles.push(...newsApiArticles);

  const rssArticles = await fetchRSSArticles();
  allArticles.push(...rssArticles);

  const deduped: RawArticle[] = [];
  const allTitles = [...existingTitles];

  for (const article of allArticles) {
    if (!article.title || article.title.length < 10) continue;
    if (isDuplicate(article.title, allTitles)) continue;
    allTitles.push(article.title);
    deduped.push(article);
  }

  return deduped;
}
