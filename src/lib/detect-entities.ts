import { parsePhoneNumber, isValidPhoneNumber, type PhoneNumber } from 'libphonenumber-js'

export type DetectedEntity = {
  type: 'url' | 'email' | 'phone'
  value: string
  start: number
  end: number
  phoneNormalized?: string
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>{}|\\^`[\]]+/gi
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_PATTERN = /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g

export function detectUrls(text: string): DetectedEntity[] {
  const results: DetectedEntity[] = []
  let match: RegExpExecArray | null
  URL_PATTERN.lastIndex = 0
  while ((match = URL_PATTERN.exec(text)) !== null) {
    let value = match[0]
    if (value.startsWith('www')) {
      value = `https://${value}`
    }
    results.push({ type: 'url', value, start: match.index, end: match.index + match[0].length })
  }
  return results
}

export function detectEmails(text: string): DetectedEntity[] {
  const results: DetectedEntity[] = []
  let match: RegExpExecArray | null
  EMAIL_PATTERN.lastIndex = 0
  while ((match = EMAIL_PATTERN.exec(text)) !== null) {
    results.push({ type: 'email', value: match[0], start: match.index, end: match.index + match[0].length })
  }
  return results
}

export function detectPhones(text: string): DetectedEntity[] {
  const results: DetectedEntity[] = []
  let match: RegExpExecArray | null
  PHONE_PATTERN.lastIndex = 0
  while ((match = PHONE_PATTERN.exec(text)) !== null) {
    const raw = match[0]

    try {
      const cleaned = raw.replace(/[\s.\-\(\)]/g, '')

      if (isValidPhoneNumber(cleaned, 'BR')) {
        const parsed = parsePhoneNumber(cleaned, 'BR')
        results.push({
          type: 'phone',
          value: raw,
          start: match.index,
          end: match.index + raw.length,
          phoneNormalized: parsed.number,
        })
        continue
      }

      if (/^\d{10,15}$/.test(cleaned)) {
        const withCountry = cleaned.startsWith('55') ? cleaned : `55${cleaned}`
        if (isValidPhoneNumber(withCountry, 'BR')) {
          const parsed = parsePhoneNumber(withCountry, 'BR')
          results.push({
            type: 'phone',
            value: raw,
            start: match.index,
            end: match.index + raw.length,
            phoneNormalized: parsed.number,
          })
          continue
        }
      }

      if (cleaned.startsWith('+') && isValidPhoneNumber(cleaned)) {
        const parsed = parsePhoneNumber(cleaned)
        results.push({
          type: 'phone',
          value: raw,
          start: match.index,
          end: match.index + raw.length,
          phoneNormalized: parsed.number,
        })
      }
    } catch {
      // ignore unparseable numbers
    }
  }
  return results
}

export function detectAll(text: string): DetectedEntity[] {
  const entities = [
    ...detectUrls(text),
    ...detectEmails(text),
    ...detectPhones(text),
  ]
  entities.sort((a, b) => a.start - b.start)
  return mergeOverlapping(entities)
}

function mergeOverlapping(entities: DetectedEntity[]): DetectedEntity[] {
  if (entities.length === 0) return []
  const merged: DetectedEntity[] = [entities[0]]
  for (let i = 1; i < entities.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = entities[i]
    if (curr.start < prev.end) {
      const longer = curr.end - curr.start > prev.end - prev.start ? curr : prev
      merged[merged.length - 1] = longer
    } else {
      merged.push(curr)
    }
  }
  return merged
}
