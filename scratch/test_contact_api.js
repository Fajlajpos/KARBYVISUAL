async function test() {
    const url = 'http://localhost:3001/api/contact';
    const payload = {
        name: 'Test User',
        email: 'test@example.com',
        instagram: 'test_ig',
        project_type: 'VIDEO',
        budget: '10k',
        message: 'Hello world'
    };

    console.log('--- STARTING CONTACT API TESTS ---');

    // Test 1: Valid email, should succeed
    console.log('Test 1: Valid submission (1/3)');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`Status: ${res.status}, Response:`, data);
    } catch(err) {
        console.error('Fetch failed:', err.message);
    }

    // Test 2: Invalid email, should return 400
    console.log('\nTest 2: Invalid email submission');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, email: 'invalid-email' })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}, Response:`, data);
    } catch(err) {
        console.error('Fetch failed:', err.message);
    }

    // Test 3: Valid email, submission 2/3 (should succeed)
    console.log('\nTest 3: Valid submission (2/3)');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`Status: ${res.status}, Response:`, data);
    } catch(err) {
        console.error('Fetch failed:', err.message);
    }

    // Test 4: Valid email, submission 3/3 (should succeed)
    console.log('\nTest 4: Valid submission (3/3)');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`Status: ${res.status}, Response:`, data);
    } catch(err) {
        console.error('Fetch failed:', err.message);
    }

    // Test 5: Valid email, submission 4/3 (should be blocked by rate limit - 429)
    console.log('\nTest 5: Rate limited submission (4/3) - should return 429');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`Status: ${res.status}, Response:`, data);
    } catch(err) {
        console.error('Fetch failed:', err.message);
    }
}

test();
