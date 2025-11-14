# FE/Dockerfile

# ---- Build stage ----
FROM node:20 AS builder

WORKDIR /app

# 패키지 메타 먼저 복사
COPY package*.json pnpm-lock.yaml* yarn.lock* ./

# lock 파일이 있으면 npm ci, 없으면 npm install
RUN if [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

# 나머지 소스 복사
COPY . .

# BE 주소를 빌드 타임에 주입 (docker-compose에서 args로 전달)
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}

# Next.js 빌드
RUN npm run build

# ---- Run stage ----
FROM node:20

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Seoul

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; \
    else npm install --omit=dev; fi

# 빌드 결과 / public만 가져오기
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# next.config, ts/js 설정 파일도 필요하면 복사
COPY --from=builder /app/next.config.* ./ 2>/dev/null || true

EXPOSE 3000

CMD ["npm", "run", "start"]
