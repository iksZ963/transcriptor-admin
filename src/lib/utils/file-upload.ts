import { put } from "@vercel/blob"
import { v4 as uuidv4 } from "uuid"

/**
 * Upload a file to Vercel Blob Storage
 * @param file The file to upload
 * @param folder The folder to store the file in
 * @returns The URL of the uploaded file
 */
export async function uploadFile(file: File, folder = "uploads"): Promise<string> {
  try {
    // Generate a unique filename
    const filename = `${folder}/${uuidv4()}-${file.name}`

    // Upload the file to Vercel Blob Storage
    const blob = await put(filename, file, {
      access: "public",
    })

    return blob.url
  } catch (error) {
    console.error("Error uploading file:", error)
    throw new Error("Failed to upload file")
  }
}

/**
 * Upload a module ZIP file
 * @param file The ZIP file to upload
 * @param moduleId The ID of the module
 * @param tier The tier of the module (basic, plus, premium)
 * @returns The URL of the uploaded file
 */
export async function uploadModuleZip(file: File, moduleId: string, tier: string): Promise<string> {
  return uploadFile(file, `modules/${moduleId}/${tier}`)
}

/**
 * Upload a module icon
 * @param file The icon file to upload
 * @param moduleId The ID of the module
 * @param tier The tier of the module (basic, plus, premium)
 * @returns The URL of the uploaded file
 */
export async function uploadModuleIcon(file: File, moduleId: string, tier: string): Promise<string> {
  return uploadFile(file, `icons/${moduleId}/${tier}`)
}
