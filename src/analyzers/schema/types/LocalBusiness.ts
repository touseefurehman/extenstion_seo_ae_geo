import type { TypeDef } from '../typeDef';

// `required` is intentionally empty: schema.org mandates no properties. Search-engine feature
// guidelines (for example Google rich results) are listed under `recommended`.
export const localBusinessDef: TypeDef = {
  name: 'LocalBusiness',
  aliases: [
    'Restaurant',
    'Store',
    'CafeOrCoffeeShop',
    'Dentist',
    'Hotel',
    'ProfessionalService',
    'AutoRepair',
    'HealthAndBeautyBusiness',
    'FoodEstablishment',
    'LodgingBusiness',
    'RealEstateAgent',
    'LegalService',
    'FinancialService',
  ],
  required: [],
  recommended: [
    'name',
    'address',
    'telephone',
    'url',
    'openingHoursSpecification',
    'geo',
    'image',
    'priceRange',
  ],
  optional: ['sameAs', 'logo', 'email', 'description', 'areaServed', 'hasMap', 'aggregateRating'],
};
