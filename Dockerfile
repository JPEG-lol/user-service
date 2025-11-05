# ---- Stage 1: Build ----
# Use a specific Long-Term Support (LTS) version of Node.
# Using 'alpine' results in a smaller image.
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies.
# Using 'npm ci' is faster and more reliable for production builds.
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# Prune development dependencies after the build is complete
RUN npm prune --production


# ---- Stage 2: Production ----
# Start from a fresh, minimal image for the final stage.
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Create and switch to a non-root user for security
USER node

# Copy the pruned node_modules from the 'builder' stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Copy the compiled JavaScript code from the 'builder' stage
COPY --chown=node:node --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 3001

# Set the environment to production
ENV NODE_ENV production

# The command to run the application
CMD [ "node", "dist/index.js" ]