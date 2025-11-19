# ---------- 1) Install Dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Install OS dependencies (optional) – required for some npm packages
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./ 
RUN npm install --legacy-peer-deps

# ---------- 2) Build the Next.js App ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Make sure Next.js builds in production mode
ENV NODE_ENV=production

RUN npm run build

# ---------- 3) Run the App ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# If Next.js uses standalone output, copy it
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Start the Next.js server
CMD ["npm", "start"]
