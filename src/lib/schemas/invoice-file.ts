const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ["application/pdf"]

interface FileValidationResult {
  valid: true
  fileName: string
  fileSize: number
  mimeType: string
  buffer: Uint8Array
}

interface FileValidationError {
  valid: false
  error: string
}

/**
 * Validates an uploaded file from FormData.
 * Checks: file exists, mime type is PDF, size <= 10MB.
 */
export async function validateUploadedFile(
  formData: FormData,
): Promise<FileValidationResult | FileValidationError> {
  const file = formData.get("file")

  if (!file || !(file instanceof File)) {
    return { valid: false, error: "No file provided" }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Only PDF files are allowed.`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`,
    }
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty" }
  }

  const arrayBuffer = await file.arrayBuffer()

  return {
    valid: true,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    buffer: new Uint8Array(arrayBuffer),
  }
}
