import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const webSiteDef: TypeDef = {
  name: 'WebSite',
  aliases: [],
  required: [],
  recommended: ['name', 'url'],
  optional: ['potentialAction', 'publisher', 'inLanguage', 'description', 'alternateName'],
};
