import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { createModuleSchema } from "@/lib/validations/module"
import { uploadModuleIcon, uploadModuleZip } from "@/lib/utils/file-upload"
import { moduleUsageTrackerInjection } from "@/lib/utils/usage-limit"


// GET /api/admin/modules - Get all modules (admin only)
export async function GET(req: NextRequest) {
  try {
    // Verify authentication and admin status
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 })
    }

    // Parse query parameters
    const url = new URL(req.url)
    const status = url.searchParams.get("status") || undefined

    // Build the query
    const query: any = {}

    if (status) {
      query.status = status
    }

    // Get all modules
    const modules = await prisma.module.findMany({
      where: query,
      include: {
        tiers: {
          include: {
            _count: {
              select: {
                moduleUsage: true,
                users: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      success: true,
      modules,
    })
  } catch (error) {
    console.error("Error fetching modules:", error)
    return NextResponse.json({ success: false, message: "An error occurred while fetching modules" }, { status: 500 })
  }
}

// POST /api/admin/modules - Create a new module (admin only)
export async function POST(req: NextRequest) {
  try {
    // Verify authentication and admin status
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 })
    }

    // Check if the request is multipart/form-data
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data
      const formData = await req.formData()

      // Extract module data
      const name = formData.get("name") as string
      const description = (formData.get("description") as string) || ""

      console.log("Creating module with name:", name)

      // Create the module first to get an ID
      const modulePack = await prisma.module.create({
        data: {
          name,
          description,
        },
      })

      console.log("Module created successfully:", modulePack.id)

      // Process tiers
      const tiers = ["basic", "plus", "premium"]
      const createdTiers = []

      for (const tier of tiers) {
        // Get tier-specific data
        
        const hasTextProduction =
          formData.get(`${tier}_hasTextProduction`) === "true";

        const hasConclusion = formData.get(`${tier}_hasConclusion`) === "true";
        const hasMap = formData.get(`${tier}_hasMap`) === "true";

        const textLimit = formData.get(`${tier}_textLimit`)
          ? Number.parseInt(formData.get(`${tier}_textLimit`) as string)
          : 50;

        const textProductionId = formData.get(
          `${tier}_textProductionId`
        ) as string;

        const mapLimit = formData.get(`${tier}_mapLimit`)
          ? Number.parseInt(formData.get(`${tier}_mapLimit`) as string)
          : 0;

        const mapProductionId = formData.get(
          `${tier}_mapProductionId`
        ) as string;

        const conclutionLimit = formData.get(`${tier}_conclutionLimit`)
          ? Number.parseInt(formData.get(`${tier}_conclutionLimit`) as string)
          : 0;

        const conclutionProductionId = formData.get(
          `${tier}_conclutionProductionId`
        ) as string;

        console.log(`Processing tier ${tier} for modulePack ${modulePack.id}`);

        // Get files
        const zipFile = formData.get(`${tier}_zipFile`) as File | null;
        const iconFile = formData.get(`${tier}_iconFile`) as File | null;

        // Upload files if provided
        let folderPath = null;
        let moduleUploadDir = null;
        let iconUrl = null;

        console.log({
          zipFile,
          iconFile,
        });

        if (zipFile) {
          try {
            // Use direct function call instead of fetch
            folderPath = `modules/${modulePack.id}/${tier}`;
            moduleUploadDir = await uploadModuleZip(zipFile, modulePack.id, tier);
            console.log(`Uploaded ZIP file for ${tier} tier:`, moduleUploadDir);
          } catch (uploadError) {
            console.error(
              `Error uploading ZIP file for ${tier} tier:`,
              uploadError
            );
          }
        }

        if (iconFile) {
          try {
            // Use direct function call instead of fetch
            iconUrl = await uploadModuleIcon(iconFile, modulePack.id, tier);
            console.log(`Uploaded icon file for ${tier} tier:`, iconUrl);
          } catch (uploadError) {
            console.error(
              `Error uploading icon file for ${tier} tier:`,
              uploadError
            );
          }
        }

        console.log(`Creating tier ${tier} for module ${modulePack.id}`);

        // Create the tier
        const createdTier = await prisma.moduleTier.create({
          data: {
            moduleId: modulePack.id,
            tier,
            entitlementName: "",
            webviewUrl: `${process.env.WEBVIEW_URL}?module=${modulePack.id}&tier=${tier}`,
            zipFileUrl: folderPath,
            iconUrl,
            hasTextProduction,
            hasConclusion,
            hasMap,
            textProductionLimit: textLimit,
            mapLimit: mapLimit,
            conclusionLimit: conclutionLimit,
          },
        });

        console.log(`Created tier ${tier} for module ${modulePack.id}`);

        await prisma.moduleTier.update({
          where: { id: createdTier.id },
          data: {
            entitlementName: `${modulePack.id}-${createdTier.id}-${tier}`,
          },
        });

        // script injection
        moduleUsageTrackerInjection(
          moduleUploadDir!,
          textProductionId,
          mapProductionId,
          conclutionProductionId,
          createdTier.id,
          process.env.API_BASE_URL || "http://localhost:3000",
        );

        console.log(`Tier ${tier} created successfully:`, createdTier.id);
        createdTiers.push(createdTier);
      }

      // Get the complete module with tiers
      const completeModule = await prisma.module.findUnique({
        where: { id: module.id },
        include: {
          tiers: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Module created successfully",
        module: completeModule,
      })
    } else {
      // Handle JSON request
      const body = await req.json()

      // Validate input
      const result = createModuleSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Invalid input", errors: result.error.errors },
          { status: 400 },
        )
      }

      const { name, description, tiers } = result.data

      // Create the module
      const modulePack = await prisma.module.create({
        data: {
          name,
          description,
          tiers: {
            create: tiers.map((tier) => {
              // Generate the entitlementName based on module name and tier
              const slugifiedName = name.toLowerCase().replace(/[^a-z0-9]/g, "_")
              const entitlementName = `mod_${slugifiedName}_${tier.tier}`

              return {
                tier: tier.tier,
                entitlementName,
                revCatEntitlementName: tier.revCatEntitlementName,
                webviewUrl: tier.webviewUrl,
                zipFileUrl: tier.zipFileUrl,
                iconUrl: tier.iconUrl,
                hasTextProduction: tier.hasTextProduction,
                hasConclusion: tier.hasConclusion,
                hasMap: tier.hasMap,
                usageLimit: tier.usageLimit || 50, // Default to 50 if not provided
              }
            }),
          },
        },
        include: {
          tiers: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Module created successfully",
        modulePack,
      })
    }
  } catch (error) {
    console.error("Error creating module:", error)
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while creating the module",
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}