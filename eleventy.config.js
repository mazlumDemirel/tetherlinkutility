// Eleventy config for tetherlinkutility.com
// Source pages live in src/, static files in public/ (copied as-is), output goes to _site/.

export default function (eleventyConfig) {
  // Everything in public/ is copied to the site root unchanged
  // (images, video, downloads/, tools/, CNAME, robots.txt, pricing.md, redirect stubs, ...).
  eleventyConfig.addPassthroughCopy({ public: "/" });

  // Page bodies are written as plain HTML: do not run them through a template engine,
  // so the content is copied into the layout exactly as written.
  eleventyConfig.setNunjucksEnvironmentOptions({
    autoescape: false,
    throwOnUndefined: false,
  });

  // Blog posts per language, used by the blog index pages, sitemap.xml and llms.txt.
  for (const lang of ["en", "tr", "hi"]) {
    eleventyConfig.addCollection(`posts_${lang}`, (api) =>
      api
        .getAll()
        .filter((p) => p.data.isPost && p.data.lang === lang)
        .sort((a, b) => a.data.slug.localeCompare(b.data.slug))
    );
  }

  // Sort helper for hand-ordered lists (blog index, its JSON-LD, llms.txt):
  // sortByKey(posts, "index", "order") sorts by data.index.order. An optional fallback key is
  // used when the key is missing, e.g. sortByKey(posts, "index", "ldOrder", "order").
  // Posts with no value at all are not dropped: they go first (placement "first", used by the
  // blog index so a new post shows at the top) or last ("last"), newest first.
  eleventyConfig.addFilter("sortByKey", (items, field, key, fallbackKey, placement = "last") => {
    const val = (p) => {
      const obj = p.data[field];
      if (!obj) return undefined;
      return obj[key] !== undefined ? obj[key] : fallbackKey ? obj[fallbackKey] : undefined;
    };
    const known = items.filter((p) => val(p) !== undefined).sort((a, b) => val(a) - val(b));
    const unknown = items
      .filter((p) => val(p) === undefined)
      .sort((a, b) => String(b.data.published).localeCompare(String(a.data.published)));
    return placement === "first" ? [...unknown, ...known] : [...known, ...unknown];
  });

  // True if a blog post with this file name exists in that language (for hreflang and
  // the language menu, so a post that is not translated yet does not link to a missing page).
  eleventyConfig.addFilter("hasPost", (collections, lang, slug) =>
    (collections[`posts_${lang}`] || []).some((p) => p.data.slug === slug)
  );

  // Turns the few HTML entities used in titles back into plain text (for llms.txt).
  eleventyConfig.addFilter("plainText", (s) =>
    String(s).replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  );

  // sitemap.xml entries: every page with `sitemap` front matter, plus files listed in
  // src/_data/sitemapExtra.json (for passthrough files such as pricing.md), sorted by `order`.
  // Pages without an `order` go last, sorted by URL.
  eleventyConfig.addFilter("sitemapEntries", (pages, extra) => {
    const entries = pages
      .filter((p) => p.data.sitemap)
      .map((p) => ({
        url: p.url,
        ...p.data.sitemap,
        lastmod: p.data.sitemap.lastmod || p.data.modified || p.data.published,
      }))
      .concat(extra || []);
    const key = (e) => (e.order === undefined ? Infinity : e.order);
    return entries.sort((a, b) => key(a) - key(b) || a.url.localeCompare(b.url));
  });

  // Human-readable dates for the blog index cards, e.g. "September 25, 2026",
  // "25 Eylül 2026", "25 सितंबर, 2026".
  const MONTHS = {
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
    hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  };
  eleventyConfig.addFilter("displayDate", (iso, lang) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    const month = MONTHS[lang][m - 1];
    if (lang === "en") return `${month} ${d}, ${y}`;
    if (lang === "hi") return `${d} ${month}, ${y}`;
    return `${d} ${month} ${y}`;
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: false,
    markdownTemplateEngine: false,
  };
}
