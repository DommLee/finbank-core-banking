const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGODB_URL;
const databaseName = process.env.MONGODB_DB_NAME || 'finbank';
const apiBaseUrl = (process.env.FINBANK_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const email = process.env.SEED_USER_EMAIL || 'ceo@finbank.com';
const password = process.env.SEED_USER_PASSWORD;

if (!mongoUrl) {
    throw new Error('MONGODB_URL environment variable is required.');
}

if (!password) {
    throw new Error('SEED_USER_PASSWORD environment variable is required.');
}

async function main() {
    console.log(`[1] Registering ${email}...`);
    try {
        const res = await fetch(`${apiBaseUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role: 'customer' })
        });
        const data = await res.json();
        console.log('Register response:', res.status, data);
    } catch (err) {
        console.error('Fetch error:', err.message);
    }

    console.log(`[2] Connecting to MongoDB...`);
    const client = new MongoClient(mongoUrl);
    try {
        await client.connect();
        const db = client.db(databaseName);

        console.log(`[3] Updating user role to 'ceo'...`);
        const updateResult = await db.collection('users').updateOne(
            { email: email },
            { $set: { role: 'ceo' } }
        );
        console.log('Updated user role! Modified:', updateResult.modifiedCount);

    } finally {
        await client.close();
    }
}

main().catch(console.error);