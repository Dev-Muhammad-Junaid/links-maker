// Access probing module for Links Maker (MV3)
import { pushLog } from './logs.js';
import { buildProfileSwitchUrl, extractResourceId } from './url.js';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Prevent memory bloat
const CACHE_STORAGE_KEY = '__lm_access_cache';

// In-memory cache: Map<`${resourceId}:${authIndex}`, { result, timestamp, expiresAt }>
const accessCache = new Map();

// Cache save debouncing
let cacheSaveTimeout = null;

/**
 * Generate cache key from resource ID and profile identifier
 * Uses email if available (more stable), falls back to authIndex
 */
function getCacheKey(resourceId, profile) {
  // Use email as primary identifier (more stable than authIndex)
  // Fallback to authIndex if email not available
  const identifier = (profile?.email && profile.email.trim()) 
    ? `email:${profile.email.toLowerCase().trim()}`
    : `auth:${profile?.authIndex ?? 'unknown'}`;
  return `${resourceId}:${identifier}`;
}

/**
 * Get cached access result if available and not expired
 */
function getCachedResult(resourceId, profile) {
  if (!resourceId || !profile) return null;
  
  const key = getCacheKey(resourceId, profile);
  const cached = accessCache.get(key);
  if (!cached) return null;
  
  // Check expiration
  if (Date.now() > cached.expiresAt) {
    accessCache.delete(key);
    return null;
  }
  
  return cached.result;
}

/**
 * Store access result in cache
 */
function setCachedResult(resourceId, profile, result) {
  if (!resourceId || !profile) return;
  
  const key = getCacheKey(resourceId, profile);
  
  // Evict oldest entries if cache is full
  if (accessCache.size >= MAX_CACHE_SIZE && !accessCache.has(key)) {
    const firstKey = accessCache.keys().next().value;
    accessCache.delete(firstKey);
  }
  
  accessCache.set(key, {
    result,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL
  });
  
  scheduleCacheSave();
}

/**
 * Schedule cache save to storage (debounced)
 */
function scheduleCacheSave() {
  if (cacheSaveTimeout) return;
  cacheSaveTimeout = setTimeout(() => {
    saveCacheToStorage();
    cacheSaveTimeout = null;
  }, 2000); // Debounce saves by 2 seconds
}

/**
 * Persist cache to chrome.storage.local for cross-session persistence
 */
async function saveCacheToStorage() {
  try {
    const cacheData = Array.from(accessCache.entries()).map(([key, value]) => ({
      key,
      result: value.result,
      expiresAt: value.expiresAt
    }));
    await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cacheData });
    pushLog("debug", "Access cache saved", { entries: cacheData.length });
  } catch (e) {
    pushLog("warn", "Access cache save failed", { error: String(e) });
  }
}

/**
 * Load cache from chrome.storage.local
 */
export async function loadCacheFromStorage() {
  try {
    const { [CACHE_STORAGE_KEY]: cacheData } = await chrome.storage.local.get(CACHE_STORAGE_KEY);
    if (Array.isArray(cacheData)) {
      const now = Date.now();
      let loaded = 0;
      accessCache.clear();
      
      cacheData.forEach(({ key, result, expiresAt }) => {
        if (expiresAt && now < expiresAt) {
          accessCache.set(key, { result, expiresAt, timestamp: now });
          loaded++;
        }
      });
      
      pushLog("info", "Access cache loaded", { entries: loaded, total: cacheData.length });
    }
  } catch (e) {
    pushLog("warn", "Access cache load failed", { error: String(e) });
  }
}

/**
 * Invalidate cache entries
 * @param {string|null} resourceId - If provided, invalidate only this resource
 * @param {object|null} profile - If provided with resourceId, invalidate specific entry
 * @param {number|null} authIndex - If provided, invalidate all entries for this authIndex (for migration/cleanup)
 */
