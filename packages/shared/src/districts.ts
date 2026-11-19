/**
 * The 25 administrative districts of Sri Lanka, as stable ids.
 *
 * Ids are stored in the database and used in URLs, so never rename one. Display names
 * come from i18n (`districts.<id>`).
 */
export const DISTRICTS = [
  'ampara',
  'anuradhapura',
  'badulla',
  'batticaloa',
  'colombo',
  'galle',
  'gampaha',
  'hambantota',
  'jaffna',
  'kalutara',
  'kandy',
  'kegalle',
  'kilinochchi',
  'kurunegala',
  'mannar',
  'matale',
  'matara',
  'monaragala',
  'mullaitivu',
  'nuwara-eliya',
  'polonnaruwa',
  'puttalam',
  'ratnapura',
  'trincomalee',
  'vavuniya',
] as const

export type District = (typeof DISTRICTS)[number]
