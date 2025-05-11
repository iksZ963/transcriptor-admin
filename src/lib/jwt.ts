import jwt from "jsonwebtoken"
import { z } from "zod"

// Make sure to set these environment variables in your .env file
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d"

// Define the payload schema
const tokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  isAdmin: z.boolean(),
})

export type TokenPayload = z.infer<typeof tokenPayloadSchema>

// Generate access token
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// Generate refresh token
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN })
}

// Verify access token
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const result = tokenPayloadSchema.safeParse(decoded)

    if (!result.success) {
      console.error("Invalid token payload:", result.error)
      return null
    }

    return result.data
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET)
    const result = tokenPayloadSchema.safeParse(decoded)

    if (!result.success) {
      console.error("Invalid refresh token payload:", result.error)
      return null
    }

    return result.data
  } catch (error) {
    console.error("Refresh token verification failed:", error)
    return null
  }
}
