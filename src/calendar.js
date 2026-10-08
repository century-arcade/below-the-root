// Weeks run Sunday to Saturday; null pads the days outside the month.
export function monthWeeks(year, month) {
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

const element = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text ?? '' });

export function hangCalendar(wall, year, month) {
  const sheet = element('div', 'calendar');
  const title = new Date(Date.UTC(year, month, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  sheet.append(element('div', 'calendar-month', title), element('div', 'calendar-year', String(year)));
  const grid = element('div', 'calendar-grid');
  for (const day of 'SMTWTFS') grid.append(element('span', 'calendar-weekday', day));
  for (const week of monthWeeks(year, month)) for (const day of week) grid.append(element('span', 'calendar-day', day ?? ''));
  sheet.append(grid);
  wall.replaceChildren(sheet);
}
