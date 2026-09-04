// ==========================================================================
// SEO / GEO serverova vrstva
// ==========================================================================
// Duvod existence tohohle souboru:
//
//  1) index.html je staticky soubor, ale canonical a titulek se musi lisit
//     podle jazyka. Bez self-canonical na ?lang=en Google anglickou variantu
//     zahodi jako duplicitu a hreflang par nefunguje.
//
//  2) Sekce recenzi se plnila az fetchem na /api/testimonials. AI crawlery
//     (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot) nespousti JavaScript -
//     videly prazdny <div id="reviews-grid"> bez jedineho slova. Recenze jsou
//     přitom presne ten typ obsahu, ktery jazykove modely citují.
//
// Server proto index.html precte, doplni do nej data a posle uz hotovy.
// Klientsky main.js pak obsah stejne prekresli (dela reviewsGrid.innerHTML = ''
// nez zacne renderovat), takze ke konfliktu ani zdvojeni nedochazi.

const fs = require('fs');
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'https://karbyvisuals.cz').replace(/\/+$/, '');
const INDEX_PATH = path.join(__dirname, 'public', 'index.html');

// --------------------------------------------------------------------------
// Escapovani
// --------------------------------------------------------------------------
// Recenze i nazvy slozek zadava admin pres formular, takze do HTML jdou jako
// nedůvěryhodny vstup. Klientsky render pouziva textContent/innerHTML az po
// escapeAttr, tady musime escapovat sami.
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeXml(value) {
    return escapeHtml(value);
}

// Obsah <script type="application/ld+json"> je raw text, ne HTML - entity se
// v nem NEDEKODUJI. escapeHtml() by tam nechal doslovne "&amp;" a Google by
// nacetl rozbity nazev. Escapujeme proto jako JSON retezec a navic "<", aby
// hodnota nemohla predcasne ukoncit <script> tagem "</script>".
function escapeJsonString(value) {
    return JSON.stringify(String(value == null ? '' : value))
        .slice(1, -1)
        .replace(/</g, '\\u003C');
}

// --------------------------------------------------------------------------
// Jazykove varianty hlavicky
// --------------------------------------------------------------------------
const META = {
    cs: {
        htmlLang: 'cs',
        ogLocale: 'cs_CZ',
        ogLocaleAlt: 'en_US',
        canonical: `${SITE_URL}/`,
        title: 'KARBYVISUALS | Videoklipy, Střih & Fotografie Praha',
        description: 'KARBYVISUALS - Profesionální natáčení hudebních videoklipů, střih videa a komerční fotografie v Praze a okolí. Avantgardní vizuální produkce na klíč.',
        ogTitle: 'KARBYVISUALS | Videoklipy, Střih & Foto Praha',
        ogDescription: 'Profesionální natáčení hudebních videoklipů, střih videa v Praze a umělecká fotografie. Syrová, temná a precizní vizuální tvorba.'
    },
    en: {
        htmlLang: 'en',
        ogLocale: 'en_US',
        ogLocaleAlt: 'cs_CZ',
        canonical: `${SITE_URL}/?lang=en`,
        title: 'KARBYVISUALS | Music Videos, Video Editing & Photography in Prague',
        description: 'KARBYVISUALS - Professional music video production, video editing and commercial photography in Prague, Czech Republic. Full-service avant-garde visual production.',
        ogTitle: 'KARBYVISUALS | Music Videos, Editing & Photo Prague',
        ogDescription: 'Professional music video production, video editing in Prague and artistic photography. Raw, dark and precise visual work.'
    }
};

function resolveLang(req) {
    const raw = req && req.query ? req.query.lang : null;
    return raw === 'en' ? 'en' : 'cs';
}

// --------------------------------------------------------------------------
// Cache sablony
// --------------------------------------------------------------------------
// index.html se cte z disku jen kdyz se zmenil mtime - pri vyvoji se tedy
// zmeny projevi hned, v produkci se soubor necte pri kazdem requestu.
let templateCache = { mtimeMs: 0, html: '' };

function loadTemplate() {
    const stat = fs.statSync(INDEX_PATH);
    if (stat.mtimeMs !== templateCache.mtimeMs) {
        templateCache = {
            mtimeMs: stat.mtimeMs,
            html: fs.readFileSync(INDEX_PATH, 'utf8')
        };
    }
    return templateCache.html;
}

function indexLastModified() {
    try {
        return new Date(fs.statSync(INDEX_PATH).mtime).toISOString().slice(0, 10);
    } catch (err) {
        return new Date().toISOString().slice(0, 10);
    }
}

