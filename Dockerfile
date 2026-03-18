FROM node:20-alpine
RUN npm install -g mcp-openapi-runner@1.0.1
ENV OPENAPI_SPEC_URL=https://petstore3.swagger.io/api/v3/openapi.json
ENTRYPOINT ["mcp-openapi-runner"]
