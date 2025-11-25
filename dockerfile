# ---------- 1) Install Dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Removed libc6-compat (not needed and causes repo errors)
# RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./ 
RUN npm install --legacy-peer-deps

# ---------- 2) Build the Next.js App ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npm run build

# ---------- 3) Run the App ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
