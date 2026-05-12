import { getDocumentProxy, extractText } from 'https://esm.sh/unpdf@0.12.1'

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
  const pdf = await getDocumentProxy(new Uint8Array(pdfArrayBuffer))
  const pageCount = pdf.numPages

  if (!pageRanges) {
    // Extract all pages
    const { text, totalPages } = await extractText(pdf, { mergePages: false })
    const pages: string[] = []
    for (let i = 0; i < text.length; i++) {
      if (text[i].trim()) {
        pages.push(`--- Page ${i + 1} ---\n${text[i]}`)
      }
    }
    return {
      text: pages.join('\n\n'),
      pageCount: totalPages,
      extractedPages: pages.length,
    }
  }

  // Extract specific page ranges
  const pagesToExtract = new Set<number>()
  for (const range of pageRanges) {
    for (let i = Math.max(1, range.start); i <= Math.min(pageCount, range.end); i++) {
      pagesToExtract.add(i)
    }
  }

  const { text } = await extractText(pdf, { mergePages: false })
  const pages: string[] = []
  for (let i = 0; i < text.length; i++) {
    if (!pagesToExtract.has(i + 1)) continue
    if (text[i].trim()) {
      pages.push(`--- Page ${i + 1} ---\n${text[i]}`)
    }
  }

  return {
    text: pages.join('\n\n'),
    pageCount,
    extractedPages: pages.length,
  }
}
