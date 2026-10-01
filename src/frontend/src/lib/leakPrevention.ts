export const NO_TRANSLATE_CLASS = 'notranslate';

export const NO_TRANSLATE_PROPS = {
  translate: 'no',
} as const;

export const SECRET_FIELD_PROPS = {
  spellCheck: false,
  autoComplete: 'off',
  autoCapitalize: 'off',
  autoCorrect: 'off',
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false',
  ...NO_TRANSLATE_PROPS,
} as const;
