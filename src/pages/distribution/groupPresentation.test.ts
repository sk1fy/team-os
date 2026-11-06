import { describe, expect, it } from 'vitest';
import type { Rule } from '@/api/distributionRuntime';
import { funnelText, groupStatus, ruleForGroup } from './groupPresentation';

const rule = (patch: Partial<Rule> = {}): Rule => ({
  id: 'rule-1',
  bindingId: 'binding-1',
  bindingRevision: 1,
  accountId: '1',
  groupId: 'group-1',
  source: 'legacy_stage',
  pipelineId: '10',
  statusId: '20',
  active: true,
  keepCurrentResponsible: true,
  revision: 1,
  createdAt: '2026-10-07T10:00:00Z',
  updatedAt: '2026-10-07T10:00:00Z',
  ...patch,
});
const pipelines = [{ id: '10', name: 'Продажи', statuses: [{ id: '20', name: 'Новая заявка' }] }];

describe('groupPresentation', () => {
  it('prefers the active rule of the group', () => {
    const paused = rule({ id: 'paused', active: false });
    const active = rule({ id: 'active' });
    expect(ruleForGroup([paused, active], 'group-1')?.id).toBe('active');
    expect(ruleForGroup([paused], 'group-1')?.id).toBe('paused');
    expect(ruleForGroup([paused], 'other')).toBeUndefined();
  });

  it('describes group status from group and rule state', () => {
    expect(groupStatus({ active: true }, undefined).label).toBe('Требуется настройка');
    expect(groupStatus({ active: false }, rule()).label).toBe('Приостановлена');
    expect(groupStatus({ active: true }, rule({ active: false })).label).toBe('Приостановлена');
    expect(groupStatus({ active: true }, rule({ executionMode: 'observe' })).label).toBe(
      'Наблюдение',
    );
    expect(groupStatus({ active: true }, rule({ executionMode: 'live' })).tone).toBe('green');
  });

  it('names the funnel by launch type and falls back to ids without references', () => {
    expect(funnelText(undefined, pipelines)).toBe('Воронка и этап не выбраны');
    expect(funnelText(rule(), pipelines)).toBe('Продажи › Новая заявка');
    expect(funnelText(rule(), undefined)).toBe('Воронка 10 › Этап 20');
    expect(funnelText(rule({ source: 'creation', statusId: '' }), pipelines)).toBe(
      'Продажи · при создании сделки',
    );
    expect(funnelText(rule({ source: 'digital_pipeline', pipelineId: '' }), pipelines)).toBe(
      'Триггер на этапе в Digital Pipeline',
    );
  });
});
