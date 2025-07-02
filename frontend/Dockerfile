# Use Node.js 18
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN yarn install

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