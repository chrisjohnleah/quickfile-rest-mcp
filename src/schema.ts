import { z } from "zod";
import type {
  OperationDefinition,
  SwaggerParameter,
  SwaggerSchema,
} from "./types.js";

type ZodSchema = z.ZodType;

const MAX_SCHEMA_DEPTH = 16;

export function createOperationInputSchema(
  definition: OperationDefinition,
  definitions: Record<string, SwaggerSchema>,
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const parameter of definition.operation.parameters ?? []) {
    const parameterSchema =
      parameter.in === "body"
        ? schemaToZod(parameter.schema ?? {}, definitions)
        : parameter.in === "formData" && parameter.type === "file"
          ? fileSchema()
          : schemaToZod(parameterToSchema(parameter), definitions);

    const description = [
      parameter.description,
      `QuickFile ${parameter.in} parameter: ${parameter.name}.`,
    ]
      .filter(Boolean)
      .join(" ");
    const described = parameterSchema.describe(description);
    shape[inputName(parameter)] =
      parameter.required === true ? described : described.optional();
  }

  if (definition.method !== "get") {
    shape["confirm"] = z
      .literal(true)
      .describe(
        "Must be true only after the user has approved this accounting write action.",
      );
  }
  if (definition.method === "delete") {
    shape["confirmation"] = z
      .literal(`DELETE ${definition.operation.operationId}`)
      .describe(
        `Destructive-action acknowledgement. Must exactly equal DELETE ${definition.operation.operationId}.`,
      );
  }

  return z.object(shape).strict();
}

export function inputName(parameter: SwaggerParameter): string {
  if (parameter.in === "body") {
    return "body";
  }
  if (parameter.in === "formData" && parameter.type === "file") {
    return "file";
  }
  return parameter.name;
}

function schemaToZod(
  schema: SwaggerSchema,
  definitions: Record<string, SwaggerSchema>,
  seenReferences: ReadonlySet<string> = new Set(),
  depth = 0,
): ZodSchema {
  if (depth > MAX_SCHEMA_DEPTH) {
    return z.unknown();
  }

  if (schema.$ref !== undefined) {
    const name = schema.$ref.replace("#/definitions/", "");
    const target = definitions[name];
    if (target === undefined || seenReferences.has(name)) {
      return z.unknown().describe(`Recursive or unresolved QuickFile schema: ${name}`);
    }
    return schemaToZod(
      target,
      definitions,
      new Set([...seenReferences, name]),
      depth + 1,
    ).describe(schema.description ?? `QuickFile ${name} model`);
  }

  let result: ZodSchema;
  switch (schema.type) {
    case "array":
      result = z.array(
        schemaToZod(
          schema.items ?? {},
          definitions,
          seenReferences,
          depth + 1,
        ),
      );
      break;
    case "boolean":
      result = z.boolean();
      break;
    case "integer": {
      let numberSchema = z.number().int();
      if (schema.minimum !== undefined) {
        numberSchema = numberSchema.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        numberSchema = numberSchema.max(schema.maximum);
      }
      result = numberSchema;
      break;
    }
    case "number": {
      let numberSchema = z.number();
      if (schema.minimum !== undefined) {
        numberSchema = numberSchema.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        numberSchema = numberSchema.max(schema.maximum);
      }
      result = numberSchema;
      break;
    }
    case "object":
      result = objectToZod(
        schema,
        definitions,
        seenReferences,
        depth + 1,
      );
      break;
    case "string":
      result = stringToZod(schema);
      break;
    default:
      result =
        schema.properties === undefined
          ? z.unknown()
          : objectToZod(
              schema,
              definitions,
              seenReferences,
              depth + 1,
            );
  }

  return schema.description === undefined
    ? result
    : result.describe(schema.description);
}

function objectToZod(
  schema: SwaggerSchema,
  definitions: Record<string, SwaggerSchema>,
  seenReferences: ReadonlySet<string>,
  depth: number,
): ZodSchema {
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodType> = {};

  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (property.readOnly === true) {
      continue;
    }
    const propertySchema = schemaToZod(
      property,
      definitions,
      seenReferences,
      depth,
    );
    shape[name] = required.has(name) ? propertySchema : propertySchema.optional();
  }

  return z.looseObject(shape);
}

function stringToZod(schema: SwaggerSchema): ZodSchema {
  if (
    schema.enum !== undefined &&
    schema.enum.length > 0 &&
    schema.enum.every((value): value is string => typeof value === "string")
  ) {
    const [first, ...rest] = schema.enum;
    if (first !== undefined) {
      return z.enum([first, ...rest]);
    }
  }

  if (schema.format === "date-time") {
    return z.iso.datetime({ offset: true });
  }

  let result = z.string();
  if (schema.format === "date") {
    result = result.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
  }
  if (schema.minLength !== undefined) {
    result = result.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    result = result.max(schema.maxLength);
  }
  return result;
}

function parameterToSchema(parameter: SwaggerParameter): SwaggerSchema {
  return {
    ...(parameter.$ref === undefined ? {} : { $ref: parameter.$ref }),
    ...(parameter.description === undefined
      ? {}
      : { description: parameter.description }),
    ...(parameter.enum === undefined ? {} : { enum: parameter.enum }),
    ...(parameter.example === undefined ? {} : { example: parameter.example }),
    ...(parameter.format === undefined ? {} : { format: parameter.format }),
    ...(parameter.items === undefined ? {} : { items: parameter.items }),
    ...(parameter.maxLength === undefined
      ? {}
      : { maxLength: parameter.maxLength }),
    ...(parameter.maximum === undefined
      ? {}
      : { maximum: parameter.maximum }),
    ...(parameter.minLength === undefined
      ? {}
      : { minLength: parameter.minLength }),
    ...(parameter.minimum === undefined
      ? {}
      : { minimum: parameter.minimum }),
    ...(parameter.pattern === undefined ? {} : { pattern: parameter.pattern }),
    ...(parameter.properties === undefined
      ? {}
      : { properties: parameter.properties }),
    ...(parameter.readOnly === undefined
      ? {}
      : { readOnly: parameter.readOnly }),
    ...(parameter.type === undefined ? {} : { type: parameter.type }),
  };
}

function fileSchema(): z.ZodObject<Record<string, z.ZodType>> {
  return z
    .object({
      contentBase64: z
        .string()
        .min(1)
        .describe("Base64-encoded file content. Maximum decoded size: 10 MB."),
      contentType: z
        .string()
        .min(3)
        .max(100)
        .optional()
        .describe("MIME type, for example image/jpeg or application/pdf."),
      name: z
        .string()
        .min(1)
        .max(255)
        .describe("Filename including its extension."),
    })
    .strict();
}
