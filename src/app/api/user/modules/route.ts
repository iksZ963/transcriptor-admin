import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

// GET /api/user/modules - Get modules the user has access to
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 })
    }

    // Get modules the user has direct access to
    const userModules = await prisma.userModule.findMany({
      where: {
        userId: user.userId,
        OR: [
          { expiresAt: null }, // Never expires
          { expiresAt: { gt: new Date() } }, // Not expired yet
        ],
      },
      include: {
        module: {
          include: {
            tiers: true,
          },
        },
      },
    })

    // Get usage information for each module
    const modulesWithUsage = await Promise.all(
      userModules.map(async (um) => {
        const moduleUsage = await prisma.moduleUsage.findFirst({
          where: {
            userId: user.userId,
            moduleId: um.moduleId,
          },
        })

        // Find the highest usage limit for the module
        const highestTier = um.module.tiers.reduce(
          (highest, current) => {
            return current.usageLimit > highest.usageLimit ? current : highest
          },
          { tier: "basic", usageLimit: 0 },
        )

        return {
          module: um.module,
          assignedAt: um.assignedAt,
          expiresAt: um.expiresAt,
          usageCount: moduleUsage ? moduleUsage.usageCount : 0,
          usageLimit: highestTier.usageLimit,
          percentUsed: highestTier.usageLimit > 0 ? ((moduleUsage?.usageCount || 0) / highestTier.usageLimit) * 100 : 0,
        }
      }),
    )

    return NextResponse.json({
      success: true,
      modules: modulesWithUsage,
    })
  } catch (error) {
    console.error("Error fetching user modules:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred while fetching user modules" },
      { status: 500 },
    )
  }
}
