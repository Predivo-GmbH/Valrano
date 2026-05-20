const NEWS_DISABLED_KEY = 'valrano-news-disabled-users'
const IR_CATALOG_ENABLED_KEY = 'valrano-ir-catalog-enabled-users'

export function getNewsDisabledUsers(): Set<string> {
  try {
    const raw = localStorage.getItem(NEWS_DISABLED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function setNewsDisabledUsers(users: Set<string>) {
  localStorage.setItem(NEWS_DISABLED_KEY, JSON.stringify([...users]))
}

export function isNewsGatheringEnabled(userId: string): boolean {
  return !getNewsDisabledUsers().has(userId)
}

export function getIrCatalogEnabledUsers(): Set<string> {
  try {
    const raw = localStorage.getItem(IR_CATALOG_ENABLED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function setIrCatalogEnabledUsers(users: Set<string>) {
  localStorage.setItem(IR_CATALOG_ENABLED_KEY, JSON.stringify([...users]))
}

export function isIrCatalogEnabled(userId: string): boolean {
  return getIrCatalogEnabledUsers().has(userId)
}