export function invalidateCache(resourceId = null, profile = null, authIndex = null) {
  if (resourceId && profile) {
    // Invalidate specific entry
    accessCache.delete(getCacheKey(resourceId, profile));
  } else if (resourceId) {
    // Invalidate all profiles for a resource
    for (const key of accessCache.keys()) {
      if (key.startsWith(`${resourceId}:`)) {
        accessCache.delete(key);
      }
    }
  } else if (authIndex !== null) {
    // Invalidate all entries for a specific authIndex (for cleanup when authIndex changes)
    for (const key of accessCache.keys()) {
      if (key.includes(`:auth:${authIndex}`) || key.endsWith(`:${authIndex}`)) {
        accessCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    accessCache.clear();
  }
  scheduleCacheSave();
}

/**
 * Clear all cache entries (for manual cache clear)
 */
export function clearAllCache() {
  accessCache.clear();
  scheduleCacheSave();
}

export async function probeAccess(url, authIndex) {
  const targetUrl = buildProfileSwitchUrl(url, authIndex);
  if (!targetUrl) { pushLog("warn", "Access probe skip — bad url", { authIndex, url }); return { status: "unknown", reason: "bad_url" }; }
  pushLog("info", "Access probe built", { authIndex, method: "GET", url: targetUrl });
  try {
    const resp = await fetch(targetUrl, { credentials: "include", cache: "no-store", redirect: "follow" });
    const finalUrl = resp.url || "";
    let text = "";
    try { text = await resp.text(); } catch {}
    const lowered = (text || "").toLowerCase();
    const isLogin = /accounts\.google\.com|servicelogin|signin/.test(finalUrl) || lowered.includes("sign in");
    const isDenied = resp.status === 401 || resp.status === 403 || /request\s*access|need\s*access|share\?ths=true/.test(lowered);
    const classified = (isLogin || isDenied) ? "no_access" : ((resp.status === 200 || resp.status === 204) ? "access" : "unknown");
    pushLog("info", "Access probe response", { authIndex, statusCode: resp.status, finalUrl, classified });
    return { status: classified, code: resp.status, finalUrl };
  } catch (e) {
    pushLog("error", "Access probe error", { authIndex, error: String(e) });
    return { status: "unknown", reason: "fetch_error" };
  }
}

export async function checkAccessForProfiles(url, profiles) {
  const results = {};
  for (const p of profiles) {
    results[p.authIndex] = await probeAccess(url, p.authIndex);
  }
  return results;
}

export async function probeAccessInPage(tabId, url, authIndex) {
  const targetUrl = buildProfileSwitchUrl(url, authIndex);
  if (!targetUrl) { pushLog("warn", "Access probe skip — bad url", { authIndex, url }); return { status: "unknown", reason: "bad_url" }; }
  pushLog("info", "Access probe built (page)", { authIndex, method: "GET", url: targetUrl });
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      args: [targetUrl],
      func: async (requestUrl) => {
        try {
          const resp = await fetch(requestUrl, { credentials: 'include', redirect: 'follow' });
          let text = '';
          try { text = await resp.text(); } catch {}
          let canonicalHref = null;
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text || '', 'text/html');
            canonicalHref = doc?.querySelector('link[rel="canonical"]')?.href || null;
          } catch {}
          return { ok: true, status: resp.status, finalUrl: resp.url, canonicalHref };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
    });
    const r = res?.result || {};
    if (!r.ok) { pushLog("error", "Access probe page error", { authIndex, error: r.error }); return { status: 'unknown', reason: 'fetch_error' }; }

    // Meet-aware URL-based classification
    let classified = 'unknown';
    let rule = 'status_only';
    const status = Number(r.status);
    try {
      const effectiveUrl = new URL(r.finalUrl || targetUrl);
      const finalHost = effectiveUrl.hostname;
      const rawPath = effectiveUrl.pathname || '/';
      const path = rawPath.replace(/^\/u\/\d+\//, '/');
      const redirectedToLogin = /accounts\.google\.com/.test(r.finalUrl || '');
      const isMeetHost = finalHost === 'meet.google.com';
      const isMeetingCode = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\/|$)/i.test(path);
      const isLookup = /^\/lookup\//i.test(path);
      const isLanding = path === '/landing';
      const isV2 = /^\/v2\//i.test(path);

      if (status === 401 || status === 403 || redirectedToLogin) {
        classified = 'no_access';
        rule = 'login_or_403';
      } else if (isMeetHost && isLookup) {
        classified = 'no_access';
        rule = 'meet_lookup_noaccess';
      } else if (isMeetHost && (isMeetingCode || isV2) && (status === 200 || status === 204)) {
        classified = 'access';
        rule = 'meet_code_or_v2_access';
      } else if (isMeetHost && isLanding && (status === 200 || status === 204)) {
        classified = 'unknown';
        rule = 'meet_landing_unknown';
      } else {
        classified = (status === 200 || status === 204) ? 'access' : ((status === 401 || status === 403) ? 'no_access' : 'unknown');
        rule = 'fallback_status';
      }

      pushLog("info", "Access probe response (page)", { authIndex, statusCode: status, finalUrl: r.finalUrl, canonicalHref: r.canonicalHref, path, rule, classified });
    } catch {
      classified = (Number(r.status) === 200 || Number(r.status) === 204) ? 'access' : ((Number(r.status) === 401 || Number(r.status) === 403) ? 'no_access' : 'unknown');
      pushLog("info", "Access probe response (page)", { authIndex, statusCode: r.status, finalUrl: r.finalUrl, rule: 'catch_fallback', classified });
    }

    return { status: classified, code: r.status, finalUrl: r.finalUrl };
  } catch (e) {
    pushLog("error", "Access probe exec error", { authIndex, error: String(e) });
    return { status: "unknown", reason: "exec_error" };
  }
}

