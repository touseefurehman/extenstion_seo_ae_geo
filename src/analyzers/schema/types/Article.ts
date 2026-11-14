import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const articleDef: TypeDef = {
  name: 'Article',
  aliases: [
    'NewsArticle',
    'BlogPosting',
    'TechArticle',
    'ScholarlyArticle',
    'Report',
    'SocialMediaPosting',
  ],
  required: [],
  recommended: ['headline', 'author', 'datePublished', 'dateModified', 'image'],
  optional: [
    'publisher',
    'description',
    'articleBody',
    'wordCount',
    'keywords',
    'mainEntityOfPage',
    'articleSection',
    'inLanguage',
  ],
};
