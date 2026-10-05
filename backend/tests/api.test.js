const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const connectDB = require('../src/config/db');
const app = require('../src/app');

let mongoServer;
let server;
let baseUrl;

const makeRequest = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
};

const runTests = async () => {
  console.log('\n==================================================');
  console.log('STARTING SMART EXPENSE TRACKER BACKEND TEST SUITE');
  console.log('==================================================\n');

  try {
    process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.USE_MEMORY_DB = 'true';

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await connectDB(mongoUri);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Test server running at ${baseUrl}`);
        resolve();
      });
    });

    let tokenUserA;
    let tokenUserB;
    let userAId;
    let userBId;
    let transactionA1Id;

    console.log('\n[1] Testing GET /api/health');
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'Health check returns status 200');
    assert(healthRes.body.status === 'healthy', 'Health status is "healthy"');
    assert(healthRes.body.database === 'connected', 'Database status is "connected"');

    console.log('\n[2] Testing User A Registration (POST /api/auth/register)');
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'User Alice',
      email: 'alice@example.com',
      password: 'Password@123'
    });
    assert(regRes.status === 201, 'Registration returns status 201');
    assert(regRes.body.success === true, 'Response contains success=true');
    assert(regRes.body.token !== undefined, 'JWT token is returned');
    assert(regRes.body.user.password === undefined, 'Password is NOT exposed in user payload');
    tokenUserA = regRes.body.token;
    userAId = regRes.body.user._id;

    console.log('\n[3] Testing Duplicate Email Registration');
    const dupRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Alice Duplicate',
      email: 'alice@example.com',
      password: 'Password@123'
    });
    assert(dupRes.status === 400, 'Duplicate registration returns status 400');
    assert(dupRes.body.success === false, 'Response contains success=false');

    console.log('\n[4] Testing User Login (POST /api/auth/login)');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'alice@example.com',
      password: 'Password@123'
    });
    assert(loginRes.status === 200, 'Login returns status 200');
    assert(loginRes.body.token !== undefined, 'Login returns JWT token');

    console.log('\n[5] Testing Get Profile (GET /api/auth/me)');
    const meRes = await makeRequest('GET', '/api/auth/me', null, tokenUserA);
    assert(meRes.status === 200, 'Get profile returns status 200');
    assert(meRes.body.user.email === 'alice@example.com', 'Returns profile of logged-in user');

    console.log('\n[6] Testing Transaction Creation (POST /api/transactions)');
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();

    await makeRequest('POST', '/api/transactions', {
      type: 'expense',
      amount: 2000,
      category: 'Shopping',
      description: 'Past month clothes',
      date: new Date(currYear, currMonth - 1, 10).toISOString()
    }, tokenUserA);

    const incRes = await makeRequest('POST', '/api/transactions', {
      type: 'income',
      amount: 40000,
      category: 'Salary',
      description: 'Monthly Paycheck',
      date: new Date(currYear, currMonth, 1).toISOString()
    }, tokenUserA);
    assert(incRes.status === 201, 'Income transaction created with 201');

    const expRes1 = await makeRequest('POST', '/api/transactions', {
      type: 'expense',
      amount: 1500,
      category: 'Food',
      description: 'Grocery shopping',
      date: new Date(currYear, currMonth, 2).toISOString()
    }, tokenUserA);
    assert(expRes1.status === 201, 'Expense transaction created with 201');
    transactionA1Id = expRes1.body.data._id;

    await makeRequest('POST', '/api/transactions', {
      type: 'expense',
      amount: 3800,
      category: 'Shopping',
      description: 'New gadget purchase',
      date: new Date(currYear, currMonth, 5).toISOString()
    }, tokenUserA);

    console.log('\n[7] Testing GET /api/transactions with Pagination');
    const getTxRes = await makeRequest('GET', '/api/transactions?page=1&limit=2', null, tokenUserA);
    assert(getTxRes.status === 200, 'Get transactions returns status 200');
    assert(getTxRes.body.pagination.currentPage === 1, 'Pagination currentPage is 1');
    assert(getTxRes.body.pagination.limit === 2, 'Pagination limit is 2');
    assert(getTxRes.body.data.length === 2, 'Returned data array respects pagination limit');

    console.log('\n[8] Testing Filtering Query Parameters');
    const filterCatRes = await makeRequest('GET', '/api/transactions?category=Food', null, tokenUserA);
    assert(filterCatRes.status === 200, 'Filter by category returns status 200');
    assert(filterCatRes.body.data.every((t) => t.category === 'Food'), 'All returned transactions are in Food category');

    const filterTypeRes = await makeRequest('GET', '/api/transactions?type=income', null, tokenUserA);
    assert(filterTypeRes.status === 200, 'Filter by type returns status 200');
    assert(filterTypeRes.body.data.every((t) => t.type === 'income'), 'All returned transactions are type income');

    console.log('\n[9] Testing GET /api/transactions/:id');
    const getOneRes = await makeRequest('GET', `/api/transactions/${transactionA1Id}`, null, tokenUserA);
    assert(getOneRes.status === 200, 'Get single transaction returns 200');
    assert(getOneRes.body.data._id === transactionA1Id, 'Transaction ID matches requested ID');

    console.log('\n[10] Testing PUT /api/transactions/:id');
    const updateRes = await makeRequest('PUT', `/api/transactions/${transactionA1Id}`, {
      amount: 1800,
      description: 'Updated grocery shopping'
    }, tokenUserA);
    assert(updateRes.status === 200, 'Update transaction returns 200');
    assert(updateRes.body.data.amount === 1800, 'Transaction amount updated to 1800');

    console.log('\n[11] Testing GET /api/analytics/summary');
    const summaryRes = await makeRequest('GET', '/api/analytics/summary', null, tokenUserA);
    assert(summaryRes.status === 200, 'Summary returns status 200');
    assert(summaryRes.body.data.totalIncome === 40000, 'Total income is 40000');
    assert(summaryRes.body.data.totalExpenses === (2000 + 1800 + 3800), 'Total expenses match sum');
    assert(summaryRes.body.data.balance === 40000 - (2000 + 1800 + 3800), 'Balance equals totalIncome - totalExpenses');

    console.log('\n[12] Testing GET /api/analytics/monthly & /api/analytics/categories');
    const monthlyRes = await makeRequest('GET', '/api/analytics/monthly', null, tokenUserA);
    assert(monthlyRes.status === 200, 'Monthly analytics returns 200');
    assert(monthlyRes.body.data.income === 40000, 'Monthly income calculated correctly');

    const categoryRes = await makeRequest('GET', '/api/analytics/categories?type=expense', null, tokenUserA);
    assert(categoryRes.status === 200, 'Category analytics returns 200');
    assert(categoryRes.body.data.Shopping === 5800, 'Shopping expense total across all months is 5800');

    console.log('\n[13] Testing Smart Financial Insight Engine Endpoints');
    const anomaliesRes = await makeRequest('GET', '/api/insights/anomalies', null, tokenUserA);
    assert(anomaliesRes.status === 200, 'Anomalies endpoint returns status 200');
    const shoppingAnomaly = anomaliesRes.body.data.find((a) => a.category === 'Shopping');
    assert(shoppingAnomaly !== undefined, 'Shopping anomaly evaluated');
    assert(shoppingAnomaly.isAnomaly === true, 'Shopping flagged as ANOMALY (>30% spike: 2000 vs 3800)');

    const forecastRes = await makeRequest('GET', '/api/insights/forecast', null, tokenUserA);
    assert(forecastRes.status === 200, 'Forecast endpoint returns 200');
    assert(forecastRes.body.data.projectedMonthlySpending > 0, 'Projected monthly spending calculated');

    const recommendationsRes = await makeRequest('GET', '/api/insights/recommendations', null, tokenUserA);
    assert(recommendationsRes.status === 200, 'Recommendations endpoint returns 200');
    assert(recommendationsRes.body.data.recommendations.length > 0, 'Dynamic recommendations generated');

    const allInsightsRes = await makeRequest('GET', '/api/insights', null, tokenUserA);
    assert(allInsightsRes.status === 200, 'All insights endpoint returns 200');
    assert(allInsightsRes.body.data.anomalies !== undefined, 'Combined overview contains anomalies');
    assert(allInsightsRes.body.data.forecast !== undefined, 'Combined overview contains forecast');
    assert(allInsightsRes.body.data.recommendations !== undefined, 'Combined overview contains recommendations');

    console.log('\n[14] Testing Security & Data Isolation Controls');
    
    const regUserB = await makeRequest('POST', '/api/auth/register', {
      name: 'User Bob',
      email: 'bob@example.com',
      password: 'Password@123'
    });
    tokenUserB = regUserB.body.token;

    const forbiddenGet = await makeRequest('GET', `/api/transactions/${transactionA1Id}`, null, tokenUserB);
    assert(forbiddenGet.status === 403, 'User B receives 403 Forbidden attempting to view User A transaction');

    const forbiddenPut = await makeRequest('PUT', `/api/transactions/${transactionA1Id}`, { amount: 99999 }, tokenUserB);
    assert(forbiddenPut.status === 403, 'User B receives 403 Forbidden attempting to update User A transaction');

    const forbiddenDel = await makeRequest('DELETE', `/api/transactions/${transactionA1Id}`, null, tokenUserB);
    assert(forbiddenDel.status === 403, 'User B receives 403 Forbidden attempting to delete User A transaction');

    const userBTx = await makeRequest('GET', '/api/transactions', null, tokenUserB);
    assert(userBTx.body.data.length === 0, 'User B transaction list is isolated and empty');

    const noTokenRes = await makeRequest('GET', '/api/transactions');
    assert(noTokenRes.status === 401, 'Request without token returns 401 Unauthorized');

    const invalidTokenRes = await makeRequest('GET', '/api/transactions', null, 'invalid_jwt_token');
    assert(invalidTokenRes.status === 401, 'Request with invalid token returns 401 Unauthorized');

    console.log('\n[15] Testing Delete Transaction (DELETE /api/transactions/:id)');
    const deleteRes = await makeRequest('DELETE', `/api/transactions/${transactionA1Id}`, null, tokenUserA);
    assert(deleteRes.status === 200, 'Delete transaction returns 200');

    const getDeletedRes = await makeRequest('GET', `/api/transactions/${transactionA1Id}`, null, tokenUserA);
    assert(getDeletedRes.status === 404, 'Deleted transaction returns 404 Not Found');

    console.log('\n[16] Testing Improved Anomaly Detection Logic');
    // Setup: register a fresh user with no historical data so we can test no-baseline paths.
    const regUserC = await makeRequest('POST', '/api/auth/register', {
      name: 'User Carol',
      email: 'carol@example.com',
      password: 'Password@123'
    });
    const tokenUserC = regUserC.body.token;
    assert(regUserC.status === 201, '[16] User C registered successfully');

    const nowC = new Date();
    const cYear = nowC.getFullYear();
    const cMonth = nowC.getMonth();

    // Add two current-month expenses for User C — no previous month data (no baseline).
    await makeRequest('POST', '/api/transactions', {
      type: 'expense',
      amount: 5500,
      category: 'Shopping',
      description: 'First ever shopping',
      date: new Date(cYear, cMonth, 3).toISOString()
    }, tokenUserC);

    await makeRequest('POST', '/api/transactions', {
      type: 'expense',
      amount: 1200,
      category: 'Food',
      description: 'Groceries',
      date: new Date(cYear, cMonth, 4).toISOString()
    }, tokenUserC);

    // ── Scenario A: No historical baseline ──────────────────────────────────────
    const carolAnomaliesRes = await makeRequest('GET', '/api/insights/anomalies', null, tokenUserC);
    assert(carolAnomaliesRes.status === 200, '[16] Anomalies endpoint returns 200 for User C (no baseline)');

    const carolAnomalies = carolAnomaliesRes.body.data;
    assert(Array.isArray(carolAnomalies), '[16] Anomalies response is an array');

    const carolShopping = carolAnomalies.find((a) => a.category === 'Shopping');
    const carolFood = carolAnomalies.find((a) => a.category === 'Food');

    // Shopping is the highest spender — should be flagged as an initial alert.
    assert(carolShopping !== undefined, '[16] Shopping entry present in anomalies');
    assert(carolShopping.isAnomaly === true, '[16] Shopping flagged isAnomaly=true (highest no-baseline category)');
    assert(carolShopping.historicalAverage === 0, '[16] Shopping historicalAverage is 0 (no baseline)');
    assert(carolShopping.increasePercentage === 0, '[16] Shopping increasePercentage is 0, not a misleading 100%');
    assert(
      carolShopping.message.toLowerCase().includes('initial spending alert'),
      '[16] Shopping message contains "initial spending alert"'
    );
    assert(
      carolShopping.message.includes('5500'),
      '[16] Shopping message includes the current spend amount'
    );

    // Food is NOT the highest spender — should get a neutral no-data message.
    assert(carolFood !== undefined, '[16] Food entry present in anomalies');
    assert(carolFood.isAnomaly === false, '[16] Food isAnomaly=false (not highest, no baseline)');
    assert(carolFood.historicalAverage === 0, '[16] Food historicalAverage is 0 (no baseline)');
    assert(carolFood.increasePercentage === 0, '[16] Food increasePercentage is 0 (no misleading spike)');
    assert(
      carolFood.message.toLowerCase().includes('not have enough historical data'),
      '[16] Food message indicates insufficient historical data'
    );

    // ── Scenario B: Genuine spike ≥ 30% (User A data already in DB) ─────────────
    // User A has Shopping: historical ₹2000 (last month), current ₹3800 → 90% spike.
    // The anomaly was confirmed in [13]; verify the structure is still correct.
    const aliceAnomalies2 = await makeRequest('GET', '/api/insights/anomalies', null, tokenUserA);
    assert(aliceAnomalies2.status === 200, '[16] Anomalies endpoint returns 200 for User A (has baseline)');

    const aliceShopping2 = aliceAnomalies2.body.data.find((a) => a.category === 'Shopping');
    assert(aliceShopping2 !== undefined, '[16] User A Shopping anomaly entry found');
    assert(aliceShopping2.isAnomaly === true, '[16] User A Shopping is anomaly (genuine 90% spike)');
    assert(aliceShopping2.historicalAverage > 0, '[16] User A Shopping has a real historical average');
    assert(aliceShopping2.increasePercentage >= 30, '[16] User A Shopping increasePercentage >= 30');
    assert(
      !aliceShopping2.message.toLowerCase().includes('initial spending alert'),
      '[16] Genuine spike message does NOT say "initial spending alert"'
    );
    assert(
      aliceShopping2.message.includes('%'),
      '[16] Genuine spike message contains percentage figure'
    );

    // ── Scenario C: Normal spending (User A Food: no prior Food history this test run) ─
    // Food was added only for the current month with no prior month history for Alice.
    // After the update (amount changed to 1800), Food has no prior baseline in tests.
    // We verify the structure fields are all present and non-anomalous baseline case.
    const aliceFood2 = aliceAnomalies2.body.data.find((a) => a.category === 'Food');
    if (aliceFood2) {
      // Whether Food has baseline or not, verify the response structure is intact.
      assert('category' in aliceFood2, '[16] Food anomaly entry has category field');
      assert('currentSpending' in aliceFood2, '[16] Food anomaly entry has currentSpending field');
      assert('historicalAverage' in aliceFood2, '[16] Food anomaly entry has historicalAverage field');
      assert('increasePercentage' in aliceFood2, '[16] Food anomaly entry has increasePercentage field');
      assert('isAnomaly' in aliceFood2, '[16] Food anomaly entry has isAnomaly field');
      assert('message' in aliceFood2, '[16] Food anomaly entry has message field');
      assert(typeof aliceFood2.message === 'string', '[16] Food message is a string');
    }

    // ── Scenario D: Response structure integrity ──────────────────────────────────
    carolAnomalies.forEach((entry) => {
      assert('category' in entry, `[16] ${entry.category} has category field`);
      assert('currentSpending' in entry, `[16] ${entry.category} has currentSpending field`);
      assert('historicalAverage' in entry, `[16] ${entry.category} has historicalAverage field`);
      assert('increasePercentage' in entry, `[16] ${entry.category} has increasePercentage field`);
      assert('isAnomaly' in entry, `[16] ${entry.category} has isAnomaly field`);
      assert('message' in entry, `[16] ${entry.category} has message field`);
      assert(!('_hasBaseline' in entry), `[16] ${entry.category} does NOT expose _hasBaseline internal field`);
    });

    console.log('\n==================================================');
    console.log('✅ ALL 16 TEST SUITES PASSED PERFECTLY!');
    console.log('==================================================\n');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', error);
    process.exit(1);
  } finally {
    if (server) server.close();
    if (mongoServer) await mongoServer.stop();
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTests();
