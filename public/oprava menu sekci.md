# Implementation Plan — Mobile Menu Redesign & Scroll Fix

We need to fix and redesign the mobile menu drawer to:
1. Cover the entire screen (**fullscreen**) in mobile/tablet viewports.
2. Fix the navigation link scroll bug where clicking links does not scroll the page properly.
3. Design a striking, modern brutalist cinematic layout that harmonizes with the rest of the site (using massive typography, numerical markers, liquid chrome hover gradients, and tactical grid overlays).

---

## Proposed Changes

### 1. HTML Markup (`public/index.html`)
- Modify the mobile menu links inside `<div class="mobile-nav-links">` to include numerical prefixes as attributes (e.g., `data-index="01"`, `data-index="02"`, etc.) so that they can be styled cleanly in CSS without breaking language translations.
- Add decorative tactical elements (corner crosshairs `.ui-crosshair` and a container frame) inside the drawer to align it with the CAD/blueprint aesthetic of the homepage.

#### [MODIFY] [index.html](file:///c:/Users/Fajlajp/Desktop/KARBYVISUAL/public/index.html)
- Lines 1506–1538: Update the `.mobile-nav-drawer` structure to include `data-index` attributes on the links and add structural corner hooks.

---

### 2. Stylesheets (`public/style.css`)
- Redesign the `.mobile-nav-drawer` class:
  - Remove `max-width: 400px` and set `width: 100vw; height: 100dvh;` for a full viewport presentation.
  - Set a beautiful blueprint grid backdrop via CSS linear-gradient.
  - Change the entrance transition from a simple slide-from-right to a premium fullscreen slide-down from the top (`transform: translateY(-100%)` to `translateY(0)`) or slide-from-bottom.
- Style `.mobile-nav-links` and `.mobile-nav-link` for high visual impact:
  - Massive headings using `font-family: var(--font-heading)` and `clamp()` font scaling.
  - Monospace index markers (`01`, `02`, etc.) positioned adjacent to links.
  - Liquid chrome text gradient (`var(--metallic)`) on hover/active states.
  - Bracket reveal transition: `[ LINK_TEXT ]` styling when a user hovers.
- Clean up margins and spacing to ensure elements never overflow, even on small screens (like iPhone SE).

#### [MODIFY] [style.css](file:///c:/Users/Fajlajp/Desktop/KARBYVISUAL/public/style.css)
- Lines 8200–8346: Replace the existing drawer and link selectors with the new premium design rules.

---

### 3. JavaScript (`public/animations.js`)
- Fix the scroll lock issue when clicking mobile navigation links:
  - Intercept the click event on `.mobile-nav-link`.
  - Prevent default browser anchor jump.
  - Call `closeMenu()` to restore Lenis smooth scrolling and remove `modal-open` from body.
  - Use `window.lenis.scrollTo(targetElement, { offset: -60, duration: 1.0 })` after a brief timeout (allowing the menu exit animation to start) for a smooth scroll transition.
- Trigger the typewriter log diagnostics when the menu opens if appropriate, or ensure active class states are set.

#### [MODIFY] [animations.js](file:///c:/Users/Fajlajp/Desktop/KARBYVISUAL/public/animations.js)
- Lines 438–504: Update `initMobileMenu()` function with the new navigation intercept logic.

---

## Verification Plan

### Manual Verification
1. **Viewport Sizes:** Test in Chrome/Safari Developer Tools on multiple simulated mobile devices (e.g. iPhone SE, iPhone 14 Pro, iPad).
2. **Opening/Closing:** Clicking the hamburger menu (3 lines) smoothly reveals the fullscreen menu from the top/right, changing the icon to `ph-x`.
3. **Scroll Action:** Clicking a section link (e.g., *ARCHIV*, *KONTAKT*) closes the menu immediately and scrolls the main page smoothly to the selected section.
4. **Visual Aesthetics:** Verify the text styling, metallic hover state, and background grid overlay.
