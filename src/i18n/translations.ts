import { Language, TranslationDictionary } from './types';
import { ru } from './ru';
import { en } from './en';

export * from './types';
export * from './ru';
export * from './en';

export const translations: Record<Language, TranslationDictionary> = {
  ru,
  en,
};
