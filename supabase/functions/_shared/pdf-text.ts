import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

/**
 * Prepare a PDF for AI analysis by creating a subset if too large.
 * Returns base64-encoded PDF (either original or subset).
 *
 * Strategy for large reports (>100 pages):
 * - First 5 pages (cover, TOC, company overview)
 * - Last 100 pages (financial statements + notes — always at the end)
 * This ensures we capture accounting policies and KPI definitions.
 */
const MAX_PAGES = 100
const FRONT_PAGES = 5

export async function preparePdfForAnalysis(pdfArrayBuffer: ArrayBuffer): Promise<{
  base64: string
  pageCount: number
  subsetPageCount: number
  wasSubset: boolean
}> {
  const originalBytes = new Uint8Array(pdfArrayBuffer)
  const srcDoc = await PDFDocument.load(originalBytes)
  const pageCount = srcDoc.getPageCount()

  let finalBytes: Uint8Array

  if (pageCount <= MAX_PAGES) {
    // Small enough — send the whole PDF
    finalBytes = originalBytes
    return {
      base64: uint8ToBase64(finalBytes),
      pageCount,
      subsetPageCount: pageCount,
      wasSubset: false,
    }
  }

  // Large PDF: extract first 5 + last (MAX_PAGES - FRONT_PAGES) pages
  const tailCount = MAX_PAGES - FRONT_PAGES
  const tailStart = Math.max(FRONT_PAGES, pageCount - tailCount)

  const subsetDoc = await PDFDocument.create()

  // Copy front pages
  const frontIndices = Array.from({ length: Math.min(FRONT_PAGES, pageCount) }, (_, i) => i)
  const frontPages = await subsetDoc.copyPages(srcDoc, frontIndices)
  for (const page of frontPages) {
    subsetDoc.addPage(page)
  }

  // Copy tail pages (skip if they overlap with front)
  if (tailStart > FRONT_PAGES) {
    const tailIndices = Array.from({ length: pageCount - tailStart }, (_, i) => tailStart + i)
    const tailPages = await subsetDoc.copyPages(srcDoc, tailIndices)
    for (const page of tailPages) {
      subsetDoc.addPage(page)
    }
  }

  const subsetPageCount = subsetDoc.getPageCount()
  finalBytes = await subsetDoc.save()

  return {
    base64: uint8ToBase64(new Uint8Array(finalBytes)),
    pageCount,
    subsetPageCount,
    wasSubset: true,
  }
}

/** Encode Uint8Array to base64 in chunks (avoids stack overflow on large arrays) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize))
  }
  return btoa(binary)
}
