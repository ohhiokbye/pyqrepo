import { z } from 'zod'

export const MATERIAL_EXTRACTION_VERSION = 'notes-v1'
export const materialPageSchema = z.object({
  pageIndex: z.number().int().min(0).max(199),
  text: z.string().max(100_000),
  heading: z.string().max(300),
  method: z.enum(['native', 'gemini-vision', 'groq-vision', 'blank']),
})
export const materialChunkSchema = z.object({
  text: z.string().trim().min(1).max(3300),
  heading: z.string().max(300),
  sourcePages: z.array(z.number().int().min(0).max(199)).min(1).max(200),
  method: z.enum(['native', 'gemini-vision', 'groq-vision']),
})

/** Keep page provenance exact; prefer paragraph boundaries to cutting a formula. */
export function chunkMaterialPages(pages: z.infer<typeof materialPageSchema>[]) {
  const chunks: z.infer<typeof materialChunkSchema>[] = []
  for (const page of pages) {
    if (!page.text.trim() || page.method === 'blank') continue
    let start = 0
    while (start < page.text.length) {
      let end = Math.min(start + 3000, page.text.length)
      if (end < page.text.length) {
        const boundary = page.text.lastIndexOf('\n\n', end)
        if (boundary > start + 1500) end = boundary
      }
      const text = page.text.slice(start, end).trim()
      if (text) chunks.push({ text, heading: page.heading, sourcePages: [page.pageIndex], method: page.method })
      if (end === page.text.length) break
      start = Math.max(start + 1, end - 300)
    }
  }
  return chunks
}
