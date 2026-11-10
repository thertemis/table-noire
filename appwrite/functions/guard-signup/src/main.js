// guard-signup — removes accounts created outside the invitation flow.
// Triggered on `users.*.create`. Waits for redeem-invite to finish, then deletes any account that carries
// neither the `admin` nor the `member` label and belongs to no team.
// IMPORTANT: label the admin account `admin` BEFORE deploying this function, or within the grace delay.
import { Client, Users } from 'node-appwrite';

const GRACE_MS = 25_000;

export default async ({ req, res, log }) => {
  const user = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!user.$id) return res.json({ skipped: true });
  await new Promise(r => setTimeout(r, GRACE_MS));

  const users = new Users(new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']));
  const fresh = await users.get({ userId: user.$id }).catch(() => null);
  if (!fresh) return res.json({ gone: true });
  const labels = fresh.labels || [];
  if (labels.includes('admin') || labels.includes('member')) return res.json({ kept: labels.join(',') });
  const memberships = await users.listMemberships({ userId: user.$id });
  if (memberships.total > 0) return res.json({ kept: 'member' });

  await users.delete({ userId: user.$id });
  log(`Compte non invité supprimé : ${fresh.email || fresh.$id}`);
  return res.json({ deleted: true });
};
