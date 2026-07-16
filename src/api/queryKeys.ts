export const scheduleQueryKeys = {
  all: ['schedule'] as const,
  templates: ['schedule', 'templates'] as const,
  exceptions: ['schedule', 'exceptions'] as const,
  exceptionsForMonth: (month: string) => ['schedule', 'exceptions', month] as const,
};
