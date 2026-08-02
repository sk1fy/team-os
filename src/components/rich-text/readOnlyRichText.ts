export const readOnlyRichTextAttributes = {
  // TipTap defaults every editor surface to role="textbox", including non-editable ones.
  // Expose rendered content as a static article instead of an input control.
  role: 'article',
} as const;
