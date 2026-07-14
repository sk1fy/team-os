import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CURRENT_USER_ID,
  acknowledgements,
  articleSections,
  articleVersions,
  articles,
  boards,
  company,
  courseAssignments,
  courseProgress,
  courseSections,
  courses,
  departments,
  distributionEvents,
  distributionGroups,
  invites,
  labels,
  lessons,
  notifications,
  positions,
  quizzes,
  schedules,
  shiftExceptions,
  taskColumns,
  taskComments,
  tasks,
  users,
} from '../src/api/fixtures.ts';

function outputDirectory(): string {
  const outputIndex = process.argv.indexOf('--output');
  const value = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  if (outputIndex >= 0 && !value) throw new Error('После --output укажите директорию');
  return resolve(value ?? '.seed');
}

const datasets: Record<string, unknown> = {
  'company.json': company,
  'current-user-id.json': CURRENT_USER_ID,
  'users.json': users,
  'departments.json': departments,
  'positions.json': positions,
  'invites.json': invites,
  'article-sections.json': articleSections,
  'articles.json': articles,
  'article-versions.json': articleVersions,
  'acknowledgements.json': acknowledgements,
  'boards.json': boards,
  'task-columns.json': taskColumns,
  'tasks.json': tasks,
  'labels.json': labels,
  'task-comments.json': taskComments,
  'courses.json': courses,
  'course-sections.json': courseSections,
  'lessons.json': lessons,
  'quizzes.json': quizzes,
  'course-assignments.json': courseAssignments,
  'course-progress.json': courseProgress,
  'notifications.json': notifications,
  'schedules.json': schedules,
  'shift-exceptions.json': shiftExceptions,
  'distribution-groups.json': distributionGroups,
  'distribution-events.json': distributionEvents,
};

const directory = outputDirectory();
await mkdir(directory, { recursive: true });
await Promise.all(
  Object.entries(datasets).map(([name, value]) =>
    writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'),
  ),
);

console.log(`Экспортировано файлов: ${Object.keys(datasets).length}. Директория: ${directory}`);
