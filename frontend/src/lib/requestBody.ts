export class RequestBodyError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  if (!request.body) throw new RequestBodyError(400, 'A JSON body is required.')
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestBodyError(413, 'Request is too large.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new RequestBodyError(413, 'Request is too large.') }
      chunks.push(value)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { throw new RequestBodyError(400, 'Invalid JSON body.') }
  } finally { reader.releaseLock() }
}
