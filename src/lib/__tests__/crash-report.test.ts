import { isChunkLoadError, reloadOnceForChunk } from '@/lib/crash-report'

describe('isChunkLoadError', () => {
  it('detects "Failed to fetch dynamically imported module"', () => {
    const err = new Error('Failed to fetch dynamically imported module: https://x/assets/foo.js')
    expect(isChunkLoadError(err)).toBe(true)
  })

  it('detects "Loading chunk" errors', () => {
    const err = new Error('Loading chunk 42 failed')
    expect(isChunkLoadError(err)).toBe(true)
  })

  it('detects "error loading dynamically imported module"', () => {
    const err = new Error('error loading dynamically imported module: https://x/assets/bar.js')
    expect(isChunkLoadError(err)).toBe(true)
  })

  it('detects ChunkLoadError by name', () => {
    const err = new Error('some message')
    err.name = 'ChunkLoadError'
    expect(isChunkLoadError(err)).toBe(true)
  })

  it('ignores a normal Error', () => {
    const err = new Error('Something unexpected broke')
    expect(isChunkLoadError(err)).toBe(false)
  })
})

describe('reloadOnceForChunk', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('reloads once for a chunk then returns false on the same chunk', () => {
    const reload = vi.fn()
    const err = new Error('Failed to fetch dynamically imported module: https://x/assets/foo.js')

    expect(reloadOnceForChunk(err, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)

    expect(reloadOnceForChunk(err, reload)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads independently for a different chunk', () => {
    const reload = vi.fn()
    const errA = new Error('Failed to fetch dynamically imported module: https://x/assets/foo.js')
    const errB = new Error('Failed to fetch dynamically imported module: https://x/assets/bar.js')

    expect(reloadOnceForChunk(errA, reload)).toBe(true)
    expect(reloadOnceForChunk(errB, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
