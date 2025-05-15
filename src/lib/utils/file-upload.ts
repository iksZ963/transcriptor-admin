import { v4 as uuidv4 } from "uuid"
import fs from "fs";
import path from "path"
import AdmZip from "adm-zip"

/**
 * Upload a file to local storage
 * @param file The file to upload
 * @param folder The folder to store the file in
 * @returns The URL of the uploaded file
 */
// export async function uploadFile(file: File, folder = "uploads"): Promise<string> {
//   try {
//     // Convert File to Buffer
//     const arrayBuffer = await file.arrayBuffer()
//     const buffer = Buffer.from(arrayBuffer)

//     // Create directory if it doesn't exist
//     const publicDir = path.join(process.cwd(), "public")
//     const uploadDir = path.join(publicDir, folder)

//     // Create directories recursively
//     fs.mkdirSync(uploadDir, { recursive: true })

//     // Generate unique filename
//     const uniqueFilename = `${uuidv4()}-${file.name}`
//     const filePath = path.join(uploadDir, uniqueFilename)

//     // Write file to disk
//     fs.writeFileSync(filePath, buffer)

//     const zip = new AdmZip(filePath);
//     zip.extractAllTo(uploadDir, true);

//     // Delete original zip file
//     fs.unlinkSync(filePath);

//     // Return URL that can be used in the app
//     // This URL is relative to the public directory
//     console.log(`/${folder}`)
//     return uploadDir;
//   } catch (error) {
//     console.error("Error saving file locally:", error)
//     throw new Error(`Failed to save file locally: ${(error as Error).message}`)
//   }
// }


export async function uploadFile(
  file: File,
  folder = "uploads"
): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicDir = path.join(process.cwd(), "public");
    const uploadDir = path.join(publicDir, folder);

    // Ensure target directory exists
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(file.name).toLowerCase();

    if (ext === ".zip") {
      const tempZipPath = path.join(uploadDir, `${uuidv4()}.zip`);
      fs.writeFileSync(tempZipPath, buffer);

      const zip = new AdmZip(tempZipPath);
      zip.extractAllTo(uploadDir, true);

      fs.unlinkSync(tempZipPath);
    } else if (ext === ".html") {
      const targetPath = path.join(uploadDir, "index.html");
      fs.writeFileSync(targetPath, buffer);
    } else {
      throw new Error("Only .zip and .html files are supported.");
    }

    return uploadDir;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error(`Failed to upload file: ${(error as Error).message}`);
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





// export async function uploadAndUnzipFile(
//   file: File,
//   baseFolder: string
// ) {
//   const arrayBuffer = await file.arrayBuffer();
//   const buffer = Buffer.from(arrayBuffer);

//   const moduleId = uuidv4();
//   const uploadDir = path.join(process.cwd(), baseFolder, moduleId);

//   // Create the directory
//   fs.mkdir(uploadDir, { recursive: true });

//   // Write the zip temporarily
//   const zipPath = path.join(uploadDir, "upload.zip");
//   fs.writeFile(zipPath, buffer);

//   // Unzip
//   const zip = new AdmZip(zipPath);
//   zip.extractAllTo(uploadDir, true);

//   // Delete original zip file
//   fs.unlink(zipPath);

//   return moduleId; // This will be used in step 2
// }

