# KARBYVISUAL — Analýza & Mobilní Optimalizace (aktualizováno)

## KONTEXT PROJEKTU

Portfolio web **KARBYVISUALS** (Sam Karban) — cinematographer & photographer z ČR.

**Stack:**
- Frontend: vanilla HTML/CSS/JS (`public/index.html`, `public/style.css`, `public/main.js`, `public/animations.js`)
- Backend: Node.js + Express + SQLite (server.js)
- Animace: GSAP 3 + Lenis smooth scroll + ScrollTrigger + SplitType
- Ikony: Phosphor Icons
- Fonty: `Space Grotesk` (heading), `Inter` (body), `JetBrains Mono` (mono/UI labely)

---

## OPRAVA — BAREVNÁ PALETA

V první verzi tohoto dokumentu jsem chybně napsal, že web má "sekundárně oranžovou" barvu jako součást brand identity. Po opětovné kontrole `:root` proměnných ve `style.css` to **není pravda**:

```css
:root {
    --bg-color: #000000;      /* Pure Cinematic Black */
    --text-primary: #ffffff;
    --accent: #ffffff;         /* Čistě bílá / Stříbrná místo zelené */
    --metallic: linear-gradient(135deg, #ffffff 0%, #a0a0a0 50%, #404040 100%);
    --border-color: #1a1a1a;
}
```

Žádná `--accent-orange` proměnná neexistuje. Barva `#ff9500` se v kódu objevuje pouze na 3 izolovaných místech, natvrdo zapsaná (ne jako token):
- `.gb-orange` — jeden ambientní glow-blob na pozadí (`background: #ff9500`, velmi nízká opacity)
- `.node-port.orange` / `.node-path.orange` — barevná varianta CAD/diagram konektorů (admin/dashboard UI prvek)
- `text-stroke: 1px #ff9500` na `.hero-sales-title span.accent` — jen tenký obrys textu

**Skutečná paleta webu je černobílá s metalickým akcentem** (`--metallic` gradient bílá→šedá), žádná sekundární brand barva. Mobilní úpravy níže s touto skutečností pracují a žádnou barvu nepřidávají ani neměnily.

---

## STAV PROJEKTU PO ÚPRAVÁCH

Všechny úpravy popsané níže **už jsou implementované přímo v repozitáři** (provedeny pomocí `str_replace` na `index.html`, `style.css`, `animations.js`). Tento dokument slouží jako changelog a referenční prompt, pokud bys chtěl stejné zadání zopakovat na jiném projektu nebo to nechat zkontrolovat jiným nástrojem/vývojářem.

**Design jazyk, který zůstal 100% zachován:**
- Brutalistická estetika, cinematic černá (`#000000`), čistě bílý akcent (`#ffffff`)
- Monospace labely (`JetBrains Mono`), CAD/blueprint UI prvky
- Scanlines, noise textura (`--noise-bg`), UI crosshairs, data ticker (skryty jen na mobilu, ne odstraněny)
- GSAP reveal animace, Lenis smooth scroll
- Militaristická/taktická terminologie (TRANSMISSION, UPLINK, SYS.INIT...)
- „Folder" archivní systém v portfolio sekci

---

## 1. HAMBURGER MENU — OPRAVENO (byl kritický bug)

**Původní stav:** `.mobile-menu-btn` existoval v HTML a zobrazoval se pod 991px, ale nikde v `main.js` ani `animations.js` neexistoval event listener. Kliknutí nedělalo nic.

**Implementováno:**

`index.html` — přidán `<div class="mobile-nav-drawer" id="mobile-drawer">` s navigací, lang-switcherem a Instagram odkazem, plus `<div class="mobile-drawer-overlay" id="mobile-drawer-overlay">`, obojí před `</body>`.

`animations.js` — přidána funkce `initMobileMenu()`:
- otevírání/zavírání draweru (`openMenu` / `closeMenu`)
- přepnutí ikony `ph-list` → `ph-x`
- `window.lenis.stop()` / `.start()` při otevření/zavření (zastaví smooth scroll pod menu)
- zavření po kliknutí na link, na overlay, nebo klávesou Escape
- synchronizace CS/EN tlačítek v draweru s funkcí `switchLanguage()` z `main.js`

`style.css` — `.mobile-nav-drawer` s `transform: translateX(100%)` → `.open { translateX(0) }`, plný viewport (`100dvh`), `env(safe-area-inset-top/bottom)` pro iOS notch, stejná `--noise-bg` textura jako zbytek webu.

---

## 2. NAVBAR — OPRAVENO

Lang-switcher z hlavního navbaru na `≤991px` skrytý (`display: none`) — přesunutý do draweru, aby navbar nebyl přeplněný. Burger má touch target `44×44px`.

---

## 3. HERO SEKCE — OPRAVENO

- `.hero-subline` `letter-spacing` snížen z `0.3em` na `0.08–0.12em` podle breakpointu (přetékal mimo viewport)
- `.giant-branding` přepsán na `clamp()` škálování
- `.hero-sales-actions` na mobilu `flex-direction: column`, tlačítka `width: 100%`
- `.cad-dim-w` / `.cad-dim-h` (dekorativní "320.00mm" labely) na mobilu skryté — dávají smysl jen v desktop CAD kontextu

---

## 4. ABOUT SEKCE — OPRAVENO

`.about-me-photo-container` má na `≤768px` `order: -1` → foto je nahoře, text pod ním (vizuální záchytný bod jako první). Dekorativní offset rám (`::after`) na mobilu skrytý.

---

