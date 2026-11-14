import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const productDef: TypeDef = {
  name: 'Product',
  aliases: ['IndividualProduct', 'ProductModel', 'SomeProducts'],
  required: [],
  recommended: ['name', 'image', 'description', 'offers'],
  optional: ['brand', 'sku', 'gtin', 'mpn', 'aggregateRating', 'review', 'color'],
};
