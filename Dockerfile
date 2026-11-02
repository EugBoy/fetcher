FROM node:22-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY server ./server
COPY client/dist ./client/dist
COPY fetcher-config.json ./

# Expose Dashboard port and dev proxy ports range
EXPOSE 4000 5000-5100

ENV NODE_ENV=production
ENV OPEN_BROWSER=false

CMD ["npm", "start"]
