# KARBYVISUAL 

Kompletní, produkčně připravená webová aplikace (portfolio) postavená v duchu brutalistického high-end designu (inspirace Balenciaga / Rick Owens). 

## Technologický Stack
*   **Frontend:** HTML5, CSS3, Vanilla JS (Architektura bez frameworku pro maximální optimalizaci), GSAP (GreenSock) + ScrollTrigger, Lenis Smooth Scroll.
*   **Backend:** Node.js, Express.
*   **Databáze:** SQLite (zvoleno pro jednoduchost nastavení bez nutnosti DB serveru lokálně).
*   **Autentizace:** JWT (v httpOnly cookies), Bcrypt (hashování hesel).
*   **Emailing:** Nodemailer s automatickou HTML odpovědí pro klienta.

## Rychlý Start (Lokální vývoj)

1. **Instalace závislostí:**
    Přejdi do složky s projektem a nainstaluj balíčky.
    ```bash
    npm install
    ```

2. **Konfigurace prostředí:**
    Ve složce již existuje soubor `.env`. Defaultně je nastaveno:
    * `ADMIN_EMAIL=admin@karbyvisual.com`
    * `ADMIN_PASSWORD=admin123`

3. **Spuštění serveru:**
    Serverový skript automaticky nainicializuje databázi a vloží do ní jak administrátora, tak i pár ukázkových (seed) projektů, abys mohl ihned zkusit vizuál na frontendu.
    ```bash
    npm run dev
    ```
    Následně otevři prohlížeč na: **http://localhost:3000**

## Architektura UI & Administrátorská sekce

Web funguje jako velká "One-page" scrollovací canvas plocha s mnoha paralaxními a text-reveal animacemi.
Veškerá logika animací žije odděleně v `public/animations.js`. 

Na webu lze kliknout v patičce na odkaz **ADMIN**. Vyskakovací modal vyzve k přihlášení (defaultně admin@karbyvisual.com / admin123). Po autorizaci a obnovení stránky / validaci se dole objeví krvavě červený "Admin Mode" panel, který umožňuje mazat a přidávat data do gridu archivu.
Obrázky se přenášejí přes Multer do složky `public/uploads/`.
