const { dbAsync } = require('./db');

async function check() {
    try {
        const users = await dbAsync.all('SELECT id, email, full_name, role FROM users');
        console.log('--- USERS ---');
        console.table(users);
        
        const messages = await dbAsync.all('SELECT * FROM messages');
        console.log('\n--- MESSAGES ---');
        console.table(messages);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
