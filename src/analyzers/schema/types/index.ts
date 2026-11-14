import type { TypeDef } from '../typeDef';
import { articleDef } from './Article';
import { breadcrumbListDef, listItemDef } from './BreadcrumbList';
import { faqPageDef, questionDef } from './FAQPage';
import { localBusinessDef } from './LocalBusiness';
import { organizationDef } from './Organization';
import { personDef } from './Person';
import { productDef } from './Product';
import { serviceDef } from './Service';
import { webPageDef } from './WebPage';
import { webSiteDef } from './WebSite';

export const TYPE_DEFS: TypeDef[] = [
  organizationDef,
  localBusinessDef,
  personDef,
  articleDef,
  productDef,
  serviceDef,
  faqPageDef,
  breadcrumbListDef,
  webSiteDef,
  webPageDef,
  questionDef,
  listItemDef,
];

/** Finds the definition for a type name, directly or through an alias (e.g. BlogPosting → Article). */
export function findTypeDef(type: string): TypeDef | null {
  return (
    TYPE_DEFS.find((d) => d.name === type) ??
    TYPE_DEFS.find((d) => d.aliases.includes(type)) ??
    null
  );
}
