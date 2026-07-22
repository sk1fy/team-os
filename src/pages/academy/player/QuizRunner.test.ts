import { describe, expect, it } from 'vitest';
import {
  draftToAnswers,
  emptyQuizDraft,
  isQuizDraftComplete,
  type QuizDraftAnswers,
} from './QuizRunner';
import type { QuizLearner } from '@/types/academy';

const quiz: QuizLearner = {
  id: 'q1',
  lessonId: 'l1',
  passingScore: 70,
  questions: [
    {
      id: 'qq1',
      type: 'single',
      text: 'A?',
      options: [
        { id: 'o1', text: '1' },
        { id: 'o2', text: '2' },
      ],
    },
    {
      id: 'qq2',
      type: 'multiple',
      text: 'B?',
      options: [
        { id: 'o3', text: '3' },
        { id: 'o4', text: '4' },
      ],
    },
    {
      id: 'qq3',
      type: 'open',
      text: 'C?',
      options: [],
    },
  ],
};

describe('QuizRunner helpers', () => {
  it('empty draft has all question keys', () => {
    const draft = emptyQuizDraft(quiz);
    expect(Object.keys(draft).sort()).toEqual(['qq1', 'qq2', 'qq3']);
    expect(isQuizDraftComplete(quiz, draft)).toBe(false);
  });

  it('requires answers for all question types', () => {
    const draft: QuizDraftAnswers = {
      qq1: { optionIds: ['o1'], openText: '' },
      qq2: { optionIds: ['o3', 'o4'], openText: '' },
      qq3: { optionIds: [], openText: '  hello ' },
    };
    expect(isQuizDraftComplete(quiz, draft)).toBe(true);
    expect(draftToAnswers(draft)).toEqual([
      { questionId: 'qq1', selectedOptionIds: ['o1'], openText: undefined },
      { questionId: 'qq2', selectedOptionIds: ['o3', 'o4'], openText: undefined },
      { questionId: 'qq3', selectedOptionIds: undefined, openText: '  hello ' },
    ]);
  });

  it('multiple requires at least one option', () => {
    const draft: QuizDraftAnswers = {
      qq1: { optionIds: ['o1'], openText: '' },
      qq2: { optionIds: [], openText: '' },
      qq3: { optionIds: [], openText: 'x' },
    };
    expect(isQuizDraftComplete(quiz, draft)).toBe(false);
  });
});
