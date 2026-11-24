# konkretna wersja obrazu bazowego (nie "latest")
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# najpierw tylko package*.json -> warstwa z node_modules jest cache'owana,
# dopóki nie zmienią się zależności (zmiana kodu nie powoduje ponownej instalacji)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# dopiero teraz kod aplikacji
COPY . .

# nie uruchamiamy aplikacji jako root
USER node

EXPOSE 3000

# 1. migracje przy starcie kontenera, 2. "exec" podmienia shell na proces node (PID 1),
#    dzięki czemu SIGTERM z "docker compose down" trafia bezpośrednio do aplikacji (graceful shutdown)
CMD ["sh", "-c", "node_modules/.bin/knex migrate:latest && exec node src/server.js"]
