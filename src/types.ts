export type HttpMethod = "delete" | "get" | "post" | "put";

export type SwaggerSchema = {
  $ref?: string;
  description?: string;
  enum?: readonly unknown[];
  example?: unknown;
  format?: string;
  items?: SwaggerSchema;
  maxLength?: number;
  maximum?: number;
  minLength?: number;
  minimum?: number;
  pattern?: string;
  properties?: Record<string, SwaggerSchema>;
  readOnly?: boolean;
  required?: readonly string[];
  type?: string;
};

export type SwaggerParameter = Omit<SwaggerSchema, "required"> & {
  collectionFormat?: string;
  in: "body" | "formData" | "path" | "query";
  name: string;
  required?: boolean;
  schema?: SwaggerSchema;
};

export type SwaggerOperation = {
  consumes?: readonly string[];
  description?: string;
  operationId: string;
  parameters?: readonly SwaggerParameter[];
  produces?: readonly string[];
  responses: Record<
    string,
    {
      description: string;
      schema?: SwaggerSchema;
    }
  >;
  summary?: string;
  tags?: readonly string[];
};

export type SwaggerDocument = {
  definitions: Record<string, SwaggerSchema>;
  host: string;
  info: {
    description?: string;
    title: string;
    version: string;
  };
  paths: Record<string, Partial<Record<HttpMethod, SwaggerOperation>>>;
  schemes: readonly string[];
  security?: readonly Record<string, readonly string[]>[];
  securityDefinitions?: Record<string, unknown>;
  swagger: "2.0";
};

export type OperationDefinition = {
  method: HttpMethod;
  operation: SwaggerOperation;
  path: string;
  toolName: string;
};

export type Primitive = boolean | number | string;
export type ToolArguments = Record<string, unknown>;

export type ApiResponse = {
  contentType: string;
  data: unknown;
  headers: {
    rateLimit?: number;
    rateLimitRemaining?: number;
    requestId?: string;
  };
  status: number;
};
