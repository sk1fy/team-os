import { describe, expect, it } from 'vitest';
import { splitEmployeeName } from './employeeName';

const fallback = { firstName: 'Анастасия', lastName: 'amoCRM' };

describe('splitEmployeeName', () => {
  it('разделяет имя и фамилию из общего поля', () => {
    expect(splitEmployeeName('Мария Иванова', fallback)).toEqual({
      firstName: 'Мария',
      lastName: 'Иванова',
    });
  });

  it('позволяет удалить фамилию и оставить только имя', () => {
    expect(splitEmployeeName('Мария', fallback)).toEqual({
      firstName: 'Мария',
      lastName: '',
    });
  });

  it('возвращает текущие данные для пустого значения', () => {
    expect(splitEmployeeName('   ', fallback)).toEqual(fallback);
  });
});
