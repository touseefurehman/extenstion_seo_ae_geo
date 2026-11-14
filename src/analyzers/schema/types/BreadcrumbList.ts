import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const breadcrumbListDef: TypeDef = {
  name: 'BreadcrumbList',
  aliases: [],
  required: [],
  recommended: ['itemListElement'],
  optional: ['name', 'numberOfItems'],
};

export const listItemDef: TypeDef = {
  name: 'ListItem',
  aliases: [],
  required: [],
  recommended: ['position', 'name', 'item'],
  optional: ['url'],
};
