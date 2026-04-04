const { dbAsync } = require('./db');

async function promote() {
    try {
        await dbAsync.run(
            "UPDATE users SET role = 'admin', full_name = 'KARBY ADMIN' WHERE email = 'admin@karbyvisual.com'"
        );
        console.log('User admin@karbyvisual.com promoted to admin.');
        
        const user = await dbAsync.get("SELECT * FROM users WHERE email = 'admin@karbyvisual.com'");
        console.log('Updated user data:');
        console.table(user);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

promote();
