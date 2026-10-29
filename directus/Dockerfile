FROM node:22-alpine AS extension-builder
WORKDIR /extension
COPY extension/package*.json ./
RUN npm install
COPY extension/ ./
RUN npm run build

FROM directus/directus:11
COPY --from=extension-builder --chown=node:node /extension/package.json /directus/extensions/sql-console/package.json
COPY --from=extension-builder --chown=node:node /extension/dist /directus/extensions/sql-console/dist
