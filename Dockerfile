# Stage 1: Build the Next.js app
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all files and build
COPY . .
RUN npm run build

# Stage 2: Run the Next.js app
FROM node:18-alpine AS runner

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --only=production
RUN npx prisma generate

# Copy build output and other necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables at runtime (Coolify will inject these)
ENV NODE_ENV=production

# Next.js listens on port 3000 by default
EXPOSE 3000

CMD ["npm", "start"]