// --------------------------------------------------------------------------
// Server-side render recenzi
// --------------------------------------------------------------------------
// Struktura musi odpovidat renderTestimonials() v public/main.js, aby se
// stranka pred prevzetim klientskym kodem nerozskakala.
function renderTestimonialsHtml(rows, lang) {
    if (!Array.isArray(rows) || rows.length === 0) return '';

    return rows.map((t) => {
        const quoteCs = t.quote || t.quote_cs || '';
        const quoteEn = t.quote_en || t.quote || t.quote_cs || '';
        const quote = lang === 'cs' ? quoteCs : quoteEn;
        const name = t.client_name || '';
        const handle = name.toLowerCase().replace(/\s/g, '_');
        const avatar = t.avatar_url
            ? t.avatar_url
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111&color=fff&bold=true`;
        const project = t.project && t.project.trim() !== ''
            ? `\n                    <span class="dm-meta">${escapeHtml(t.project)}</span>`
            : '';

        return `                <div class="insta-dm-card reveal-fade">
                    <div class="dm-avatar-wrapper">
                        <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" class="dm-avatar"
                             width="48" height="48" loading="lazy" decoding="async"
                             onerror="this.onerror=null;this.src='/assets/avatar-placeholder.svg'">
                    </div>
                    <div class="dm-content-wrapper">
                        <span class="dm-username">${escapeHtml(handle)}</span>
                        <div class="dm-bubble">
                            <p class="dm-text" data-cs="${escapeHtml(quoteCs)}" data-en="${escapeHtml(quoteEn)}">${escapeHtml(quote)}</p>
                            <div class="dm-scanner-line"></div>
                        </div>${project}
                    </div>
                </div>`;
    }).join('\n');
}

// --------------------------------------------------------------------------
// Slozeni finalniho HTML
// --------------------------------------------------------------------------
function renderIndex(req, testimonials) {
    const lang = resolveLang(req);
    const m = META[lang];
    let html = loadTemplate();

    // Sablona je psana v cestine, takze pro cs staci prepsat jen absolutni
    // URL podle SITE_URL. Pro en meni i texty hlavicky.
    if (SITE_URL !== 'https://karbyvisuals.cz') {
        html = html.split('https://karbyvisuals.cz').join(SITE_URL);
    }

    html = html
        .replace(/<html lang="[^"]*"/, `<html lang="${m.htmlLang}"`)
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(m.title)}</title>`)
        .replace(/(<meta name="description"\s*\n?\s*content=")[\s\S]*?(">)/, `$1${escapeHtml(m.description)}$2`)
        .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${m.canonical}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${escapeHtml(m.ogTitle)}$2`)
        .replace(/(<meta property="og:description"\s*\n?\s*content=")[\s\S]*?(">)/, `$1${escapeHtml(m.ogDescription)}$2`)
        .replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${m.canonical}$2`)
        .replace(/(<meta property="og:locale" content=")[^"]*(">)/, `$1${m.ogLocale}$2`)
        .replace(/(<meta property="og:locale:alternate" content=")[^"]*(">)/, `$1${m.ogLocaleAlt}$2`)
        .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${escapeHtml(m.ogTitle)}$2`)
        .replace(/(<meta name="twitter:description"\s*\n?\s*content=")[\s\S]*?(">)/, `$1${escapeHtml(m.ogDescription)}$2`);

    // WebPage uzel v JSON-LD musi ukazovat na stejnou URL jako canonical,
    // jinak si graf odporuje sam se sebou.
    if (lang === 'en') {
        html = html.replace(
            /("@type": "WebPage",\s*\n\s*"@id": ")[^"]*(",\s*\n\s*"url": ")[^"]*(",\s*\n\s*"name": ")[^"]*(",\s*\n\s*"description": ")[^"]*(",\s*\n\s*"inLanguage": ")[^"]*(")/,
            `$1${SITE_URL}/#webpage-en$2${m.canonical}$3${escapeJsonString(m.title)}$4${escapeJsonString(m.description)}$5en$6`
        );
    }

    // Vlozeni recenzi do prazdneho gridu.
    const cards = renderTestimonialsHtml(testimonials, lang);
    if (cards) {
        html = html.replace(
            /(<div id="reviews-grid">)([\s\S]*?)(<\/div>)/,
            `$1\n${cards}\n            $3`
        );
    }

    return html;
}

// --------------------------------------------------------------------------
// robots.txt
// --------------------------------------------------------------------------
// Explicitni Allow pro AI crawlery je zamer: bez nej se nekteri boti chovaji
// konzervativne a obsah do odpovedi neberou. /api/ a docasne uploady nemaji
// v indexu co delat.
function robotsTxt() {
    return `# robots.txt - KARBYVISUALS
# https://karbyvisuals.cz

User-agent: *
Allow: /
Disallow: /api/
Disallow: /uploads/tmp/

# --- Vyhledavace ---
User-agent: Googlebot
Allow: /
Disallow: /api/

User-agent: Googlebot-Image
Allow: /

User-agent: Bingbot
Allow: /
Disallow: /api/

User-agent: Seznam screenshot-generator
Allow: /

User-agent: SeznamBot
Allow: /
Disallow: /api/

# --- AI / GEO crawlery ---
# Povoleno zamerne: chceme, aby nas modely citovaly v odpovedich.
User-agent: GPTBot
Allow: /
Disallow: /api/

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /
Disallow: /api/

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /
Disallow: /api/

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot
Allow: /
Disallow: /api/

User-agent: Applebot-Extended
Allow: /

User-agent: Amazonbot
Allow: /
Disallow: /api/

User-agent: meta-externalagent
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// --------------------------------------------------------------------------
// sitemap.xml
// --------------------------------------------------------------------------
// Jednostrankovy web, ale obe jazykove varianty musi byt uvedene vzajemne
// provazane pres xhtml:link, jinak Google hreflang par neuzna.
function sitemapXml() {
    const lastmod = indexLastModified();
    const alternates = [
        `        <xhtml:link rel="alternate" hreflang="cs-CZ" href="${escapeXml(SITE_URL)}/"/>`,
        `        <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(SITE_URL)}/?lang=en"/>`,
        `        <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(SITE_URL)}/"/>`
    ].join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
    <url>
        <loc>${escapeXml(SITE_URL)}/</loc>
${alternates}
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${escapeXml(SITE_URL)}/?lang=en</loc>
${alternates}
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>
`;
}

module.exports = {
    SITE_URL,
    INDEX_PATH,
    renderIndex,
    robotsTxt,
    sitemapXml,
    escapeHtml,
    escapeJsonString
};
