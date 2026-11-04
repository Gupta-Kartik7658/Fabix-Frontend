import assert from 'node:assert/strict';
import { chooseSpotlight, placeTooltip, tourProgress, type Rect } from './placement';
import { activityCenterTour } from './activity-center';
import { readTourStatus, writeTourStatus } from './storage';
import type { TourStep } from './types';
import { memoryTour } from './memory';
import { promptStudioTour } from './prompts';
import { GUIDED_TOURS } from './index';
import {
  MAX_PAGE_TOUR_STEPS,
  WORKSPACE_TOURS,
  WORKSPACE_TOUR_REGISTRY,
  resolveTourSteps,
  workspaceEntryForTour,
  workspaceTourKey,
} from './workspace';

function rect(top: number, left: number, width: number, height: number): Rect {
  return { top, left, width, height, right: left + width, bottom: top + height };
}

function overlaps(top: number, left: number, width: number, height: number, target: Rect): boolean {
  const box = { top, left, right: left + width, bottom: top + height };
  return !(box.right <= target.left || box.left >= target.right || box.bottom <= target.top || box.top >= target.bottom);
}

const steps = activityCenterTour.steps;
assert.equal(steps.length, 2);
assert.equal(tourProgress(steps, 0)?.current, 1);
assert.equal(tourProgress(steps, 0)?.total, 2);
assert.equal(tourProgress(steps, 1)?.current, 2);

const centered = placeTooltip(null, { width: 380, height: 200 }, { width: 1280, height: 800 });
assert.equal(centered.placement, 'center');
assert.ok(centered.left > 0 && centered.top > 0);

const target = rect(80, 200, 640, 120);
const below = placeTooltip(target, { width: 420, height: 220 }, { width: 1280, height: 800 });
assert.equal(below.placement, 'bottom');
assert.ok(below.top >= target.bottom);
assert.ok(!overlaps(below.top, below.left, 420, 220, target));

const low = rect(640, 200, 400, 120);
const above = placeTooltip(low, { width: 420, height: 220 }, { width: 1280, height: 800 });
assert.equal(above.placement, 'top');
assert.ok(above.top + 220 <= low.top);
assert.ok(!overlaps(above.top, above.left, 420, 220, low));

const phoneTarget = rect(360, 16, 340, 112);
const phone = placeTooltip(phoneTarget, { width: 350, height: 280 }, { width: 390, height: 844 });
assert.ok(phone.placement === 'top' || phone.placement === 'bottom');
assert.ok(phone.left >= 12);
assert.ok(phone.left + 350 <= 390 - 12);
assert.ok(!overlaps(phone.top, phone.left, 350, 280, phoneTarget));

const edge = placeTooltip(rect(100, 1100, 140, 80), { width: 400, height: 180 }, { width: 1280, height: 800 });
assert.ok(edge.left >= 12);
assert.ok(edge.left + 400 <= 1280 - 12);

const group = rect(100, 40, 900, 140);
const beat = rect(110, 60, 200, 112);
const spotlight = chooseSpotlight(group, beat, 800);
assert.equal(spotlight.hole, group);
assert.equal(spotlight.ring, beat);

const tall = chooseSpotlight(rect(40, 16, 360, 520), rect(40, 16, 360, 112), 700);
assert.equal(tall.hole?.height, 112);
assert.equal(tall.ring, null);

const memory = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => [...memory.keys()][index] ?? null,
  removeItem: (key) => memory.delete(key),
  setItem: (key, value) => {
    memory.set(key, value);
  },
};

const session = new Map<string, string>();
const sessionStorage: Storage = {
  get length() {
    return session.size;
  },
  clear: () => session.clear(),
  getItem: (key) => session.get(key) ?? null,
  key: (index) => [...session.keys()][index] ?? null,
  removeItem: (key) => session.delete(key),
  setItem: (key, value) => {
    session.set(key, value);
  },
};

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: memoryStorage, sessionStorage },
});
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage });
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorage });

assert.equal(readTourStatus('user-a', 'activity-center'), 'unseen');
writeTourStatus('user-a', 'activity-center', 'completed');
assert.equal(readTourStatus('user-a', 'activity-center'), 'completed');
assert.equal(readTourStatus('user-b', 'activity-center'), 'unseen');
writeTourStatus('user-b', 'activity-center', 'skipped');
assert.equal(readTourStatus('user-a', 'activity-center'), 'completed');
assert.equal(readTourStatus('user-b', 'activity-center'), 'skipped');
assert.equal(readTourStatus(null, 'activity-center'), 'unseen');
writeTourStatus(null, 'activity-center', 'skipped');
assert.equal(readTourStatus(null, 'activity-center'), 'skipped');
assert.equal(memory.has('fabix_guided_tours:session'), false);
assert.equal(session.has('fabix_guided_tours:session'), true);
assert.ok(memory.has('fabix_guided_tours:user-a'));
assert.ok(![...memory.keys()].some((key) => key === 'fabix_guided_tours'));

const last = steps[steps.length - 1] as TourStep;
assert.equal(last.primary.action, 'complete');
assert.equal(steps[0].secondary?.action, 'skip');

