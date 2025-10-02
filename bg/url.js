// URL utilities for Links Maker (MV3)
import { pushLog } from './logs.js';

const GOOGLE_HOST_PATTERNS = [
  /(^|\.)google\.com$/,
  /(^|\.)cloud\.google\.com$/
];

export function isGoogleLikeHost(hostname) {
  return GOOGLE_HOST_PATTERNS.some((re) => re.test(hostname));
}

export function ensureDocsUIndex(urlObj, desiredIndex) {
  try {
    if (urlObj.hostname !== 'docs.google.com') return;
    const p = urlObj.pathname;
    const re = /(\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/)/;
    if (!re.test(p)) return;
    if (/\/(document|spreadsheets|presentation)\/u\/\d+\/d\//.test(p)) return;
    urlObj.pathname = p.replace(/\/(document|spreadsheets|presentation)\/d\//, `/$1/u/${desiredIndex}/d/`);
  } catch {}
}

export function ensureMeetUIndex(urlObj, desiredIndex) {
  try {
    if (urlObj.hostname !== 'meet.google.com') return;
    const p = urlObj.pathname || '/';
    if (/^\/u\/\d+\//.test(p)) return;
    if (p === '/') return;
    urlObj.pathname = `/u/${desiredIndex}${p.startsWith('/') ? '' : '/'}${p.replace(/^\//, '')}`;
  } catch {}
}

export function replaceAuthUserParam(urlObj, desiredIndex) {
  const params = urlObj.searchParams;
  params.set("authuser", String(desiredIndex));
  urlObj.search = params.toString();
}

export function replacePathUIndex(urlObj, desiredIndex) {
  const originalPath = urlObj.pathname;
  const replaced = originalPath.replace(/(\/)u\/(\d+)(\/|$)/, `$1u/${desiredIndex}$3`);
  if (replaced !== originalPath) {
    urlObj.pathname = replaced;
  }
}

export function buildProfileSwitchUrl(currentUrlString, desiredIndex) {
  try {
    const urlObj = new URL(currentUrlString);
    const isGoogle = isGoogleLikeHost(urlObj.hostname);

    if (isGoogle) {
      replaceAuthUserParam(urlObj, desiredIndex);
      replacePathUIndex(urlObj, desiredIndex);
      ensureDocsUIndex(urlObj, desiredIndex);
      ensureMeetUIndex(urlObj, desiredIndex);
    } else {
      replaceAuthUserParam(urlObj, desiredIndex);
    }

    return urlObj.toString();
  } catch (e) {
    pushLog("warn", "buildProfileSwitchUrl error", { error: String(e), currentUrlString, desiredIndex });
    return null;
  }
}

export function parseAuthIndexFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    const q = u.searchParams.get("authuser");
    if (q !== null && q !== undefined) return Number(q);
    const m = u.pathname.match(/\/u\/(\d+)/);
    if (m) return Number(m[1]);
  } catch {}
  return null;
}

export function parseGoogleFileId(urlString) {
  try {
    const u = new URL(urlString);
    const host = u.hostname;
    const path = u.pathname;
    let m = path.match(/\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([^/]+)/);
    if (host === 'docs.google.com' && m) {
      return { kind: m[1], id: m[2] };
    }
    m = path.match(/\/file\/d\/([^/]+)/);
    if (host === 'drive.google.com' && m) {
      return { kind: 'driveFile', id: m[1] };
    }
    const qid = u.searchParams.get('id');
    if (qid && (host.endsWith('google.com'))) {
      return { kind: 'driveFile', id: qid };
    }
  } catch {}
  return null;
}

export function isMeetUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.hostname !== 'meet.google.com') return false;
    const p = u.pathname || '/';
    if (/^\/lookup\//.test(p)) return true;
    if (/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\W|$)/i.test(p)) return true;
    if (/^\/v2\//.test(p)) return true;
    return false;
  } catch { return false; }
}
