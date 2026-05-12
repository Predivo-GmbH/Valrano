import { getDocument } from 'https://esm.sh/pdfjs-dist@4.9.155/legacy/build/pdf.mjs'

/**
 * Extract text from a PDF. Supports full extraction or specific page ranges.
 */
export async function extractTextFromPdf(
  pdfArrayBuffer: ArrayBuffer,
  pageRanges?: Array<{ start: number; end: number }>,
): Promise<{
  text: string
  pageCount: number
  extractedPages: number
}> {
  const pdf = await getDocument({ data: new Uint8Array(pdfArrayBuffer) }).promise
  const pageCount = pdf.numPages
  const pages: string[] = []

  const pagesToExtract = new Set<number>()
  if (pageRanges) {
    for (const range of pageRanges) {
      for (let i = Math.max(1, range.start); i <= Math.min(pageCount, range.end); i++) {
        pagesToExtract.add(i)
      }
    }
  }

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

  return {
    text: pages.join('\n\n'),
    pageCount,
    extractedPages: pages.length,
  }
}
