import { getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1'

/**
 * Extract all text from a PDF ArrayBuffer.
 * Returns the full text with page markers for source_page references.
 */
export async function extractPdfText(pdfArrayBuffer: ArrayBuffer): Promise<{
  text: string
  pageCount: number
  charCount: number
}> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfArrayBuffer))
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (pageText) {
      pages.push(`[PAGE ${i}]\n${pageText}`)
    }
  }

  const text = pages.join('\n\n')
  return {
    text,
    pageCount: pdf.numPages,
    charCount: text.length,
  }
}
