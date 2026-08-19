/**
 * Where the signed-in session lives.
 *
 * "Remember me" is the switch: checked, the session goes to localStorage and
 * survives closing the browser; unchecked, it goes to sessionStorage and is
 * wiped the moment the tab closes. Both stores are consulted on read, with
 * sessionStorage winning, so a deliberate not-remembered login is never
 * shadowed by an older persisted one.
 *
 * This module is the single owner of those keys. The axios interceptor and
 * AuthContext both go through it -- if either read localStorage directly they
 * would miss a session-scoped login and silently send unauthenticated
 * requests.
 */

export const AUTH_KEYS = ['token', 'role', 'user']

// Any of these can throw in Safari private mode or when storage is disabled by
// policy. Losing persistence is survivable; a thrown error on every render is
// not, so every access is guarded.
function safe(fn, fallback = null) {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function readAuth(key) {
  return safe(() => sessionStorage.getItem(key) ?? localStorage.getItem(key))
}

export function writeAuth(key, value, remember) {
  safe(() => {
    const primary = remember ? localStorage : sessionStorage
    const secondary = remember ? sessionStorage : localStorage

    // Always clear the store we are not using, otherwise switching "Remember
    // me" off would leave the old persistent token behind for readAuth to find
    // after the session copy expires.
    secondary.removeItem(key)

    if (value === null || value === undefined) primary.removeItem(key)
    else primary.setItem(key, value)
  })
}

export function clearAuth() {
  safe(() => {
    for (const key of AUTH_KEYS) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }
  })
}

/**
 * Recover the "remember me" choice after a reload. If the token sits in
 * localStorage the user asked to be remembered; anything else (session-scoped,
 * or no session at all) means it stays where it is. New visitors default to
 * remembered, which is what the checkbox shows.
 */
export function rememberedByDefault() {
  return safe(() => {
    if (localStorage.getItem('token')) return true
    if (sessionStorage.getItem('token')) return false
    return true
  }, true)
}
