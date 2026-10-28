FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY frontend ./frontend
RUN mkdir -p /app/data && chown -R node:node /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/attendance.db
USER node
EXPOSE 3000
CMD ["node", "server.js"]
