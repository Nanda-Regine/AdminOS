/**
 * Signed direct-to-Cloudinary uploads — no SDK dependency, just the documented
 * signing algorithm (Node's built-in crypto covers it).
 *
 * Why direct-to-Cloudinary and not through our own API route: Vercel
 * serverless functions cap request bodies well below what a real audio/video
 * file needs. Routing the binary through our server would fail on anything
 * beyond a few MB. Signing server-side and uploading client-side keeps the
 * CLOUDINARY_SECRET off the client while letting the browser talk to
 * Cloudinary directly.
 */
import { createHash } from 'crypto'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_SECRET

export interface CloudinaryUploadSignature {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  resourceType: 'video' | 'image'
}

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET)
}

/**
 * Sign an upload for a specific tenant + resource type. `resourceType` should
 * be 'video' for audio and video alike (Cloudinary treats audio as a video
 * resource) or 'image' for stills.
 */
export function signCreativeAssetUpload(
  tenantId: string,
  resourceType: 'video' | 'image',
): CloudinaryUploadSignature {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Cloudinary is not configured (missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_SECRET)')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = `adminos/${tenantId}/creative-assets`

  // Cloudinary's signing rule: alphabetically sort every param that will be
  // sent (excluding file, cloud_name, resource_type, api_key), join as
  // key=value&key=value, append the API secret, then SHA-1 hex digest.
  const paramsToSign: Record<string, string | number> = { folder, timestamp }
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join('&')

  const signature = createHash('sha1').update(signatureBase + API_SECRET).digest('hex')

  return { cloudName: CLOUD_NAME, apiKey: API_KEY, timestamp, signature, folder, resourceType }
}
