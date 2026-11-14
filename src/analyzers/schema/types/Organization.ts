import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const organizationDef: TypeDef = {
  name: 'Organization',
  aliases: [
    'Corporation',
    'NGO',
    'OnlineStore',
    'EducationalOrganization',
    'GovernmentOrganization',
    'MedicalOrganization',
    'NewsMediaOrganization',
    'SportsOrganization',
  ],
  required: [],
  recommended: ['name', 'url', 'logo', 'sameAs'],
  optional: [
    'contactPoint',
    'address',
    'email',
    'telephone',
    'description',
    'foundingDate',
    'legalName',
    'alternateName',
    'image',
  ],
};
