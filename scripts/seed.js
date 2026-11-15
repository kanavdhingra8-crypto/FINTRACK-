const apiBaseUrl = process.env.SEED_API_URL;
const demoEmail = process.env.DEMO_EMAIL;
const demoPassword = process.env.DEMO_PASSWORD;

if (!apiBaseUrl || !demoEmail || !demoPassword) {
  throw new Error('SEED_API_URL, DEMO_EMAIL, and DEMO_PASSWORD must be set.');
}

async function request(path, { method = 'GET', body, accessToken } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new Error(`Could not reach the gateway: ${error.message}`);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Gateway returned invalid JSON for ${path}.`);
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function monthString(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dateInMonth(monthOffset, day) {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
  const lastDay = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${monthString(firstDay)}-${String(safeDay).padStart(2, '0')}`;
}

async function createOrLoginDemoUser() {
  try {
    return await request('/auth/register', {
      method: 'POST',
      body: { email: demoEmail, password: demoPassword },
    });
  } catch (error) {
    if (error.status !== 409) throw error;
    console.log('Demo account already exists; signing in.');
    return request('/auth/login', {
      method: 'POST',
      body: { email: demoEmail, password: demoPassword },
    });
  }
}

async function ensureSampleTransactions(accessToken) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const samples = [
    { note: 'fintrack-seed-current-income', amount: 75000, type: 'income', category: 'Salary', date: dateInMonth(0, 1) },
    { note: 'fintrack-seed-current-food', amount: 4600, type: 'expense', category: 'Food', date: currentDate },
    { note: 'fintrack-seed-alert-expense', amount: 12500, type: 'expense', category: 'Travel', date: currentDate },
    { note: 'fintrack-seed-previous-income', amount: 70000, type: 'income', category: 'Salary', date: dateInMonth(-1, 10) },
    { note: 'fintrack-seed-previous-home', amount: 18000, type: 'expense', category: 'Home', date: dateInMonth(-1, 20) },
  ];
  const months = [...new Set(samples.map((sample) => sample.date.slice(0, 7)))];
  const existingNotes = new Set();

  for (const month of months) {
    const result = await request(
      `/transactions?month=${month}&page=1&limit=100`,
      { accessToken },
    );
    for (const transaction of result.transactions) {
      if (transaction.note) existingNotes.add(transaction.note);
    }
  }

  let alertTransactionId;
  for (const sample of samples) {
    const existing = existingNotes.has(sample.note);
    if (!existing) {
      const result = await request('/transactions', {
        method: 'POST',
        accessToken,
        body: sample,
      });
      if (sample.note === 'fintrack-seed-alert-expense') {
        alertTransactionId = result.transaction.id;
      }
      console.log(`Created ${sample.type}: ${sample.category} on ${sample.date}.`);
    } else {
      console.log(`Sample already exists: ${sample.note}.`);
    }
  }

  if (!alertTransactionId) {
    const currentMonth = currentDate.slice(0, 7);
    const result = await request(
      `/transactions?month=${currentMonth}&page=1&limit=100`,
      { accessToken },
    );
    alertTransactionId = result.transactions
      .find((transaction) => transaction.note === 'fintrack-seed-alert-expense')?.id;
  }

  if (!alertTransactionId) {
    throw new Error('Could not find the seeded expense to verify its alert.');
  }

  return alertTransactionId;
}

async function waitForExpenseAlert(accessToken, transactionId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await request('/notifications', { accessToken });
    const alert = result.notifications.find((item) => item.transactionId === transactionId);
    if (alert) return alert;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('The high-expense notification did not arrive within 30 seconds. Check RabbitMQ and notification-service logs.');
}

async function main() {
  const auth = await createOrLoginDemoUser();
  await request('/notifications/settings/threshold', {
    method: 'PUT',
    accessToken: auth.accessToken,
    body: { threshold: 10000 },
  });
  const alertTransactionId = await ensureSampleTransactions(auth.accessToken);
  const alert = await waitForExpenseAlert(auth.accessToken, alertTransactionId);

  console.log(`Demo login: ${demoEmail} / ${demoPassword}`);
  console.log(`High expense alert received: INR ${alert.amount} (${alert.category}, ${alert.date}).`);
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
