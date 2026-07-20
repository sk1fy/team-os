import { rakursGet, rakursPost, type RakursContext } from './client';

export type DuplicateEntity = 'contacts' | 'companies' | 'leads';
export type JoinCondition = 'or' | 'and';
export type UnionTarget = 'not' | 'old' | 'new';

export interface DuplicateFieldClause {
  fields: string[];
  ignore: string;
  condition: JoinCondition;
  placeholder?: string;
  [key: string]: unknown;
}

export interface DuplicateManagerSetting {
  manager: string | null;
  isUnion: UnionTarget;
  [key: string]: unknown;
}

export interface DuplicateSettings {
  background_search: 'left' | 'right';
  events: boolean;
  fields: DuplicateFieldClause[];
  manager: DuplicateManagerSetting[];
  massSearch: Record<DuplicateEntity, DuplicateFieldClause>;
  union: {
    contacts: { target: UnionTarget; [key: string]: unknown };
    companies: { target: UnionTarget; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DuplicateResourceOption {
  value: string;
  label: string;
  entity?: DuplicateEntity;
  group?: string;
}

export interface DuplicateResources {
  fields: DuplicateResourceOption[];
  backgroundFields: DuplicateResourceOption[];
  managers: DuplicateResourceOption[];
  pipelines: DuplicateResourceOption[];
  stages: DuplicateResourceOption[];
  tags: DuplicateResourceOption[];
  salesbots: DuplicateResourceOption[];
}

export interface DuplicatePaidStatus {
  countAvailableUsers: number;
  [key: string]: unknown;
}

export interface LeadDuplicateRule {
  index: string;
  fields: string[];
  stages: string[];
  ignore: string;
  condition: JoinCondition;
  unionMethodLead: UnionTarget | 'nothing';
  assignMethodResponsible: 'not' | 'listUsers' | 'distributionLeadsWidget';
  assignResponsible: 'contact' | 'last_lead' | 'assignResponsibleManager';
  responsibleId: string | null;
  salesbotId: string | null;
  [key: string]: unknown;
}

export interface DuplicateRuleSettings {
  name: string;
  typeSearchLeads: 'contact' | 'company';
  searchСonditionContact: Record<string, DuplicateFieldClause>;
  searchСonditionCompany: Record<string, DuplicateFieldClause>;
  searchContactFinishRunSalesBotId: string | null;
  unionMethodContact: 'old' | 'new';
  unionMethodCompany: 'old' | 'new';
  leadsRules: LeadDuplicateRule[];
  script_last_lead: boolean;
  script_run_widget: boolean;
  script_last_lead_settings: RuleCompletionSettings;
  script_run_widget_settings: RuleCompletionSettings;
  no_comment: boolean;
  [key: string]: unknown;
}

export interface RuleCompletionSettings {
  stages?: string[];
  tag: string[];
  move_stage: string | null;
  salesbotId: string | null;
  assignMethodResponsible?: 'not' | 'listUsers' | 'distributionLeadsWidget';
  assignResponsible?: 'contact' | 'last_lead' | 'assignResponsibleManager';
  responsibleId?: string | null;
  [key: string]: unknown;
}

export interface DuplicateRule {
  token: string;
  setting: DuplicateRuleSettings;
  name: string;
  countCheck: number;
  lastCheck: string | null;
  [key: string]: unknown;
}

export interface MassSearchStatus {
  active: boolean;
  status: 0 | 1 | 2;
  countObjects: number;
  resultCount: number;
  resultDate: string | null;
  [key: string]: unknown;
}

export interface DuplicateResultItem {
  id: string;
  entityType: DuplicateEntity | 'customers';
  fieldId: string;
  fieldName: string;
  oldValue: string;
  searchValue: string;
  count: number;
  link?: string;
  data: DuplicateResultDetail[];
  [key: string]: unknown;
}

export interface DuplicateResultDetail {
  id: string;
  entityType: DuplicateEntity | 'customers';
  fieldName: string;
  oldValue: string;
  link?: string;
  [key: string]: unknown;
}

export interface MassSearchResults {
  items: DuplicateResultItem[];
  totalCount: number;
  limit: number;
}

const DUPLICATES_BASE_URL = (
  import.meta.env.VITE_RAKURS_DUPLICATES_API_URL ?? 'https://ssd.rkrs.ru/api/v1/rkrs_duplicates_v2'
).replace(/\/$/, '');

const ACCOUNT_BASE_URL = (
  import.meta.env.VITE_RAKURS_ACCOUNT_API_URL ?? 'https://ssd.rkrs.ru/api/account'
).replace(/\/$/, '');

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asJsonRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string') return asRecord(value);
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown, fallback = ''): string =>
  value === null || value === undefined ? fallback : String(value);
const asNumber = (value: unknown, fallback = 0): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : value === 1 || value === '1' ? true : fallback;

function payload(value: unknown): unknown {
  const record = asRecord(value);
  return Object.prototype.hasOwnProperty.call(record, 'data') ? record.data : value;
}

function messageFrom(value: unknown, fallback: string): string {
  const record = asRecord(value);
  return asString(record.message, fallback);
}

function assertSuccessful(value: unknown, fallback: string) {
  const record = asRecord(value);
  if (record.status === false || record.success === false) {
    throw new Error(messageFrom(value, fallback));
  }
}

function normalizeCondition(value: unknown): JoinCondition {
  return value === 'and' ? 'and' : 'or';
}

function normalizeTarget(value: unknown, fallback: UnionTarget = 'not'): UnionTarget {
  return value === 'old' || value === 'new' || value === 'not' ? value : fallback;
}

function normalizeClause(value: unknown, placeholder?: string): DuplicateFieldClause {
  const source = asRecord(value);
  return {
    ...source,
    fields: asArray(source.fields).map(String),
    ignore: asString(source.ignore),
    condition: normalizeCondition(source.condition),
    ...(placeholder ? { placeholder: asString(source.placeholder, placeholder) } : {}),
  };
}

const massLabels: Record<DuplicateEntity, string> = {
  contacts: 'Введите/выберите поля для поиска в контактах',
  leads: 'Введите/выберите поля для поиска в сделках',
  companies: 'Введите/выберите поля для поиска в компаниях',
};

export function createDefaultDuplicateSettings(): DuplicateSettings {
  return {
    background_search: 'left',
    events: false,
    fields: [normalizeClause({})],
    manager: [{ manager: null, isUnion: 'not' }],
    union: { contacts: { target: 'not' }, companies: { target: 'not' } },
    massSearch: {
      contacts: normalizeClause({}, massLabels.contacts),
      leads: normalizeClause({}, massLabels.leads),
      companies: normalizeClause({}, massLabels.companies),
    },
  };
}

export function normalizeDuplicateSettings(value: unknown): DuplicateSettings {
  const defaults = createDefaultDuplicateSettings();
  const source = asRecord(payload(value));
  const massSearch = asRecord(source.massSearch);
  const union = asRecord(source.union);
  const contactsUnion = asRecord(union.contacts);
  const companiesUnion = asRecord(union.companies);
  const manager = asArray(source.manager);
  const fields = asArray(source.fields);

  return {
    ...defaults,
    ...source,
    background_search: source.background_search === 'right' ? 'right' : 'left',
    events: asBoolean(source.events),
    fields: (fields.length ? fields : defaults.fields).map((item) => normalizeClause(item)),
    manager: (manager.length ? manager : defaults.manager).map((item) => {
      const row = asRecord(item);
      return {
        ...row,
        manager: row.manager === null || row.manager === undefined ? null : String(row.manager),
        isUnion: normalizeTarget(row.isUnion),
      };
    }),
    massSearch: {
      contacts: normalizeClause(massSearch.contacts, massLabels.contacts),
      leads: normalizeClause(massSearch.leads, massLabels.leads),
      companies: normalizeClause(massSearch.companies, massLabels.companies),
    },
    union: {
      ...union,
      contacts: { ...contactsUnion, target: normalizeTarget(contactsUnion.target) },
      companies: { ...companiesUnion, target: normalizeTarget(companiesUnion.target) },
    },
  };
}

function fieldOption(value: unknown, entity: DuplicateEntity): DuplicateResourceOption | null {
  const source = asRecord(value);
  if (!source.id && !source.value) return null;
  const id = asString(source.id ?? source.value);
  const name = asString(source.name ?? source.label, id);
  return {
    value: source.value ? String(source.value) : `${entity}#${id}#${name}`,
    label: `${entity === 'contacts' ? 'Контакт' : entity === 'companies' ? 'Компания' : 'Сделка'} — ${name}`,
    entity,
  };
}

const generalFieldTypes = new Set([
  'text',
  'numeric',
  'multitext',
  'url',
  'textarea',
  'streetaddress',
  'select',
  'multiselect',
  'date',
  'date_time',
  'checkbox',
  'monetary',
]);
const backgroundFieldTypes = new Set(
  [...generalFieldTypes].filter((type) => !['select', 'multiselect', 'checkbox'].includes(type)),
);

function allowedField(value: unknown, background: boolean) {
  const type = asString(asRecord(value).type);
  // Некоторые версии legacy API уже возвращают подготовленные option без типа.
  return !type || (background ? backgroundFieldTypes : generalFieldTypes).has(type);
}

function simpleOption(value: unknown, group?: string): DuplicateResourceOption | null {
  const source = asRecord(value);
  if (!source.id && !source.value) return null;
  return {
    value: asString(source.id ?? source.value),
    label: asString(source.name ?? source.label, asString(source.id ?? source.value)),
    ...(group ? { group } : {}),
  };
}

function options(values: unknown, mapper: (value: unknown) => DuplicateResourceOption | null) {
  return asArray(payload(values)).flatMap((item) => {
    const option = mapper(item);
    return option ? [option] : [];
  });
}

function pipelineOptions(value: unknown) {
  const pipelines: DuplicateResourceOption[] = [];
  const stages: DuplicateResourceOption[] = [];
  for (const item of asArray(payload(value))) {
    const pipeline = asRecord(item);
    const pipelineOption = simpleOption(pipeline);
    if (pipelineOption) pipelines.push(pipelineOption);
    const nested = asArray(pipeline.statuses ?? pipeline.children ?? pipeline.stages);
    for (const stage of nested) {
      const option = simpleOption(stage, pipelineOption?.label);
      if (option) stages.push(option);
    }
  }
  return { pipelines, stages };
}

export function createDefaultRuleSettings(): DuplicateRuleSettings {
  const clause = () => normalizeClause({});
  return {
    name: '',
    typeSearchLeads: 'contact',
    searchСonditionContact: { '1': clause(), '2': clause(), '3': clause() },
    searchСonditionCompany: { '1': clause() },
    searchContactFinishRunSalesBotId: null,
    unionMethodContact: 'old',
    unionMethodCompany: 'old',
    leadsRules: [createLeadRule()],
    script_last_lead: false,
    script_run_widget: false,
    script_last_lead_settings: { stages: [], tag: [], move_stage: null, salesbotId: null },
    script_run_widget_settings: {
      tag: [],
      move_stage: null,
      salesbotId: null,
      assignMethodResponsible: 'listUsers',
      assignResponsible: 'contact',
      responsibleId: null,
    },
    no_comment: false,
  };
}

export function createLeadRule(): LeadDuplicateRule {
  return {
    index: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    condition: 'or',
    fields: [],
    stages: [],
    ignore: '',
    assignMethodResponsible: 'listUsers',
    assignResponsible: 'contact',
    responsibleId: null,
    unionMethodLead: 'nothing',
    salesbotId: null,
  };
}

function normalizeRuleSettings(value: unknown): DuplicateRuleSettings {
  const defaults = createDefaultRuleSettings();
  const source = asJsonRecord(value);
  const contacts = asRecord(source.searchСonditionContact);
  const companies = asRecord(source.searchСonditionCompany);
  const leadRules = asArray(source.leadsRules);
  const normalizeRuleClauseMap = (
    record: Record<string, unknown>,
    fallback: Record<string, DuplicateFieldClause>,
  ) =>
    Object.fromEntries(
      Object.entries(Object.keys(record).length ? record : fallback).map(([key, clause]) => [
        key,
        normalizeClause(clause),
      ]),
    );
  const normalizeCompletion = (value: unknown, fallback: RuleCompletionSettings) => {
    const row = asRecord(value);
    return {
      ...fallback,
      ...row,
      stages: asArray(row.stages ?? fallback.stages).map(String),
      tag: asArray(row.tag ?? fallback.tag).map(String),
      move_stage: row.move_stage == null ? null : String(row.move_stage),
      salesbotId: row.salesbotId == null ? null : String(row.salesbotId),
      responsibleId: row.responsibleId == null ? null : String(row.responsibleId),
    };
  };

  return {
    ...defaults,
    ...source,
    name: asString(source.name),
    typeSearchLeads: source.typeSearchLeads === 'company' ? 'company' : 'contact',
    searchСonditionContact: normalizeRuleClauseMap(contacts, defaults.searchСonditionContact),
    searchСonditionCompany: normalizeRuleClauseMap(companies, defaults.searchСonditionCompany),
    searchContactFinishRunSalesBotId:
      source.searchContactFinishRunSalesBotId == null
        ? null
        : String(source.searchContactFinishRunSalesBotId),
    unionMethodContact: source.unionMethodContact === 'new' ? 'new' : 'old',
    unionMethodCompany: source.unionMethodCompany === 'new' ? 'new' : 'old',
    leadsRules: (leadRules.length ? leadRules : defaults.leadsRules).map((item) => {
      const row = asRecord(item);
      return {
        ...createLeadRule(),
        ...row,
        index: asString(row.index, createLeadRule().index),
        fields: asArray(row.fields).map(String),
        stages: asArray(row.stages).map(String),
        ignore: asString(row.ignore),
        condition: normalizeCondition(row.condition),
        responsibleId: row.responsibleId == null ? null : String(row.responsibleId),
        salesbotId: row.salesbotId == null ? null : String(row.salesbotId),
      } as LeadDuplicateRule;
    }),
    script_last_lead: asBoolean(source.script_last_lead),
    script_run_widget: asBoolean(source.script_run_widget),
    script_last_lead_settings: normalizeCompletion(
      source.script_last_lead_settings,
      defaults.script_last_lead_settings,
    ),
    script_run_widget_settings: normalizeCompletion(
      source.script_run_widget_settings,
      defaults.script_run_widget_settings,
    ),
    no_comment: asBoolean(source.no_comment),
  };
}

function normalizeRule(value: unknown): DuplicateRule | null {
  const source = asRecord(value);
  const token = asString(source.token);
  if (!token) return null;
  const setting = normalizeRuleSettings(source.setting ?? source.settings);
  return {
    ...source,
    token,
    setting,
    name: asString(source.name, setting.name),
    countCheck: asNumber(source.count_check ?? source.countCheck),
    lastCheck:
      source.date_last_check == null && source.lastCheck == null
        ? null
        : asString(source.date_last_check ?? source.lastCheck),
  };
}

function normalizeMassStatus(value: unknown): MassSearchStatus {
  const source = asRecord(payload(value));
  const numericStatus = asNumber(source.status);
  return {
    ...source,
    active: asBoolean(source.active),
    status: numericStatus === 1 ? 1 : numericStatus === 2 ? 2 : 0,
    countObjects: asNumber(source.count_objects ?? source.countObjects),
    resultCount: asNumber(source.result_count ?? source.resultCount),
    resultDate:
      source.result_date == null && source.resultDate == null
        ? null
        : asString(source.result_date ?? source.resultDate),
  };
}

function detail(value: unknown): DuplicateResultDetail | null {
  const source = asRecord(value);
  if (source.id == null) return null;
  return {
    ...source,
    id: asString(source.id),
    entityType: asString(
      source.entity_type ?? source.entityType,
      'contacts',
    ) as DuplicateResultDetail['entityType'],
    fieldName: asString(source.field_name ?? source.fieldName),
    oldValue: asString(source.old_value ?? source.oldValue),
    link: source.link ? asString(source.link) : undefined,
  };
}

function resultItem(value: unknown): DuplicateResultItem | null {
  const source = asRecord(value);
  if (source.id == null) return null;
  return {
    ...source,
    id: asString(source.id),
    entityType: asString(
      source.entity_type ?? source.entityType,
      'contacts',
    ) as DuplicateResultItem['entityType'],
    fieldId: asString(source.field_id ?? source.fieldId),
    fieldName: asString(source.field_name ?? source.fieldName),
    oldValue: asString(source.old_value ?? source.oldValue),
    searchValue: asString(source.search_value ?? source.searchValue),
    count: asNumber(source.count),
    link: source.link ? asString(source.link) : undefined,
    data: asArray(source.data).flatMap((row) => {
      const normalized = detail(row);
      return normalized ? [normalized] : [];
    }),
  };
}

export const duplicatesApi = {
  getSettings: async (context: RakursContext, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'settings/get',
      context,
      {},
      signal,
    );
    return normalizeDuplicateSettings(response);
  },

