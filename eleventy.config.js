import fs from "node:fs";

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
        .filter((p) => p.data.isPost && p.data.lang === lang && !p.data.scheduled)
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

  // Blog index order: newest published first; posts from the same day keep their hand-set
  // index.order (then slug) so the order within a day stays stable.
  eleventyConfig.addFilter("byPublished", (items) => {
    const date = (p) => String(p.data.index?.published || p.data.published || "");
    const order = (p) => (p.data.index?.order ?? Infinity);
    return [...items].sort(
      (a, b) => date(b).localeCompare(date(a)) || order(a) - order(b) || a.data.slug.localeCompare(b.data.slug)
    );
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

  // Carrier page layout (handoff 6a). Post bodies are plain HTML, so the extra blocks are
  // spliced into the rendered body here instead of being written into every post:
  //   - breadcrumb replaces the "Blog" eyebrow
  //   - quick answer + "On this page" (built from the h2s) go right after .post-meta
  //   - the FAQ goes right before the CTA box
  //   - the first two related links become cards (same-region carrier, then the "5 ways" guide)
  // Pages without the matching front matter are returned unchanged.
  const GUIDE_SLUG = "best-ways-to-bypass-hotspot-throttling";
  const slugify = (s) =>
    s.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, "").toLowerCase().trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

  eleventyConfig.addFilter("enhancePost", (content, o) => {
    let html = content;
    if (o.breadcrumb) {
      html = html.replace(/<div class="page-eyebrow">[^<]*<\/div>\s*/, o.breadcrumb);
    }
    if (o.quick) {
      const h2s = [];
      html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
        const id = slugify(inner);
        h2s.push({ id, text: stripTags(inner) });
        return `<h2 id="${id}">${inner}</h2>`;
      });
      if (o.faq) h2s.push({ id: "faq", text: o.labels.faqShort });
      const toc =
        `    <div class="toc" role="navigation" aria-label="${o.labels.onThisPage}"><span class="toc-label">${o.labels.onThisPage}</span>\n` +
        h2s.map((h, i) => `      <a href="#${h.id}">${i + 1} · ${h.text}</a>\n`).join("") +
        `    </div>\n`;
      html = html.replace(/(<div class="post-meta">[\s\S]*?<\/div>\n?)/, `$1${o.quick}${toc}`);
    }
    if (o.faq) {
      html = html.replace(/(\s*)<div class="cta-box">/, `\n${o.faq}$1<div class="cta-box">`);
    }
    if (o.region && o.posts) {
      html = html.replace(/<div class="related">([\s\S]*?)<\/div>/, (block, inner) => {
        const links = [...inner.matchAll(/<li>(<a href="([^"]+)">[\s\S]*?<\/a>)<\/li>/g)].map((m) => ({
          li: m[1],
          slug: m[2].split("/").pop().replace(/\.html$/, ""),
        }));
        const bySlug = (slug) => o.posts.find((p) => p.data.slug === slug);
        const sameRegion =
          links.find((l) => bySlug(l.slug)?.data.region === o.region) ||
          o.posts
            .filter((p) => p.data.region === o.region && p.data.slug !== o.slug)
            .map((p) => ({ slug: p.data.slug }))[0];
        const picks = [sameRegion, { slug: GUIDE_SLUG }].filter(Boolean).map((l) => bySlug(l.slug)).filter(Boolean);
        if (!picks.length) return block;
        const cards = picks
          .map((p) => {
            const r = p.data.region;
            const eyebrow = r ? r.toLocaleUpperCase(/ü|ı|ş|ğ/i.test(r) ? "tr-TR" : "en-US") : o.labels.guide;
            const title = p.data.cardTitle || p.data.ogTitle || p.data.title;
            return `        <a class="related-card" href="${p.url}"><span class="related-eyebrow">${eyebrow}</span><span class="related-title">${title}</span></a>\n`;
          })
          .join("");
        const pickedSlugs = picks.map((p) => p.data.slug);
        const rest = links.filter((l) => !pickedSlugs.includes(l.slug));
        const h3 = inner.match(/<h3>[\s\S]*?<\/h3>/)?.[0] || "";
        return (
          `<div class="related">\n      ${h3}\n      <div class="related-cards">\n${cards}      </div>\n` +
          (rest.length ? `      <ul>\n${rest.map((l) => `        <li>${l.li}</li>\n`).join("")}      </ul>\n` : "") +
          `    </div>`
        );
      });
    }
    return html;
  });

  // og:image for a post: the generated card from tools/og.mjs when it exists, otherwise the site default.
  eleventyConfig.addFilter("ogImage", (lang, slug) =>
    fs.existsSync(`public/og/${lang}/${slug}.png`) ? `/og/${lang}/${slug}.png` : "/og-image.png"
  );

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: false,
    markdownTemplateEngine: false,
  };
}
