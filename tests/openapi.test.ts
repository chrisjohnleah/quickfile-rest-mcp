import { describe, expect, it } from "vitest";
import {
  findOperation,
  operations,
  swaggerDocument,
} from "../src/openapi.js";
import { createOperationInputSchema } from "../src/schema.js";

describe("QuickFile OpenAPI mapping", () => {
  it("maps every current operation to one unique MCP tool", () => {
    expect(operations).toHaveLength(75);
    expect(new Set(operations.map(({ toolName }) => toolName)).size).toBe(75);
    expect(
      new Set(operations.map(({ operation }) => operation.operationId)).size,
    ).toBe(75);
    expect(operations.some(({ method }) => method === "get")).toBe(true);
    expect(operations.some(({ method }) => method === "post")).toBe(true);
    expect(operations.some(({ method }) => method === "put")).toBe(true);
    expect(operations.some(({ method }) => method === "delete")).toBe(true);
  });

  it("creates typed path and query input schemas", () => {
    const schema = createOperationInputSchema(
      findOperation("Client_Get"),
      swaggerDocument.definitions,
    );
    expect(schema.safeParse({ id: 123, contacts: true }).success).toBe(true);
    expect(schema.safeParse({ id: "123" }).success).toBe(false);
    expect(schema.safeParse({ contacts: true }).success).toBe(false);
  });

  it("requires approval fields for writes and stronger acknowledgement for deletes", () => {
    const createSchema = createOperationInputSchema(
      findOperation("Invoice_Post"),
      swaggerDocument.definitions,
    );
    expect(createSchema.safeParse({ body: {}, confirm: false }).success).toBe(
      false,
    );
    expect(
      createSchema.safeParse({
        body: { client_id: 1, currency: "GBP", type: "invoice" },
        confirm: true,
      }).success,
    ).toBe(true);

    const deleteSchema = createOperationInputSchema(
      findOperation("Client_Delete"),
      swaggerDocument.definitions,
    );
    expect(
      deleteSchema.safeParse({
        confirmation: "DELETE Client_Delete",
        confirm: true,
        id: 7,
      }).success,
    ).toBe(true);
    expect(
      deleteSchema.safeParse({
        confirmation: "yes",
        confirm: true,
        id: 7,
      }).success,
    ).toBe(false);
  });

  it("exposes a structured base64 file input for multipart document tools", () => {
    const schema = createOperationInputSchema(
      findOperation("Document_UploadSales"),
      swaggerDocument.definitions,
    );
    expect(
      schema.safeParse({
        confirm: true,
        file: {
          contentBase64: "aGVsbG8=",
          contentType: "text/plain",
          name: "receipt.txt",
        },
        invoice_id: 42,
      }).success,
    ).toBe(true);
  });
});