  updateSettings: async (
    context: RakursContext,
    settings: DuplicateSettings,
    signal?: AbortSignal,
  ) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'settings/set',
      context,
      { settings },
      signal,
    );
    assertSuccessful(response, 'Не удалось сохранить настройки');
    return settings;
  },

  getResources: async (
    context: RakursContext,
    signal?: AbortSignal,
  ): Promise<DuplicateResources> => {
    const post = (endpoint: string) =>
      rakursPost<unknown>(DUPLICATES_BASE_URL, `resources/${endpoint}`, context, {}, signal);
    const [pipelinesRaw, tagsRaw, contactsRaw, companiesRaw, leadsRaw, salesbotsRaw, managersRaw] =
      await Promise.all([
        post('getPipelines'),
        post('getTags'),
        post('getFieldsContact'),
        post('getFieldsCompany'),
        post('getFieldsLead'),
        post('amoSalesBot'),
        post('getEmployees'),
      ]);
    const entityFields = (raw: unknown, entity: DuplicateEntity, background: boolean) =>
      options(
        asArray(payload(raw)).filter((item) => allowedField(item, background)),
        (item) => fieldOption(item, entity),
      );
    const contactFields = entityFields(contactsRaw, 'contacts', false);
    const companyFields = entityFields(companiesRaw, 'companies', false);
    const leadFields = entityFields(leadsRaw, 'leads', false);
    const backgroundFields = [
      ...entityFields(contactsRaw, 'contacts', true),
      ...entityFields(companiesRaw, 'companies', true),
      ...entityFields(leadsRaw, 'leads', true),
    ];
    const { pipelines, stages } = pipelineOptions(pipelinesRaw);
    return {
      fields: [...contactFields, ...companyFields, ...leadFields],
      backgroundFields,
      managers: options(managersRaw, (item) => simpleOption(item)),
      pipelines,
      stages,
      tags: options(tagsRaw, (item) => simpleOption(item)),
      salesbots: options(salesbotsRaw, (item) => simpleOption(item)),
    };
  },

  getPaidStatus: async (context: RakursContext, signal?: AbortSignal) => {
    const response = await rakursGet<unknown>(
      `${ACCOUNT_BASE_URL}/get/paid-status/${encodeURIComponent(context.accountId)}/${encodeURIComponent(context.appName)}`,
      signal,
    );
    const source = asRecord(payload(response));
    return {
      ...source,
      countAvailableUsers: asNumber(source.count_available_users ?? source.countAvailableUsers),
    } as DuplicatePaidStatus;
  },

  getRules: async (context: RakursContext, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'rule_settings/get',
      context,
      {},
      signal,
    );
    return asArray(payload(response)).flatMap((item) => {
      const rule = normalizeRule(item);
      return rule ? [rule] : [];
    });
  },

  saveRule: async (
    context: RakursContext,
    setting: DuplicateRuleSettings,
    token?: string,
    signal?: AbortSignal,
  ) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'rule_settings/set',
      context,
      { data: JSON.stringify(setting), ...(token ? { token } : {}) },
      signal,
    );
    assertSuccessful(response, 'Не удалось сохранить правило');
    return messageFrom(response, token ? 'Правило обновлено' : 'Правило создано');
  },

  deleteRule: async (context: RakursContext, token: string, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'rule_settings/delete',
      context,
      { token },
      signal,
    );
    assertSuccessful(response, 'Не удалось удалить правило');
    return messageFrom(response, 'Правило удалено');
  },

  testRule: async (context: RakursContext, token: string, leadId: number, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'rule_settings/runRuleScript',
      context,
      { script_token: token, leadId },
      signal,
    );
    assertSuccessful(response, 'Не удалось запустить правило');
    return messageFrom(response, 'Правило запущено');
  },

  getMassStatus: async (context: RakursContext, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'mass_search/status',
      context,
      { accountId: context.accountId },
      signal,
    );
    assertSuccessful(response, 'Не удалось получить статус поиска');
    return normalizeMassStatus(response);
  },

  runMassSearch: async (context: RakursContext, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'mass_search/run',
      context,
      { accountId: context.accountId },
      signal,
    );
    assertSuccessful(response, 'Не удалось запустить поиск');
  },

  stopMassSearch: async (context: RakursContext, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'mass_search/stop',
      context,
      { accountId: context.accountId },
      signal,
    );
    assertSuccessful(response, 'Не удалось остановить поиск');
  },

  getMassResults: async (context: RakursContext, page: number, signal?: AbortSignal) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'mass_search/status_result',
      context,
      { accountId: context.accountId, page },
      signal,
    );
    const root = asRecord(response);
    const source = asRecord(payload(response));
    const list = source.result ?? root.result ?? payload(response);
    return {
      items: asArray(list).flatMap((item) => {
        const normalized = resultItem(item);
        return normalized ? [normalized] : [];
      }),
      totalCount: asNumber(root.totalCount ?? source.totalCount),
      limit: Math.max(1, asNumber(root.limit ?? source.limit, 100)),
    } as MassSearchResults;
  },

  unionMassResults: async (
    context: RakursContext,
    ids: string[],
    target: 'old' | 'new',
    signal?: AbortSignal,
  ) => {
    const response = await rakursPost<unknown>(
      DUPLICATES_BASE_URL,
      'mass_search/union',
      context,
      { list: ids, accountId: context.accountId, target },
      signal,
    );
    assertSuccessful(response, 'Не удалось объединить карточки');
    return messageFrom(response, 'Карточки объединены');
  },
};
