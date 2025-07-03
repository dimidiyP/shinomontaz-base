# Use Node.js 20
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies with network retry
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json yarn.lock ./

# Install dependencies with retry and fallback
RUN yarn config set network-timeout 300000 && \
    yarn config set registry https://registry.npmjs.org/ && \
    yarn install --frozen-lockfile --network-timeout 300000 || \
    (rm -rf node_modules yarn.lock && yarn install)

# Copy application code
COPY . .

# Build the application
RUN yarn build

# Install serve to run the build
RUN yarn global add serve

# Remove build dependencies
RUN apk del .build-deps

# Expose port
EXPOSE 3000

# Serve the built application
CMD ["serve", "-s", "build", "-l", "3000"]