import quickFileOpenApi from "../src/generated/quickfile-openapi.js";

const methods = new Set(["delete", "get", "post", "put"]);
const operations = Object.entries(quickFileOpenApi.paths).flatMap(
  ([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => methods.has(method))
      .map(([method, operation]) => ({
        method,
        operationId: operation.operationId,
        path,
      })),
);

const operationIds = new Set(operations.map(({ operationId }) => operationId));
if (operationIds.size !== operations.length) {
  throw new Error("The bundled QuickFile contract has duplicate operation IDs");
}

if (
  quickFileOpenApi.swagger !== "2.0" ||
  quickFileOpenApi.host !== "api-beta.quickfile.co.uk" ||
  operations.length < 70 ||
  Object.keys(quickFileOpenApi.definitions).length < 100
) {
  throw new Error("The bundled QuickFile Swagger contract failed validation");
}

console.log(
  `QuickFile contract OK: ${operations.length} operations across ${Object.keys(quickFileOpenApi.paths).length} paths and ${Object.keys(quickFileOpenApi.definitions).length} schemas.`,
);
