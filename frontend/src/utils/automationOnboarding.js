// Per-viewer conveniences for the automation checklist. Storage can be unavailable
// (private mode, blocked site data): reads fall back to "not set", writes are best effort.

export function readFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeFlag(key) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // not remembered: the checklist simply shows it again next time
  }
}

const downloadedKey = (projectId) => `bugmind.automation.downloaded.${projectId}`

export function hasDownloaded(projectId) {
  return readFlag(downloadedKey(projectId))
}

export function markDownloaded(projectId) {
  writeFlag(downloadedKey(projectId))
}
