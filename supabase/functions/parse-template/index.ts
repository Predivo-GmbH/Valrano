import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import JSZip from 'https://esm.sh/jszip@3.10.1'

/**
 * parse-template: Accepts a corporate_template ID, reads the .pptx/.xlsx from
 * Storage, extracts all {{placeholder}} tokens, and stores them in the DB.
 *
 * For .pptx files: scans all slide XML for {{...}} patterns
 * For .xlsx files: scans all sheet XML for {{...}} patterns
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const { template_id } = await req.json()

    if (!template_id) {
      return jsonResponse({ error: 'template_id is required' }, 400)
    }

    // Fetch template record
    const { data: template, error: fetchErr } = await adminClient
      .from('corporate_templates')
      .select('*')
      .eq('id', template_id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !template) {
      return jsonResponse({ error: 'Template not found' }, 404)
    }

    // Update status to parsing
    await adminClient
      .from('corporate_templates')
      .update({ status: 'parsing' })
      .eq('id', template_id)

    // Download file from storage
    const { data: fileData, error: dlErr } = await adminClient
      .storage
      .from('corporate-templates')
      .download(template.storage_path)

    if (dlErr || !fileData) {
      await adminClient
        .from('corporate_templates')
        .update({ status: 'error', error_message: 'Failed to download template file' })
        .eq('id', template_id)
      return jsonResponse({ error: 'Failed to download template file' }, 500)
    }

    // Parse the zip-based file (.pptx and .xlsx are both ZIP archives)
    const arrayBuffer = await fileData.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    const placeholders = new Set<string>()
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    let slideCount = 0

    if (template.file_format === 'pptx') {
      // Scan all slide XML files
      for (const [path, file] of Object.entries(zip.files)) {
        if (path.startsWith('ppt/slides/slide') && path.endsWith('.xml')) {
          slideCount++
          const content = await (file as JSZip.JSZipObject).async('string')
          // PowerPoint may split {{placeholder}} across XML runs.
          // First try to find them in raw XML text content:
          const textContent = content.replace(/<[^>]+>/g, '')
          let match
          while ((match = placeholderRegex.exec(textContent)) !== null) {
            placeholders.add(match[1].trim())
          }
        }
      }

      // Also scan slide layouts and masters for placeholders
      for (const [path, file] of Object.entries(zip.files)) {
        if (
          (path.startsWith('ppt/slideLayouts/') || path.startsWith('ppt/slideMasters/')) &&
          path.endsWith('.xml')
        ) {
          const content = await (file as JSZip.JSZipObject).async('string')
          const textContent = content.replace(/<[^>]+>/g, '')
          let match
          while ((match = placeholderRegex.exec(textContent)) !== null) {
            placeholders.add(match[1].trim())
          }
        }
      }
    } else if (template.file_format === 'xlsx') {
      // Scan shared strings and sheet XML
      const sharedStrings = zip.file('xl/sharedStrings.xml')
      if (sharedStrings) {
        const content = await sharedStrings.async('string')
        const textContent = content.replace(/<[^>]+>/g, '')
        let match
        while ((match = placeholderRegex.exec(textContent)) !== null) {
          placeholders.add(match[1].trim())
        }
      }

      for (const [path, file] of Object.entries(zip.files)) {
        if (path.startsWith('xl/worksheets/sheet') && path.endsWith('.xml')) {
          slideCount++ // reuse as sheet count
          const content = await (file as JSZip.JSZipObject).async('string')
          const textContent = content.replace(/<[^>]+>/g, '')
          let match
          while ((match = placeholderRegex.exec(textContent)) !== null) {
            placeholders.add(match[1].trim())
          }
        }
      }
    }

    const placeholderList = Array.from(placeholders).sort()

    // Update template with results
    await adminClient
      .from('corporate_templates')
      .update({
        placeholders: placeholderList,
        slide_count: slideCount,
        status: 'ready',
        error_message: null,
      })
      .eq('id', template_id)

    return jsonResponse({
      template_id,
      placeholders: placeholderList,
      slide_count: slideCount,
      status: 'ready',
    })
  } catch (err) {
    return errorResponse(err)
  }
})
