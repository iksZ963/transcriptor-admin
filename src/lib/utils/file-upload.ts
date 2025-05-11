import { v4 as uuidv4 } from "uuid"
import fs from "fs"
import path from "path"

/**
 * Upload a file to local storage
 * @param file The file to upload
 * @param folder The folder to store the file in
 * @returns The URL of the uploaded file
 */
export async function uploadFile(file: File, folder = "uploads"): Promise<string> {
  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create directory if it doesn't exist
    const publicDir = path.join(process.cwd(), "public")
    const uploadDir = path.join(publicDir, folder)

    // Create directories recursively
    fs.mkdirSync(uploadDir, { recursive: true })

    // Generate unique filename
    const uniqueFilename = `${uuidv4()}-${file.name}`
    const filePath = path.join(uploadDir, uniqueFilename)

    // Write file to disk
    fs.writeFileSync(filePath, buffer)

    // Return URL that can be used in the app
    // This URL is relative to the public directory
    console.log(`/${folder}/${uniqueFilename}`)
    return `/${folder}/${uniqueFilename}`
  } catch (error) {
    console.error("Error saving file locally:", error)
    throw new Error(`Failed to save file locally: ${(error as Error).message}`)
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
