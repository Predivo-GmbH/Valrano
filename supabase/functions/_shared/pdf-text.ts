import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

/**
 * Prepare a PDF for AI analysis.
 * Always sends the complete PDF — every page is analyzed.
 */
export async function preparePdfForAnalysis(pdfArrayBuffer: ArrayBuffer): Promise<{
  base64: string
  pageCount: number
  subsetPageCount: number
  wasSubset: boolean
}> {
  const originalBytes = new Uint8Array(pdfArrayBuffer)
  const srcDoc = await PDFDocument.load(originalBytes)
  const pageCount = srcDoc.getPageCount()

  return {
    base64: uint8ToBase64(originalBytes),
    pageCount,
    subsetPageCount: pageCount,
    wasSubset: false,
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
