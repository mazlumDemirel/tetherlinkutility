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

  // Sort helper: by a numeric key inside an object field, e.g. sortByKey(posts, "index", "order").
  // Items without that field are left out. An optional fallback key is used when the key is missing,
  // e.g. sortByKey(posts, "index", "ldOrder", "order").
  eleventyConfig.addFilter("sortByKey", (items, field, key, fallbackKey) => {
    const val = (p) => {
      const obj = p.data[field];
      if (!obj) return undefined;
      return obj[key] !== undefined ? obj[key] : fallbackKey ? obj[fallbackKey] : undefined;
    };
    return [...items].filter((p) => val(p) !== undefined).sort((a, b) => val(a) - val(b));
  });

  // sitemap.xml entries: every page with `sitemap` front matter, plus files listed in
  // src/_data/sitemapExtra.json (for passthrough files such as pricing.md), sorted by `order`.
  // Pages without an `order` go last, sorted by URL.
  eleventyConfig.addFilter("sitemapEntries", (pages, extra) => {
    const entries = pages
      .filter((p) => p.data.sitemap)
      .map((p) => ({ url: p.url, ...p.data.sitemap }))
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
