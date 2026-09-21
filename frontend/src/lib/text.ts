/** Strips OCR page-marker artifacts and collapses excess blank lines from extracted question text. */
export function cleanText(text: string): string {
  return text
    .replace(/---\s*Question Paper Page \d+\s*---/g, '')
    .replace(/---\s*Slide\/Page \d+\s*---/g, '')
    .replace(/---\s*Page \d+\s*---/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
