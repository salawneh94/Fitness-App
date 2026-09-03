import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

const today = new Date().toISOString().slice(0, 10);
const state = {
  state: {
    profile: {
      name: 'Alex', age: 28, sex: 'male', heightCm: 175, weightKg: 75,
      goal: 'build_muscle', targetWeightKg: 80, timeframeWeeks: 12,
      expectations: 'Build visible muscle.', activityLevel: 'moderate',
      preferredDaysPerWeek: 4, unitSystem: 'metric', createdAt: today,
    },
    weightHistory: [{ date: today, weightKg: 75 }],
    stepsHistory: [{ date: today, steps: 6200 }],
    sleepHistory: [{ date: today, hours: 7.2 }],
    measurementsHistory: [],
    foodEntries: [
      { id: '1', loggedAt: today, date: today, meal: 'breakfast', name: 'Oatmeal', calories: 420, proteinG: 18, carbsG: 60, fatG: 10, quantity: 1 },
    ],
    scheduledWorkouts: [], workoutLogs: [], progressPhotos: [], savedMeals: [],
  },
  version: 0,
};

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript((s) => localStorage.setItem('fitness-app-storage', JSON.stringify(s)), state);

const pages = ['/#/', '/#/nutrition', '/#/workouts', '/#/plans', '/#/progress', '/#/profile'];
let allErrors = [];
for (const p of pages) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:4174${p}`);
  await page.waitForTimeout(700);
  const bodyLen = (await page.locator('body').innerText()).length;
  console.log(p, 'bodyTextLen=', bodyLen, 'errors=', errors);
  if (errors.length) allErrors.push(...errors);
  await page.close();
}
console.log('TOTAL ERRORS:', allErrors.length);
await browser.close();