const pages = Object.values(WORKSPACE_TOUR_REGISTRY);
assert.equal(pages.length, 7);
assert.equal(new Set(pages.map((entry) => entry.tour.id)).size, pages.length);
assert.equal(new Set(pages.map((entry) => entry.introduction.id)).size, pages.length);
for (const entry of pages) {
  const tourSteps = entry.tour.steps;
  assert.ok(tourSteps.length >= 1 && tourSteps.length <= MAX_PAGE_TOUR_STEPS, `${entry.page} tour length`);
  assert.equal(tourSteps[tourSteps.length - 1].primary.action, 'complete', `${entry.page} ends with complete`);
  assert.ok(tourSteps.every((step) => step.secondary?.action === 'skip'), `${entry.page} can be skipped`);
  assert.ok(entry.introduction.lines.some((line) => line.speaker === 'guide'));
  assert.ok(entry.introduction.lines.some((line) => line.speaker === 'companion'));
}

const tasksKey = workspaceTourKey(WORKSPACE_TOUR_REGISTRY.tasks, 'ws-1');
const runsKey = workspaceTourKey(WORKSPACE_TOUR_REGISTRY.runs, 'ws-1');
writeTourStatus('user-a', tasksKey, 'skipped');
assert.equal(readTourStatus('user-a', tasksKey), 'skipped');
assert.equal(readTourStatus('user-a', runsKey), 'unseen');
assert.equal(readTourStatus('user-a', workspaceTourKey(WORKSPACE_TOUR_REGISTRY.conversation, 'ws-1')), 'unseen');
assert.equal(readTourStatus('user-b', tasksKey), 'unseen');
assert.equal(tasksKey, workspaceTourKey(WORKSPACE_TOUR_REGISTRY.tasks, 'ws-2'));

const roomA = workspaceTourKey(WORKSPACE_TOUR_REGISTRY.workspace, 'ws-1');
const roomB = workspaceTourKey(WORKSPACE_TOUR_REGISTRY.workspace, 'ws-2');
assert.notEqual(roomA, roomB);
writeTourStatus('user-a', roomA, 'completed');
assert.equal(readTourStatus('user-a', roomB), 'unseen');

const runSteps = WORKSPACE_TOUR_REGISTRY.runs.tour.steps;
const sparse = resolveTourSteps(runSteps, (target) => target === 'ws-runs-list');
assert.deepEqual(
  sparse.map((step) => step.id),
  ['history'],
);
assert.equal(sparse[0].primary.action, 'complete');
const full = resolveTourSteps(runSteps, () => true);
assert.equal(full.length, runSteps.length);
assert.equal(full[0].primary.action, 'next');
assert.equal(workspaceEntryForTour('agents-tour')?.page, 'agents');
assert.equal(workspaceEntryForTour('activity-center'), null);

assert.ok(memoryTour.steps.length <= MAX_PAGE_TOUR_STEPS);
assert.equal(memoryTour.route, '/dashboard/memory');
assert.equal(memoryTour.introduction?.startLabel, 'Start exploring');
assert.equal(memoryTour.introduction?.dismissLabel, 'Maybe later');
assert.equal(memoryTour.steps[memoryTour.steps.length - 1].primary.label, 'Finish tour');
assert.equal(memoryTour.steps[memoryTour.steps.length - 1].primary.action, 'complete');
assert.ok(GUIDED_TOURS.some((item) => item.id === 'memory'));
assert.equal(new Set([...GUIDED_TOURS, ...WORKSPACE_TOURS].map((item) => item.id)).size, GUIDED_TOURS.length + WORKSPACE_TOURS.length);
assert.ok(promptStudioTour.steps.length <= MAX_PAGE_TOUR_STEPS);
assert.equal(promptStudioTour.route, '/dashboard/prompts');
assert.equal(promptStudioTour.introduction?.startLabel, 'Show me around');
assert.equal(promptStudioTour.introduction?.dismissLabel, 'Maybe later');
assert.ok(GUIDED_TOURS.some((item) => item.id === 'prompt-studio'));
const promptVariables = promptStudioTour.steps.find((step) => step.id === 'variables');
assert.equal(promptVariables?.linesWithout?.target, 'prompt-variable-token');
assert.ok(!promptVariables?.linesWithout?.lines.some((line) => /Fabix lists each one/.test(line.text)));
const listOnly = resolveTourSteps(promptStudioTour.steps, (target) => !['prompt-editor', 'prompt-variables'].includes(target));
assert.deepEqual(listOnly.map((step) => step.id), ['library']);
assert.equal(listOnly[0].primary.action, 'complete');
writeTourStatus('user-c', 'prompt-studio', 'completed');
assert.equal(readTourStatus('user-c', 'memory'), 'unseen');
writeTourStatus('user-c', 'memory', 'skipped');
assert.equal(readTourStatus('user-c', 'prompt-studio'), 'completed');
assert.equal(readTourStatus('user-c', 'memory'), 'skipped');
assert.equal(readTourStatus('user-c', 'activity-center'), 'unseen');
assert.equal(readTourStatus('user-c', workspaceTourKey(WORKSPACE_TOUR_REGISTRY.conversation, 'ws-1')), 'unseen');

console.log('guided tour logic ok');
