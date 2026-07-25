import quickFileOpenApi from "./generated/quickfile-openapi.js";
import type {
  HttpMethod,
  OperationDefinition,
  SwaggerDocument,
  SwaggerOperation,
} from "./types.js";

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "delete"];

export const swaggerDocument: SwaggerDocument = quickFileOpenApi;

export const operations: OperationDefinition[] = Object.entries(
  swaggerDocument.paths,
).flatMap(([path, pathItem]) =>
  HTTP_METHODS.flatMap((method) => {
    const operation: SwaggerOperation | undefined = pathItem[method];
    return operation === undefined
      ? []
      : [
          {
            method,
            operation,
            path,
            toolName: operationIdToToolName(operation.operationId),
          },
        ];
  }),
);

const operationById = new Map(
  operations.map((definition) => [
    definition.operation.operationId,
    definition,
  ]),
);

export function findOperation(operationId: string): OperationDefinition {
  const definition = operationById.get(operationId);
  if (definition === undefined) {
    throw new Error(`Unknown QuickFile operation: ${operationId}`);
  }
  return definition;
}

export function operationIdToToolName(operationId: string): string {
  return `quickfile_${operationId}`
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll(/[^a-zA-Z0-9_]/g, "_")
    .replaceAll(/_+/g, "_")
    .toLowerCase();
}

export function operationTitle(definition: OperationDefinition): string {
  const group = definition.operation.tags?.[0] ?? "QuickFile";
  const action = definition.operation.operationId
    .replace(/^[^_]+_/, "")
    .replaceAll("_", " ");
  return `${group}: ${toTitleCase(action)}`;
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
