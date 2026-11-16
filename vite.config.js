import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const DESCRIPTION =
  'Play free in your browser as a white blood cell fighting bacteria, viruses and parasites. 3D arcade action with power-ups and bosses on desktop and mobile.'

// SEO tags that need an absolute URL (canonical, og:url, share images, JSON-LD) plus robots.txt
// and sitemap.xml. Set SITE_URL (e.g. in .env.production) to the deployed origin before building.
function seo(siteUrl) {
  const base = (siteUrl || '').replace(/\/+$/, '')
  const abs = (path) => (base ? `${base}${path}` : path)
  return {
    name: 'cell-defender-seo',
    transformIndexHtml() {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: 'Cell Defender',
        description: DESCRIPTION,
        genre: ['Arcade', 'Action', 'Shooter'],
        gamePlatform: ['Web browser', 'Desktop', 'Mobile'],
        applicationCategory: 'Game',
        operatingSystem: 'Any',
        playMode: 'SinglePlayer',
        image: abs('/og-image.png'),
        inLanguage: 'en',
        isAccessibleForFree: true,
        ...(base && { url: `${base}/` }),
      }
      const tags = [
        { tag: 'meta', attrs: { property: 'og:image', content: abs('/og-image.png') } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: abs('/og-image.png') } },
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(jsonLd) },
      ]
      if (base) {
        tags.unshift(
          { tag: 'link', attrs: { rel: 'canonical', href: `${base}/` } },
          { tag: 'meta', attrs: { property: 'og:url', content: `${base}/` } },
        )
      }
      return tags.map((t) => ({ ...t, injectTo: 'head' }))
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ''}`,
      })
      if (base) {
        const today = new Date().toISOString().slice(0, 10)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`,
        })
      } else {
        this.warn('SITE_URL is not set: canonical/og:url tags and sitemap.xml were skipped, share images use relative URLs.')
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/arcade/cell-defender/',
    build: { outDir: 'dist/arcade/cell-defender', emptyOutDir: true },
    plugins: [react(), seo(env.SITE_URL)],
  }
})
