import {
  getSubscriptionMetadata,
  loadAlertSettings,
} from './alertSettingsService';

const SUB_ID_KEY = 'nordpool_push_sub_id';
const MANAGE_TOKEN_KEY = 'nordpool_push_manage_token';
const SW_URL = '/sw.js';
const SW_SCOPE = '/';

function apiBase() {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  return base.replace(/\/$/, '');
}

function vapidPublicUrl() {
  return `${apiBase()}/push/vapid-public`;
}

function subscribeUrl() {
  return `${apiBase()}/push/subscribe`;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export function getPushEnvironmentStatus() {
  if (!('Notification' in window)) {
    return { ready: false, hintKey: 'settings.pushUnsupported' };
  }

  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isIos && !isStandalone) {
    return { ready: false, hintKey: 'settings.pushIosStandalone' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ready: false, hintKey: 'settings.pushUnsupported' };
  }

  return { ready: true, hintKey: null };
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

async function ensureServiceWorker() {
  let reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!reg) {
    reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  }
  await navigator.serviceWorker.ready;
  return reg;
}

export async function fetchVapidPublicKey() {
  const res = await fetch(vapidPublicUrl(), { cache: 'no-store' });
  if (res.status === 404) {
    return { ok: false, unavailable: true };
  }
  if (!res.ok) {
    throw new Error('VAPID not configured');
  }
  const data = await res.json();
  return { ok: true, publicKey: data.publicKey };
}

async function postSubscribeBody(body) {
  const res = await fetch(subscribeUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 404) {
    return { ok: false, unavailable: true };
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || res.statusText };
  }

  if (data.id) {
    localStorage.setItem(SUB_ID_KEY, data.id);
  }
  if (data.manageToken) {
    localStorage.setItem(MANAGE_TOKEN_KEY, data.manageToken);
  }
  return { ok: true, id: data.id, manageToken: data.manageToken || null };
}

export async function subscribeToPush(settings = loadAlertSettings()) {
  const env = getPushEnvironmentStatus();
  if (!env.ready) {
    return { ok: false, hintKey: env.hintKey };
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, errorKey: 'settings.pushPermissionDenied' };
  }

  try {
    const vapid = await fetchVapidPublicKey();
    if (!vapid.ok) {
      if (vapid.unavailable) {
        return { ok: false, unavailable: true, permissionGranted: true };
      }
      return { ok: false, errorKey: 'settings.pushSubscribeFailed' };
    }

    const reg = await ensureServiceWorker();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
    }

    return postSubscribeBody({
      alertPreferences: getSubscriptionMetadata(settings),
      timezone: settings.timezone,
      pushSubscription: sub.toJSON(),
    });
  } catch (error) {
    return { ok: false, error: error?.message || 'Subscribe failed' };
  }
}

export async function syncPushSubscription(settings = loadAlertSettings()) {
  const id = localStorage.getItem(SUB_ID_KEY);
  const manageToken = localStorage.getItem(MANAGE_TOKEN_KEY);
  if (!id || !manageToken) {
    return { ok: false, skipped: true };
  }

  const res = await fetch(subscribeUrl(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      manageToken,
      alertPreferences: getSubscriptionMetadata(settings),
      timezone: settings.timezone,
    }),
  });

  if (res.status === 404) {
    return { ok: false, unavailable: true };
  }

  return { ok: res.ok };
}

export async function unsubscribeFromPush() {
  const id = localStorage.getItem(SUB_ID_KEY);
  const manageToken = localStorage.getItem(MANAGE_TOKEN_KEY);

  if (id && manageToken) {
    await fetch(subscribeUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, manageToken }),
    }).catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
    }
  }

  localStorage.removeItem(SUB_ID_KEY);
  localStorage.removeItem(MANAGE_TOKEN_KEY);
  return { ok: true };
}

export async function isPushSubscriptionActive() {
  const id = localStorage.getItem(SUB_ID_KEY);
  if (!id || getNotificationPermission() !== 'granted') {
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (!reg) {
      return false;
    }
    return Boolean(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
