/**
 * Convert File or Blob to Base64 string
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert multiple files to base64 array
 */
export async function filesToBase64(files: (File | Blob)[]): Promise<string[]> {
  return Promise.all(files.map(fileToBase64));
}

/**
 * Get MIME type from File or default to image/png
 */
export function getMimeType(file: File | Blob): string {
  if (file instanceof File) {
    return file.type || 'image/png';
  }
  return file.type || 'image/png';
}
