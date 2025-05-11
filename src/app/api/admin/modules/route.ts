import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { createModuleSchema } from "@/lib/validations/module"

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
        tiers: true,
        _count: {
          select: {
            userModules: true,
            moduleUsage: true,
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

      // Create the module first to get an ID
      const module = await prisma.module.create({
        data: {
          name,
          description,
        },
      })

      // Process tiers
      const tiers = ["basic", "plus", "premium"]
      const createdTiers = []

      for (const tier of tiers) {
        // Get tier-specific data
        const entitlementName = `mod_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${tier}`
        const revCatEntitlementName = formData.get(`${tier}_revCatEntitlementName`) as string
        const webviewUrl = (formData.get(`${tier}_webviewUrl`) as string) || null
        const hasTextProduction = formData.get(`${tier}_hasTextProduction`) === "true"
        const hasConclusion = formData.get(`${tier}_hasConclusion`) === "true"
        const hasMap = formData.get(`${tier}_hasMap`) === "true"
        const price = formData.get(`${tier}_price`) ? Number.parseFloat(formData.get(`${tier}_price`) as string) : null
        const usageLimit = formData.get(`${tier}_usageLimit`)
          ? Number.parseInt(formData.get(`${tier}_usageLimit`) as string)
          : 50

        // Get files
        const zipFile = formData.get(`${tier}_zipFile`) as File | null
        const iconFile = formData.get(`${tier}_iconFile`) as File | null

        // Upload files if provided
        let zipFileUrl = null
        let iconUrl = null

        if (zipFile) {
          const formDataForZip = new FormData()
          formDataForZip.append("file", zipFile)
          formDataForZip.append("folder", `modules/${module.id}/${tier}`)

          const zipUploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: formDataForZip,
            headers: {
              Authorization: req.headers.get("authorization") || "",
            },
          })

          const zipUploadResult = await zipUploadResponse.json()
          if (zipUploadResult.success) {
            zipFileUrl = zipUploadResult.url
          }
        }

        if (iconFile) {
          const formDataForIcon = new FormData()
          formDataForIcon.append("file", iconFile)
          formDataForIcon.append("folder", `icons/${module.id}/${tier}`)

          const iconUploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: formDataForIcon,
            headers: {
              Authorization: req.headers.get("authorization") || "",
            },
          })

          const iconUploadResult = await iconUploadResponse.json()
          if (iconUploadResult.success) {
            iconUrl = iconUploadResult.url
          }
        }

        // Create the tier
        const createdTier = await prisma.moduleTier.create({
          data: {
            moduleId: module.id,
            tier,
            entitlementName,
            revCatEntitlementName,
            webviewUrl,
            zipFileUrl,
            iconUrl,
            hasTextProduction,
            hasConclusion,
            hasMap,
            price,
            usageLimit,
          },
        })

        createdTiers.push(createdTier)
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
      const module = await prisma.module.create({
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
        module,
      })
    }
  } catch (error) {
    console.error("Error creating module:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred while creating the module" },
      { status: 500 },
    )
  }
}
