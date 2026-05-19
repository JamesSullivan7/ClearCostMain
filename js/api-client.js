// ── API Client ────────────────────────────────────────
// Thin wrapper around fetch() that auto-attaches auth headers
// and handles 401 (redirect to login).
// Used by all store modules to communicate with /api/data.

import { getAuthHeaders, isAuthenticated } from './supabase.js';

const API_BASE = '/api/data';

async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Session expired — clear auth and reload once
    if (!sessionStorage.getItem('_cc_auth_reload')) {
      sessionStorage.setItem('_cc_auth_reload', '1');
      console.warn('Session expired, clearing and reloading...');
      try { localStorage.removeItem('clearcost-auth'); } catch {}
      location.reload();
    }
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

// ── CRUD Operations ─────────────────────────────────

export async function apiList(store) {
  return apiFetch(`${API_BASE}?store=${store}&action=list`);
}

export async function apiGet(store, id) {
  return apiFetch(`${API_BASE}?store=${store}&action=get&id=${id}`);
}

export async function apiCreate(store, data) {
  return apiFetch(`${API_BASE}?store=${store}&action=create`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdate(store, id, data) {
  return apiFetch(`${API_BASE}?store=${store}&action=update&id=${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiDelete(store, id) {
  return apiFetch(`${API_BASE}?store=${store}&action=delete&id=${id}`, {
    method: 'POST',
  });
}

export async function apiUpsert(store, data) {
  return apiFetch(`${API_BASE}?store=${store}&action=upsert`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiBatch(store, records) {
  return apiFetch(`${API_BASE}?store=${store}&action=batch`, {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function apiClear(store) {
  return apiFetch(`${API_BASE}?store=${store}&action=clear`, {
    method: 'POST',
  });
}

export async function apiGetProfile() {
  return apiFetch(`${API_BASE}?store=businesses&action=profile`);
}

export async function apiUpdateProfile(data) {
  return apiFetch(`${API_BASE}?store=businesses&action=profile`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Team Management ────────────────────────────────

const TEAM_API = '/api/team';

export async function apiTeamInvite(email, role) {
  return apiFetch(`${TEAM_API}?action=invite`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function apiTeamAccept(inviteId) {
  return apiFetch(`${TEAM_API}?action=accept`, {
    method: 'POST',
    body: JSON.stringify({ inviteId }),
  });
}

export async function apiTeamList() {
  return apiFetch(`${TEAM_API}?action=list`);
}

export async function apiTeamRemove(memberId) {
  return apiFetch(`${TEAM_API}?action=remove`, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  });
}

export async function apiTeamUpdateRole(memberId, role) {
  return apiFetch(`${TEAM_API}?action=update-role`, {
    method: 'POST',
    body: JSON.stringify({ memberId, role }),
  });
}

export async function apiTeamCheckInvites() {
  return apiFetch(`${TEAM_API}?action=check-invites`);
}