## 5. BENTO GRID — OPRAVENO

Inline `style="grid-template-columns: 1fr 1fr"` v HTML byl problém — nelze přepsat z CSS bez `!important`. Řešení: media query `≤480px` s `grid-template-columns: 1fr !important`.

---

## 6. ARCHIV (SLOŽKY) — OPRAVENO

`.folder-icon-wrap` zmenšen na `90px` (`≤480px`) a `75px` (`≤375px`), aby ikony nevypadaly nataženě na malém displeji.

---

## 7. FOLDER MODAL — OPRAVENO

Na `≤768px` je `.folder-content-modal` fullscreen (`100vw × 100dvh`, bez borderů/radius). Mac-style dot controls (`.window-controls-left`) skryté — na mobilu nedávají smysl. Close tlačítko zvětšeno na `44×44px`.

---

## 8. KONTAKTNÍ FORMULÁŘ — OPRAVENO

- `.matrix-grid label` (radio buttony pro typ projektu/rozpočet) má `min-height: 44px` — touch-friendly
- **iOS auto-zoom fix**: `input, textarea, select { font-size: 16px !important }` na `≤768px` — bez toho iOS Safari při focusu na input automaticky přiblíží celou stránku
- `.form-row-v3` a `.options-matrix` na `≤480px` přechází na jeden sloupec

---

## 9. UI CROSSHAIRS & DATA TICKER — OPRAVENO

`.ui-frame` (rohové crosshairs) a `.bg-data-ticker` na `≤768px` skryté (`display: none`) — na malém displeji působily jako vizuální šum / riziko horizontálního overflow. Desktop verze beze změny.

---

## 10. LENIS SMOOTH SCROLL — OPRAVENO

```javascript
const _isMobile = window.innerWidth <= 768;
const lenis = new Lenis({
    duration: _isMobile ? 1.0 : 1.2,
    touchMultiplier: _isMobile ? 1.2 : 2, // bylo 2 i na mobilu — moc rychlé
    ...
});
```

---

## 11. VIEWPORT META — OPRAVENO

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```
Přidáno `viewport-fit=cover` pro správnou práci s iOS notch / Dynamic Island.

---

## 12. LIGHTBOX MODAL — OPRAVENO

Na `≤768px` fullscreen (`100vw × 100dvh`), bez borderů, `#lightbox-media-container` omezen na `max-height: 55dvh` aby zbylo místo pro ovládací prvky pod/nad médiem.

---

## 13. FOOTER — OPRAVENO

`padding-bottom: max(3vh, calc(2vh + env(safe-area-inset-bottom, 12px)))` — řeší zakrytí obsahu iOS home indicatorem na telefonech bez tlačítka.

---

## 14. OBECNÝ SPACING — OPRAVENO

`.bordered-section` padding snížen ze desktopové hodnoty na `7vh` (`≤768px`) / `6vh` (`≤480px`) — desktopových `10vh` na malém displeji znamenalo zbytečně moc prázdného prostoru mezi sekcemi.

---

## NEPROVEDENO / DOPORUČENO K DALŠÍMU OVĚŘENÍ

Tyto body byly v původním promptu navržené, ale **vyžadují vizuální test v prohlížeči**, ne jen úpravu kódu naslepo — doporučuju je zkontrolovat na reálném zařízení nebo v DevTools před finálním nasazením:

- **Reviews sekce** — `#reviews-grid` na mobilu; nemám jistotu, zda karty (`.review-card` / `.insta-dm-card`) mají v HTML přesně tyto třídy, takže CSS pro padding nebyl plošně nasazen bez ověření selektorů
- **Preloader délka na mobilu** — vyžaduje úpravu JS timing logiky, kterou jsem nechal beze zásahu, abych neriskoval rozbití existující sekvence
- **`prefers-reduced-motion`** — GSAP globální timeline úprava nebyla nasazena, protože by mohla ovlivnit i admin/dashboard interakce; doporučuju přidat jen pro `reveal-*` třídy izolovaně
- **Hero video container** (`.hs-video-container`) na `≤480px` — `min-height` a `aspect-ratio` doporučení zůstává k ověření podle skutečného HTML markupu videa

---

## TESTOVACÍ CHECKLIST

- [ ] iPhone SE (375×667)
- [ ] iPhone 14 Pro (393×852) — Dynamic Island
- [ ] Samsung Galaxy S23 (360×780)
- [ ] iPad mini (768×1024)

Pro každé zařízení:
- [ ] Hamburger menu se otevře/zavře, ikona se přepíná list↔x
- [ ] Nav linky v draweru fungují a zavřou menu po kliknutí
- [ ] Hero sekce bez horizontálního scrollu
- [ ] Tlačítka tapnutelná (min 44px)
- [ ] Klik do inputu formuláře nezoomuje stránku (iOS)
- [ ] Folder modal je fullscreen, close tlačítko funguje
- [ ] Smooth scroll nepůsobí přepáleně rychle
- [ ] Cookie banner ani footer není zakryt home indicatorem

---

## POZNÁMKY K DESIGNU

- Paleta zůstává černobílá s metalickým akcentem — **žádná oranžová ani jiná barva nebyla do mobilní verze přidána**
- Brutalistická estetika zachována — žádné nové zaoblené rohy, žádné měkké stíny
- Scanlines a noise textura zůstávají na všech breakpointech
- Monospace labely (TRANSMISSION, UPLINK...) zůstávají, jen menší font-size
- CAD dimension labely (320.00mm) jsou skryté jen na mobilu — na desktopu beze změnys