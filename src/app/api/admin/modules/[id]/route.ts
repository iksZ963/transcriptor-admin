import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { updateModuleSchema } from "@/lib/validations/module"
import { uploadFile } from "@/lib/utils/file-upload"

// GET /api/admin/modules/[id] - Get a specific module (admin only)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication and admin status
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 })
    }

    const { id } = params

    // Get the module
    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        tiers: true,
        _count: {
          select: {
            packageModules: true,
          },
        },
      },
    })

    if (!module) {
      return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })
    }

    // Get usage statistics
    const usageStats = await prisma.moduleUsage.findMany({
      where: {
        moduleTierId: id,
      },
      orderBy: {
        lastUpdated: "desc",
      },
      take: 10, // Get top 10 users by usage
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      module,
      usageStats,
    })
  } catch (error) {
    console.error("Error fetching module:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred while fetching the module" },
      { status: 500 },
    )
  }
}

// PUT /api/admin/modules/[id] - Update a module (admin only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication and admin status
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 })
    }

    const { id } = params

    // Check if the module exists
    const existingModule = await prisma.module.findUnique({
      where: { id },
      include: {
        tiers: true,
      },
    })

    if (!existingModule) {
      return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })
    }

    // Check if the request is multipart/form-data
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data
      const formData = await req.formData()

      // Extract module data
      const name = formData.get("name") as string
      const description = (formData.get("description") as string) || ""
      const status = (formData.get("status") as string) || "active"

      // Update the module
      await prisma.module.update({
        where: { id },
        data: {
          name,
          description,
          status,
        },
      })

      // Process tiers
      const tiers = ["basic", "plus", "premium"]
      const updatedTiers = []

      // Delete existing tiers
      await prisma.moduleTier.deleteMany({
        where: { moduleId: id },
      })

      for (const tier of tiers) {
        // Get tier-specific data
        const slugifiedName = name.toLowerCase().replace(/[^a-z0-9]/g, "_")
        const entitlementName = `mod_${slugifiedName}_${tier}`
        const webviewUrl = (formData.get(`${tier}_webviewUrl`) as string) || null
        const hasTextProduction = formData.get(`${tier}_hasTextProduction`) === "true"
        const hasConclusion = formData.get(`${tier}_hasConclusion`) === "true"
        const hasMap = formData.get(`${tier}_hasMap`) === "true"
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

        // Get files
        const zipFile = formData.get(`${tier}_zipFile`) as File | null
        const iconFile = formData.get(`${tier}_iconFile`) as File | null

        // Find existing tier
        const existingTier = existingModule.tiers.find((t) => t.tier === tier)

        // Use existing URLs if files are not provided
        let zipFileUrl = existingTier?.zipFileUrl || null
        let iconUrl = existingTier?.iconUrl || null

        // Upload files if provided
       if (zipFile) {
          try {
            // Use direct function call instead of fetch
            const folderPath = `modules/${id}/${tier}`
            console.log(folderPath)
            zipFileUrl = await uploadFile(zipFile, folderPath)
            console.log(`Uploaded ZIP file for ${tier} tier:`, zipFileUrl)
          } catch (uploadError) {
            console.error(`Error uploading ZIP file for ${tier} tier:`, uploadError)
          }
        }

        if (iconFile) {
          try {
            // Use direct function call instead of fetch
            const folderPath = `icons/${module.id}/${tier}`
            iconUrl = await uploadFile(iconFile, folderPath)
            console.log(`Uploaded icon file for ${tier} tier:`, iconUrl)
          } catch (uploadError) {
            console.error(`Error uploading icon file for ${tier} tier:`, uploadError)
          }
        }

        // Create the tier
        const updatedTier = await prisma.moduleTier.create({
          data: {
            moduleId: id,
            tier,
            entitlementName,
            webviewUrl,
            zipFileUrl,
            iconUrl,
            hasTextProduction,
            hasConclusion,
            hasMap,
            textProductionLimit: textLimit,
            mapLimit,
            conclusionLimit: conclutionLimit,
          },
        });

        updatedTiers.push(updatedTier)
      }

      // Get the complete module with tiers
      const completeModule = await prisma.module.findUnique({
        where: { id },
        include: {
          tiers: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Module updated successfully",
        module: completeModule,
      })
    } else {
      // Handle JSON request
      const body = await req.json()

      // Validate input
      const result = updateModuleSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Invalid input", errors: result.error.errors },
          { status: 400 },
        )
      }

      const { name, description, status, tiers } = result.data

      // Update the module
      const updateData: any = {}

      if (name !== undefined) {
        updateData.name = name
      }

      if (description !== undefined) {
        updateData.description = description
      }

      if (status !== undefined) {
        updateData.status = status
      }

      const updatedModule = await prisma.module.update({
        where: { id },
        data: updateData,
        include: {
          tiers: true,
        },
      })

      // Update tiers if provided
      if (tiers && tiers.length > 0) {
        // Delete existing tiers
        await prisma.moduleTier.deleteMany({
          where: { moduleId: id },
        })

        // Create new tiers
        await prisma.moduleTier.createMany({
          data: tiers.map((tier) => {
            // Generate the entitlementName based on module name and tier
            const slugifiedName = name
              ? name.toLowerCase().replace(/[^a-z0-9]/g, "_")
              : existingModule.name.toLowerCase().replace(/[^a-z0-9]/g, "_")
            const entitlementName = `mod_${slugifiedName}_${tier.tier}`

            return {
              moduleId: id,
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
        })

        // Fetch the updated module with tiers
        const moduleWithTiers = await prisma.module.findUnique({
          where: { id },
          include: {
            tiers: true,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Module updated successfully",
          module: moduleWithTiers,
        })
      }

      return NextResponse.json({
        success: true,
        message: "Module updated successfully",
        module: updatedModule,
      })
    }
  } catch (error) {
    console.error("Error updating module:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred while updating the module" },
      { status: 500 },
    )
  }
}

// DELETE /api/admin/modules/[id] - Delete a module (admin only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication and admin status
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 })
    }

    const { id } = params

    // Check if the module exists
    const existingModule = await prisma.module.findUnique({
      where: { id },
    })

    if (!existingModule) {
      return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })
    }

    // Delete the module
    await prisma.module.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Module deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting module:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred while deleting the module" },
      { status: 500 },
    )
  }
}
