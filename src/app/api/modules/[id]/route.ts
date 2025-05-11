import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { checkUsageLimit } from "@/lib/utils/usage-counter"

// GET /api/modules/[id] - Get a specific module
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    const { id } = params

    // Get the module
    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        tiers: true,
      },
    })

    if (!module) {
      return NextResponse.json({ success: false, message: "Module not found" }, { status: 404 })
    }

    // Check if the user has access to the module
    const userModule = await prisma.userModule.findFirst({
      where: {
        userId: user.userId,
        moduleId: id,
        OR: [
          { expiresAt: null }, // Never expires
          { expiresAt: { gt: new Date() } }, // Not expired yet
        ],
      },
    })

    const hasAccess = !!userModule

    // If the user has access, get usage information
    let usageInfo = null
    if (hasAccess) {
      try {
        usageInfo = await checkUsageLimit(user.userId, id)
      } catch (error) {
        console.error("Error checking usage limit:", error)
      }
    }

    return NextResponse.json({
      success: true,
      module: {
        ...module,
        hasAccess,
        usageInfo,
      },
    })
  } catch (error) {
    console.error("Error fetching module:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred while fetching the module" },
      { status: 500 },
    )
  }
}
