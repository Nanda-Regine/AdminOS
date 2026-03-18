/**
 * Native file parser — no n8n required.
 * Supports every document type a South African business uses:
 *
 * Documents : PDF, DOCX, DOC, XLSX, XLS, CSV, PPTX, TXT, MD, RTF
 * Images    : JPG, JPEG, PNG, WEBP, GIF, HEIC (via Claude vision)
 * Data      : JSON, XML
 * Audio     : MP3, M4A, WAV, OGG  (transcription placeholder)
 * Video     : MP4, MOV, AVI       (transcription placeholder)
 */

export type SupportedFileType =
  // Documents
  | 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'csv'
  | 'pptx' | 'txt' | 'md' | 'rtf'
  // Images
  | 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'heic'
  // Data
  | 'json' | 'xml'
  // Media (transcription)
  | 'mp3' | 'm4a' | 'wav' | 'ogg' | 'mp4' | 'mov' | 'avi'

export interface ParseResult {
  text: string
  fileType: SupportedFileType
  pageCount?: number
  sheetNames?: string[]
  isMedia: boolean
  needsTranscription: boolean
}

const MAX_TEXT_CHARS = 80_000 // ~20k tokens — enough for a full strategy doc

const MIME_MAP: Record<string, SupportedFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
}

const EXT_MAP: Record<string, SupportedFileType> = {
  pdf: 'pdf', docx: 'docx', doc: 'doc',
  xlsx: 'xlsx', xls: 'xls', csv: 'csv',
  pptx: 'pptx', txt: 'txt', md: 'md', rtf: 'rtf',
  jpg: 'jpg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif', heic: 'heic',
  json: 'json', xml: 'xml',
  mp3: 'mp3', m4a: 'm4a', wav: 'wav', ogg: 'ogg',
  mp4: 'mp4', mov: 'mov', avi: 'avi',
}

export function detectFileType(filename: string, mimeType: string): SupportedFileType | null {
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType]
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_MAP[ext] || null
}

export function isImageType(ft: SupportedFileType): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ft)
}

export function isMediaType(ft: SupportedFileType): boolean {
  return ['mp3', 'm4a', 'wav', 'ogg', 'mp4', 'mov', 'avi'].includes(ft)
}

export function getAllowedMimeTypes(): string[] {
  return Object.keys(MIME_MAP)
}

export function getAllowedExtensions(): string[] {
  return Object.keys(EXT_MAP)
}

/** Parse a file buffer into plain text */
export async function parseFile(
  buffer: Buffer,
  fileType: SupportedFileType,
  mimeType: string
): Promise<ParseResult> {
  if (isMediaType(fileType)) {
    return {
      text: '',
      fileType,
      isMedia: true,
      needsTranscription: true,
    }
  }

  if (isImageType(fileType)) {
    // Images are handled by Claude vision in the AI layer
    return {
      text: `[IMAGE:${fileType}]`,
      fileType,
      isMedia: true,
      needsTranscription: false,
    }
  }

  switch (fileType) {
    case 'pdf': return parsePDF(buffer, fileType)
    case 'docx': return parseDOCX(buffer, fileType)
    case 'doc': return parseDOC(buffer, fileType)
    case 'xlsx':
    case 'xls': return parseExcel(buffer, fileType)
    case 'csv': return parseCSV(buffer, fileType)
    case 'pptx': return parsePPTX(buffer, fileType)
    case 'json': return parseJSON(buffer, fileType)
    case 'xml': return parseXML(buffer, fileType)
    case 'txt':
    case 'md':
    case 'rtf':
    default:
      return parsePlainText(buffer, fileType)
  }
}

async function parsePDF(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  const pdfParse = (await import('pdf-parse')).default
  const result = await pdfParse(buffer)
  return {
    text: result.text.slice(0, MAX_TEXT_CHARS),
    fileType,
    pageCount: result.numpages,
    isMedia: false,
    needsTranscription: false,
  }
}

async function parseDOCX(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: result.value.slice(0, MAX_TEXT_CHARS),
    fileType,
    isMedia: false,
    needsTranscription: false,
  }
}

async function parseDOC(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  // Legacy .doc files — try mammoth (partial support), fall back to raw text extraction
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return {
      text: result.value.slice(0, MAX_TEXT_CHARS),
      fileType,
      isMedia: false,
      needsTranscription: false,
    }
  } catch {
    // .doc binary format — extract readable strings as fallback
    const raw = buffer.toString('latin1')
    const text = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim()
    return {
      text: text.slice(0, MAX_TEXT_CHARS),
      fileType,
      isMedia: false,
      needsTranscription: false,
    }
  }
}

async function parseExcel(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = workbook.SheetNames

  const textParts: string[] = []
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) {
      textParts.push(`--- Sheet: ${sheetName} ---\n${csv}`)
    }
  }

  return {
    text: textParts.join('\n\n').slice(0, MAX_TEXT_CHARS),
    fileType,
    sheetNames,
    isMedia: false,
    needsTranscription: false,
  }
}

async function parseCSV(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  const text = buffer.toString('utf-8')
  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    fileType,
    isMedia: false,
    needsTranscription: false,
  }
}

async function parsePPTX(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  // Extract text from PPTX (ZIP archive containing XML files)
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const slideTexts: string[] = []

    const slideFiles = Object.keys(zip.files)
      .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort()

    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async('string')
      // Extract text between <a:t> tags
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
      const slideText = matches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .filter(Boolean)
        .join(' ')
      if (slideText.trim()) slideTexts.push(slideText)
    }

    return {
      text: slideTexts.join('\n\n').slice(0, MAX_TEXT_CHARS),
      fileType,
      pageCount: slideTexts.length,
      isMedia: false,
      needsTranscription: false,
    }
  } catch {
    return { text: '[PPTX: could not extract text]', fileType, isMedia: false, needsTranscription: false }
  }
}

async function parseJSON(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  try {
    const obj = JSON.parse(buffer.toString('utf-8'))
    return {
      text: JSON.stringify(obj, null, 2).slice(0, MAX_TEXT_CHARS),
      fileType,
      isMedia: false,
      needsTranscription: false,
    }
  } catch {
    return { text: buffer.toString('utf-8').slice(0, MAX_TEXT_CHARS), fileType, isMedia: false, needsTranscription: false }
  }
}

async function parseXML(buffer: Buffer, fileType: SupportedFileType): Promise<ParseResult> {
  const raw = buffer.toString('utf-8')
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    fileType,
    isMedia: false,
    needsTranscription: false,
  }
}

function parsePlainText(buffer: Buffer, fileType: SupportedFileType): ParseResult {
  return {
    text: buffer.toString('utf-8').slice(0, MAX_TEXT_CHARS),
    fileType,
    isMedia: false,
    needsTranscription: false,
  }
}
