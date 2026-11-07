import http from 'node:http';
const plans = new Map();
const gates = new Map();
let requests = [];
const family = '10000000-0000-4000-8000-000000000001';
const session = {
  accessToken: 'fixture-access',
  sessionId: family,
  user: { id: 'fixture-user', role: 'owner' },
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4186');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Teamos-Session');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/control' && req.method === 'POST') {
    let raw = '';
    for await (const part of req) raw += part;
    const command = JSON.parse(raw);
    if (command.reset) {
      plans.clear();
      requests = [];
    }
    if (command.plan) {
      const list = plans.get(command.plan.path) ?? [];
      list.push(command.plan);
      plans.set(command.plan.path, list);
    }
    if (command.release) {
      gates.get(command.release)?.();
      gates.delete(command.release);
    }
    res.end('{}');
    return;
  }
  if (path === '/control') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(requests));
    return;
  }
  const endpoint = path.replace(/^\/api\/v[12]/, '');
  requests.push({ path: endpoint, sessionId: req.headers['x-teamos-session'] ?? null });
  const plan = plans.get(endpoint)?.shift() ?? {};
  if (plan.drop) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '1000' });
    res.write('{');
    setTimeout(() => res.destroy(), 20);
    return;
  }
  if (plan.gateBefore) await new Promise((resolve) => gates.set(plan.gateBefore, resolve));
  const status = plan.status ?? (endpoint === '/auth/logout' ? 204 : 200);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
  });
  if (status === 204) {
    res.end();
    return;
  }
  const body = JSON.stringify(plan.body ?? (endpoint === '/auth/me' ? session.user : session));
  if (plan.gate) {
    res.write(body.slice(0, 1));
    await new Promise((resolve) => gates.set(plan.gate, resolve));
    res.end(body.slice(1));
  } else res.end(body);
});
server.listen(4187, '127.0.0.1');
