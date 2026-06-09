const express = require('express');
const webpush = require('web-push');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const FB_URL = process.env.FIREBASE_URL || 'https://amour-e2a87-default-rtdb.firebaseio.com';
let vapidKeys = null;

async function initVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    webpush.setVapidDetails('mailto:admin@notre-nid.app', vapidKeys.publicKey, vapidKeys.privateKey);
    console.log('VAPID keys loaded from environment variables');
    return;
  }
  // Load from Firebase (persists across restarts)
  try {
    const r = await fetch(`${FB_URL}/nid-vapid.json`);
    const d = await r.json();
    if (d && d.publicKey && d.privateKey) {
      vapidKeys = d;
      webpush.setVapidDetails('mailto:admin@notre-nid.app', vapidKeys.publicKey, vapidKeys.privateKey);
      console.log('VAPID keys loaded from Firebase');
      return;
    }
  } catch (e) { console.warn('Could not load VAPID from Firebase:', e.message); }
  // Generate new keys and persist to Firebase
  vapidKeys = webpush.generateVAPIDKeys();
  webpush.setVapidDetails('mailto:admin@notre-nid.app', vapidKeys.publicKey, vapidKeys.privateKey);
  try {
    await fetch(`${FB_URL}/nid-vapid.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vapidKeys)
    });
    console.log('New VAPID keys generated and saved to Firebase');
  } catch (e) { console.warn('Could not save VAPID to Firebase:', e.message); }
}

app.get('/api/vapid-key', (req, res) => {
  res.json({ key: vapidKeys ? vapidKeys.publicKey : null });
});

app.post('/api/notify', async (req, res) => {
  if (!vapidKeys) return res.status(503).json({ error: 'VAPID not ready' });
  const { subscription, title, body, tag } = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, tag: tag || 'notre-nid' }));
    res.json({ ok: true });
  } catch (e) {
    if (e.statusCode === 410) res.status(410).json({ error: 'Subscription expired' });
    else res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Notre Nid starting on port ${PORT}`);
  await initVapid();
  console.log(`Notre Nid ready on port ${PORT}`);
});
