const NEWS_DISABLED_KEY = 'benchmarksignal-news-disabled-users'

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
