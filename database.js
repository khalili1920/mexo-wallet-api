const Database = require("better-sqlite3");

const db = new Database("mexo.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    username TEXT,
    wallet_address TEXT UNIQUE,
    verified INTEGER DEFAULT 0,
    created_at TEXT
)
`).run();


function saveWallet(data){

    const stmt = db.prepare(`
    INSERT INTO users
    (
        telegram_id,
        username,
        wallet_address,
        verified,
        created_at
    )

    VALUES
    (
        ?,
        ?,
        ?,
        ?,
        ?
    )

    ON CONFLICT(wallet_address)
    DO UPDATE SET
    verified=excluded.verified
    `);


    stmt.run(
        data.telegram_id,
        data.username,
        data.wallet_address,
        data.verified,
        new Date().toISOString()
    );

}


module.exports = {
    saveWallet
};
