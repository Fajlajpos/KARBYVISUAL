const { dbAsync } = require('../db');

async function check() {
    try {
        const items = await dbAsync.all('SELECT id, title, category, media_url, thumbnail_url FROM portfolio_items');
        console.log('--- PORTFOLIO ITEMS ---');
        console.table(items);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
