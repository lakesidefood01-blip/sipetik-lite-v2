import { createClient } from '@supabase/supabase-js';
import { addMonths } from 'date-fns';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AMOUNT = 100_000_000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-callback-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 1024 * 1024) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    const MAYAR_WEBHOOK_TOKEN = process.env.MAYAR_WEBHOOK_TOKEN;
    const token = req.headers['x-callback-token'];

    if (MAYAR_WEBHOOK_TOKEN && token !== MAYAR_WEBHOOK_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body || {};
    const event = payload.event;

    if (event === 'testing' || !event) {
      return res.status(200).json({ success: true, message: 'Test received' });
    }

    const data = payload.data || {};

    const successEvents = ['payment.success', 'payment.received'];

    if (!successEvents.includes(event) || data.status !== 'SUCCESS') {
      return res.status(200).json({ skip: true, message: 'Event ignored or not successful' });
    }

    const email = data.customerEmail || data?.customer?.email;
    const amount = data.amount;
    const refId = data.referenceId || data.transactionId || data.id;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid payload: invalid or missing email' });
    }

    if (typeof amount !== 'number' || amount <= 0 || amount > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Invalid payload: amount out of range' });
    }

    if (refId && typeof refId !== 'string') {
      return res.status(400).json({ error: 'Invalid payload: referenceId must be a string' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (refId) {
      const { data: existing } = await supabase
        .from('membership_payments')
        .select('id')
        .eq('reference_id', refId)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ skip: true, message: 'Already processed' });
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, membership_status, membership_end')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: 'Failed to query profile' });
    }

    if (!profile) {
      return res.status(200).json({ success: true, message: 'User not found, skipping' });
    }

    const now = new Date();
    const currentEnd = profile.membership_end ? new Date(profile.membership_end) : null;
    const isStillActive = currentEnd && currentEnd > now;
    const periodStart = isStillActive ? currentEnd : now;
    const periodEnd = addMonths(periodStart, 1);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_status: 'active',
        membership_start: periodStart.toISOString(),
        membership_end: periodEnd.toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update membership' });
    }

    const { error: insertError } = await supabase
      .from('membership_payments')
      .insert({
        user_id: profile.id,
        reference_id: refId,
        amount,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      });

    if (insertError) {
      console.error('Insert payment error:', insertError);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}