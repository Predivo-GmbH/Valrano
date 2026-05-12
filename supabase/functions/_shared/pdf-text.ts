import { getDocumentProxy, getResolvedPDFJS } from 'https://esm.sh/unpdf@0.12.1'

/**
 * Get the page count of a PDF without extracting text.
 */
export async function getPdfPageCount(pdfArrayBuffer: ArrayBuffer): Promise<number> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfArrayBuffer))
  const count = pdf.numPages
  pdf.cleanup()
  return count
}

/**
 * Extract text from specific pages of a PDF.
 * Uses per-page extraction to avoid loading all pages into memory at once.
 */
export async function extractTextFromPdf(
  pdfArrayBuffer: ArrayBuffer,
  pageRanges?: Array<{ start: number; end: number }>,
): Promise<{
  text: string
  pageCount: number
  extractedPages: number
}> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfArrayBuffer))
  const pageCount = pdf.numPages

  const pagesToExtract = new Set<number>()
  if (pageRanges) {
    for (const range of pageRanges) {
      for (let i = Math.max(1, range.start); i <= Math.min(pageCount, range.end); i++) {
        pagesToExtract.add(i)
      }
    }
  }

  const pages: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    if (pageRanges && !pagesToExtract.has(i)) continue

    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ')
    if (pageText.trim()) {
      pages.push(`--- Page ${i} ---\n${pageText}`)
    }
  }

  pdf.cleanup()

  return {
    text: pages.join('\n\n'),
    pageCount,
    extractedPages: pages.length,
  }
}
