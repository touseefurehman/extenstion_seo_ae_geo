export interface TypeDef {
  name: string;
  /** Subtypes treated as this type for property checks. */
  aliases: string[];
  /** Properties a specification truly mandates. Empty for every type here (schema.org mandates none). */
  required: string[];
  recommended: string[];
  optional: string[];
}
