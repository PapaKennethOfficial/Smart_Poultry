/**
 * Pull the most specific message out of an API error.
 *
 * Order matters, and there are THREE server shapes, not two:
 *   { message, source }  the AI gateway's own wrapper
 *   { error }            the global Express errorHandler  <-- easy to miss
 *   { detail }           FastAPI, when it surfaces unwrapped
 * A transport failure has none of them — only `err.message`.
 *
 * Never replace a real server message with a guess about configuration: that
 * is how "Set GOOGLE_API_KEY" stayed on screen for months after the service
 * had migrated to Groq, hiding whatever was actually wrong.
 */
export function apiErrorMessage(err, fallback = 'Something went wrong.') {
  const data = err?.response?.data
  const detail = data?.detail

  if (typeof data?.message === 'string' && data.message) return data.message
  // The Express global error handler responds { error: "..." }. Missing this
  // key is what reduced a real 400 to "Request failed with status code 400".
  if (typeof data?.error === 'string' && data.error) return data.error
  if (typeof detail === 'string' && detail) return detail
  // FastAPI validation errors arrive as a list of {loc, msg, type}.
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    if (first?.msg) return first.msg
  }
  if (detail && typeof detail === 'object') {
    const values = Object.values(detail).filter((v) => typeof v === 'string')
    if (values.length) return values.join('; ')
  }
  if (err?.code === 'ECONNABORTED') {
    return 'The AI service took too long to respond. It may still be training a model — try again in a minute.'
  }
  if (typeof err?.message === 'string' && err.message) return err.message
  return fallback
}

export default apiErrorMessage
