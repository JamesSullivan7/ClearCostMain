// ── Photo Upload Service ─────────────────────────────
// Uses Supabase Storage to upload and serve product photos.
// Requires a PUBLIC bucket named 'product-photos' in your Supabase project.

import { getClient, getBusinessId } from '../supabase.js';

const BUCKET = 'product-photos';

export async function uploadPhoto(file) {
  const client = getClient();
  if (!client) throw new Error('Not connected');

  const bizId = getBusinessId();
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${bizId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await client.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error('Upload failed: ' + error.message);
  return data.path;
}

export function getPhotoUrl(path) {
  if (!path) return null;
  const client = getClient();
  if (!client) return null;

  const { data } = client.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

export async function deletePhoto(path) {
  if (!path) return;
  const client = getClient();
  if (!client) return;

  await client.storage
    .from(BUCKET)
    .remove([path]);
}
