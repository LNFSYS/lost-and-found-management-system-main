export type ConfigValueType = "JSON" | "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN";

export type ListConfigsQuery = { page: number; pageSize: number; q?: string | undefined; valueType?: "JSON" | "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | undefined; isPublic?: boolean | undefined; };

export type CreateConfigInput = { valueType: "JSON" | "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN"; isPublic: boolean; configKey: string; configValue: string; description?: string | null | undefined; reason?: string | null | undefined; };

export type UpdateConfigInput = { description?: string | null | undefined; reason?: string | null | undefined; valueType?: "JSON" | "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | undefined; isPublic?: boolean | undefined; configKey?: string | undefined; configValue?: string | undefined; };

export type ConfigHistoryQuery = { limit: number; };
