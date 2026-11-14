import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const personDef: TypeDef = {
  name: 'Person',
  aliases: [],
  required: [],
  recommended: ['name', 'url', 'image', 'jobTitle', 'sameAs'],
  optional: [
    'description',
    'worksFor',
    'email',
    'telephone',
    'address',
    'alumniOf',
    'knowsAbout',
    'affiliation',
  ],
};
