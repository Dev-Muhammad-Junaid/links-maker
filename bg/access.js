// Access probing module for Links Maker (MV3)
import { pushLog } from './logs.js';
import { buildProfileSwitchUrl } from './url.js';

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

export async function checkAccessForProfilesInPage(tabId, url, profiles) {
  const results = {};
  for (const p of profiles) {
    results[p.authIndex] = await probeAccessInPage(tabId, url, p.authIndex);
  }
  return results;
}
