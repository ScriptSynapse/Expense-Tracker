FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Create dirs
RUN mkdir -p uploads logs

EXPOSE 5000

CMD ["node", "src/server.js"]
