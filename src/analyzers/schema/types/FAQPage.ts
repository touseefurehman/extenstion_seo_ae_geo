import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const faqPageDef: TypeDef = {
  name: 'FAQPage',
  aliases: [],
  required: [],
  recommended: ['mainEntity'],
  optional: ['name', 'description', 'url', 'inLanguage'],
};

export const questionDef: TypeDef = {
  name: 'Question',
  aliases: [],
  required: [],
  recommended: ['name', 'acceptedAnswer'],
  optional: ['answerCount', 'author', 'dateCreated'],
};
