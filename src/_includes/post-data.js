// Shared directory data for blog posts. Each language's blog folder
// (src/blog, src/tr/blog, src/hi/blog) calls this with its language code.
// A post's URL is the file name: src/tr/blog/foo.html -> /tr/blog/foo.html
// Build date as YYYY-MM-DD in Istanbul time (the deploy runs early in the morning, UTC).
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

export default function postData(lang) {
  const prefix = lang === "en" ? "/" : `/${lang}/`;
  return {
    lang,
    isPost: true,
    layout: "layouts/post.njk",
    // Defaults for sitemap.xml; a post can override any of these (and set `order`)
    // in its own front matter. lastmod defaults to the post's `modified` date.
    sitemap: { changefreq: "monthly", priority: "0.6" },
    eleventyComputed: {
      slug: (data) => data.page.fileSlug,
      // A post whose `published` date is still in the future is not built yet. The deploy
      // workflow runs every morning, so it goes live on that date without another commit.
      scheduled: (data) => String(data.published || "") > today(),
      eleventyExcludeFromCollections: (data) => String(data.published || "") > today(),
    },
    permalink: (data) =>
      String(data.published || "") > today() ? false : `${prefix}blog/${data.page.fileSlug}.html`,
  };
}