/**
 * Check access for all profiles in parallel with caching support
 */
export async function checkAccessForProfilesInPage(tabId, url, profiles) {
  const resourceId = extractResourceId(url);
  
  // If no resource ID, fall back to sequential (for unsupported URLs)
  if (!resourceId) {
    pushLog("info", "Access check sequential (no resource ID)", { url });
    const results = {};
    for (const p of profiles) {
      results[p.authIndex] = await probeAccessInPage(tabId, url, p.authIndex);
    }
    return results;
  }
  
  // Check cache first (using email-based keys)
  const cachePromises = profiles.map(async (p) => {
    const cached = getCachedResult(resourceId, p);
    if (cached) {
      pushLog("info", "Access check cache hit", { resourceId, authIndex: p.authIndex, email: p.email });
      return { authIndex: p.authIndex, result: cached, cached: true };
    }
    return null;
  });
  
  const cachedResults = await Promise.all(cachePromises);
  const results = {};
  const profilesToCheck = [];
  
  cachedResults.forEach((cached, idx) => {
    if (cached) {
      results[cached.authIndex] = cached.result;
    } else {
      profilesToCheck.push(profiles[idx]);
    }
  });
  
  // Run remaining checks in parallel
  if (profilesToCheck.length > 0) {
    pushLog("info", "Access check parallel execution", { 
      resourceId, 
      cached: cachedResults.filter(c => c).length,
      checking: profilesToCheck.length 
    });
    
    const checkPromises = profilesToCheck.map(async (p) => {
      try {
        const result = await probeAccessInPage(tabId, url, p.authIndex);
        setCachedResult(resourceId, p, result);
        return { authIndex: p.authIndex, result, cached: false };
      } catch (e) {
        pushLog("error", "Access check failed for profile", { authIndex: p.authIndex, error: String(e) });
        const errorResult = { status: "unknown", reason: "check_error" };
        return { authIndex: p.authIndex, result: errorResult, cached: false };
      }
    });
    
    const freshResults = await Promise.all(checkPromises);
    freshResults.forEach(({ authIndex, result }) => {
      results[authIndex] = result;
    });
  }
  
  return results;
}
