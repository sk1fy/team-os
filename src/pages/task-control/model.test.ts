import { describe, expect, it } from 'vitest';
import {
  countChanges,
  crmIds,
  newRule,
  pipelineState,
  readProof,
  readReferences,
  ruleChange,
  ruleLimits,
  scopeLines,
  toggleId,
} from './model';
const uuid = '10000000-0000-4000-8000-000000000001';
const proof = (changes = {}) =>
  'test.' +
  btoa(
    JSON.stringify({
      purpose: 'link',
      accountId: '123',
      product: 'task-control',
      aud: 'teamos-task-control',
      requestId: uuid,
      installationId: uuid,
      integrationId: uuid,
      exp: Date.now() / 1000 + 60,
      ...changes,
    }),
  ).replace(/=/g, '') +
  '.signature';
describe('Task Control forms', () => {
  it('routes proof only to its account and purpose and rejects expired codes', () => {
    expect(readProof(proof(), 'link', '123').requestId).toBe(uuid);
    expect(() => readProof(proof(), 'mode', '123')).toThrow();
    expect(() => readProof(proof(), 'link', '456')).toThrow();
    expect(() => readProof(proof({ exp: 1 }), 'link', '123')).toThrow();
    expect(() => readProof(proof({ product: 'lead-distribution' }), 'link', '123')).toThrow();
  });
  it('preserves safe CRM decimal IDs and rejects coercions and unsafe IDs', () => {
    expect(crmIds('1, 2;2 3')).toEqual(['1', '2', '3']);
    for (const value of ['0', '-1', '1.5', '2e3', '9007199254740992', 'abc'])
      expect(() => crmIds(value)).toThrow();
  });
});

const refs = readReferences({
  users: [
    { id: '42', name: 'Ольга', active: true },
    { id: '44', name: 'Анна', active: false },
  ],
  pipelines: [
    {
      id: '7',
      name: 'Продажи',
      statuses: [
        { id: '71', name: 'Первичный контакт' },
        { id: '72', name: 'Переговоры' },
        { id: '73', name: 'Счёт' },
        { id: '142', name: 'Успешно реализовано' },
      ],
    },
  ],
  customersSupported: true,
  customerStatuses: [{ id: '91', name: 'Повторная покупка' }],
})!;
describe('Task Control rules view', () => {
  it('reads only well-formed CRM references and keeps manual input otherwise', () => {
    expect(readReferences([])).toBeUndefined();
    expect(readReferences({ users: [] })).toBeUndefined();
    expect(refs.users.map((user) => user.name)).toEqual(['Анна', 'Ольга']);
    expect(refs.users[0].active).toBe(false);
  });
  it('treats a pipeline as whole only when every open stage is selected', () => {
    const [pipeline] = refs.pipelines;
    expect(pipelineState(undefined, pipeline)).toBe('none');
    expect(pipelineState(['71'], pipeline)).toBe('some');
    expect(pipelineState(['71', '72', '73'], pipeline)).toBe('all');
  });
  it('summarises pipelines, customers and limits for the table', () => {
    const rule = {
      ...newRule(),
      pipelines: [
        { pipelineId: '7', statusIds: ['71', '72', '73'] },
        { pipelineId: '9', statusIds: ['1', '2', '3'] },
        { pipelineId: '7', statusIds: [] },
      ],
      customers: true,
      denyExit: true,
      checkResponsible: false,
    };
    expect(scopeLines(rule, refs)).toEqual([
      { name: 'Продажи', detail: 'вся воронка' },
      { name: 'Воронка 9', detail: '3 этапа' },
      { name: 'Продажи', detail: 'нет этапов', warn: true },
      { name: 'Покупатели', detail: 'все статусы' },
    ]);
    expect(
      scopeLines({ ...rule, pipelines: [{ pipelineId: '7', statusIds: ['72'] }] }, refs)[0],
    ).toEqual({ name: 'Продажи', detail: 'Переговоры' });
    expect(ruleLimits(rule)).toEqual(['Нельзя выйти: все', 'Окно создания задачи']);
    expect(ruleLimits({ ...rule, showModal: false, checkResponsible: true })).toEqual([
      'Нельзя выйти: ответственный',
    ]);
  });
  it('counts added, changed and removed rules against the saved set', () => {
    const saved = [newRule(), newRule()];
    const added = newRule();
    const rules = [{ ...saved[0], name: 'Другое' }, added];
    expect(ruleChange(rules[0], saved)).toBe('changed');
    expect(ruleChange(added, saved)).toBe('new');
    expect(ruleChange(saved[1], saved)).toBeUndefined();
    expect(countChanges(rules, saved)).toBe(3);
    expect(countChanges(saved, saved)).toBe(0);
    expect(toggleId(['1', '2'], '1')).toEqual(['2']);
    expect(toggleId(['2'], '1')).toEqual(['2', '1']);
  });
});
