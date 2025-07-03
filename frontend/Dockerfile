# Use Node.js 20
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json yarn.lock ./

# Install dependencies with network timeout
RUN yarn config set network-timeout 300000 && \
    yarn install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN yarn build

# Install serve to run the build
RUN yarn global add serve

# Expose port
EXPOSE 3000

# Serve the built application
CMD ["serve", "-s", "build", "-l", "3000"]