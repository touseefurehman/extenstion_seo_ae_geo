import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const serviceDef: TypeDef = {
  name: 'Service',
  aliases: ['FinancialProduct', 'FoodService', 'GovernmentService', 'TaxiService'],
  required: [],
  recommended: ['name', 'description', 'provider', 'areaServed'],
  optional: ['serviceType', 'offers', 'url', 'image', 'category', 'aggregateRating'],
};
