import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const webPageDef: TypeDef = {
  name: 'WebPage',
  aliases: [
    'AboutPage',
    'ContactPage',
    'CollectionPage',
    'ProfilePage',
    'ItemPage',
    'CheckoutPage',
    'SearchResultsPage',
  ],
  required: [],
  recommended: ['name', 'url', 'description'],
  optional: [
    'breadcrumb',
    'isPartOf',
    'primaryImageOfPage',
    'datePublished',
    'dateModified',
    'inLanguage',
    'mainEntity',
    'author',
    'publisher',
  ],
};
