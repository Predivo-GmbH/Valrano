import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * render-benchmark-pdf — Converts benchmark document to PDF
 *
 * Strategy:
 * 1. If PDF_CONVERTER_URL is set → use Gotenberg (best quality, full CSS support)
 * 2. Otherwise → generate PDF in-edge using jsPDF (no external dependency)
 */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { document_id } = await req.json()
    if (!document_id) {
      return jsonResponse({ error: 'Missing required field: document_id' }, 400)
    }

    // 1. Load the benchmark document
    const { data: doc, error: docError } = await adminClient
      .from('benchmark_documents')
      .select('id, title, content_html, content_json, fiscal_year, trigger_company_id, customer_company_id, benchmark_rules(created_by)')
      .eq('id', document_id)
      .single()

    if (docError) throw new Error(`Document lookup failed: ${docError.message}`)
    if (!doc) return jsonResponse({ error: 'Document not found' }, 404)

    // Ownership check: user must own the benchmark rule
    const ruleCreator = (doc.benchmark_rules as { created_by?: string } | null)?.created_by
    if (ruleCreator && ruleCreator !== user.id) {
      return jsonResponse({ error: 'You do not own this document' }, 403)
    }
    if (!doc.content_html && !doc.content_json) {
      return jsonResponse({ error: 'Document has no content' }, 422)
    }

    let pdfBytes: Uint8Array
    let format: string

    // 2. Try Gotenberg first (best quality)
    const pdfConverterUrl = Deno.env.get('PDF_CONVERTER_URL')

    if (pdfConverterUrl && doc.content_html) {
      try {
        const formData = new FormData()
        formData.append('files', new Blob([doc.content_html], { type: 'text/html' }), 'index.html')

        const pdfResp = await fetch(`${pdfConverterUrl}/forms/chromium/convert/html`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(30000),
        })

        if (pdfResp.ok) {
          pdfBytes = new Uint8Array(await pdfResp.arrayBuffer())
          format = 'pdf'
        } else {
          console.warn(`Gotenberg failed (${pdfResp.status}), falling back to jsPDF`)
          pdfBytes = await generatePdfFromJson(doc)
          format = 'pdf'
        }
      } catch (e) {
        console.warn(`Gotenberg unreachable: ${e}. Falling back to jsPDF`)
        pdfBytes = await generatePdfFromJson(doc)
        format = 'pdf'
      }
    } else {
      // No Gotenberg configured — use jsPDF
      pdfBytes = await generatePdfFromJson(doc)
      format = 'pdf'
    }

    // 3. Upload to Supabase Storage
    const storagePath = `benchmarks/${doc.trigger_company_id || 'general'}/${document_id}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('reports')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // 4. Update document with PDF path
    await adminClient
      .from('benchmark_documents')
      .update({ pdf_storage_path: storagePath })
      .eq('id', document_id)

    return jsonResponse({
      success: true,
      document_id,
      pdf_storage_path: storagePath,
      format,
      size_bytes: pdfBytes.length,
    })
  } catch (err) {
    return errorResponse(err)
  }
})

/**
 * Generate PDF from document content_json using jsPDF.
 * Produces a clean, professional benchmark report PDF.
 */
async function generatePdfFromJson(doc: {
  title: string
  content_json: unknown
  content_html?: string
  fiscal_year?: number
}): Promise<Uint8Array> {
  // Dynamic import of jsPDF from esm.sh (works in Deno)
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.2')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Helper: add text with word wrap
  const addWrappedText = (text: string, fontSize: number, isBold = false) => {
    pdf.setFontSize(fontSize)
    if (isBold) pdf.setFont('helvetica', 'bold')
    else pdf.setFont('helvetica', 'normal')

    const lines = pdf.splitTextToSize(text, contentWidth)
    for (const line of lines) {
      if (y > 270) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += fontSize * 0.45
    }
    y += 3
  }

  // Header
  pdf.setFillColor(59, 130, 246) // brand blue
  pdf.rect(0, 0, pageWidth, 30, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Valrano', margin, 14)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Competitive Intelligence Report', margin, 22)
  pdf.setTextColor(0, 0, 0)
  y = 40

  // Title
  addWrappedText(doc.title || 'Benchmark Report', 16, true)
  if (doc.fiscal_year) {
    addWrappedText(`Fiscal Year ${doc.fiscal_year}`, 10)
  }
  y += 5

  // Content from JSON
  const content = doc.content_json as {
    executive_summary?: string
    key_findings?: string[]
    sections?: { title: string; narrative: string; kpi_comparisons?: unknown[] }[]
    risk_flags?: string[]
  } | null

  if (content) {
    // Executive Summary
    if (content.executive_summary) {
      addWrappedText('Executive Summary', 13, true)
      addWrappedText(content.executive_summary, 10)
      y += 3
    }

    // Key Findings
    if (content.key_findings?.length) {
      addWrappedText('Key Findings', 13, true)
      for (const finding of content.key_findings) {
        addWrappedText(`  \u2022 ${finding}`, 10)
      }
      y += 3
    }

    // Sections
    if (content.sections?.length) {
      for (const section of content.sections) {
        addWrappedText(section.title, 12, true)
        addWrappedText(section.narrative, 10)

        if (section.kpi_comparisons?.length) {
          const comps = section.kpi_comparisons as {
            kpi_name: string
            trigger_company_value: number | null
            customer_company_value: number | null
            peer_median: number | null
            signal: string
          }[]
          for (const kpi of comps) {
            const signal = kpi.signal === 'advantage' ? '+' : kpi.signal === 'risk' ? '!' : '-'
            const line = `  [${signal}] ${kpi.kpi_name}: Company=${kpi.customer_company_value ?? 'N/A'}, Trigger=${kpi.trigger_company_value ?? 'N/A'}, Peer Median=${kpi.peer_median ?? 'N/A'}`
            addWrappedText(line, 9)
          }
        }
        y += 3
      }
    }

    // Risk Flags
    if (content.risk_flags?.length) {
      addWrappedText('Risk Flags', 13, true)
      for (const flag of content.risk_flags) {
        addWrappedText(`  \u26A0 ${flag}`, 10)
      }
    }
  } else if (doc.content_html) {
    // Fallback: strip HTML tags and render as text
    const textContent = doc.content_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    addWrappedText(textContent, 10)
  }

  // Footer
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(128, 128, 128)
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' })
    pdf.text(`Generated by Valrano | ${new Date().toISOString().split('T')[0]}`, margin, 290)
  }

  // Return as Uint8Array
  const arrayBuffer = pdf.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}
