import { format, addDays } from 'date-fns'

// Anonymous Gregorian algorithm for Easter Sunday
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

// Returns the Nth weekday (0=Sun…6=Sat) of a given month
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + diff + (n - 1) * 7)
}

// Returns the last weekday before a given date
function lastWeekdayBefore(weekday: number, before: Date): Date {
  const d = new Date(before)
  d.setDate(d.getDate() - 1)
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1)
  return d
}

// Returns a Map<'yyyy-MM-dd', holidayName> for BC statutory holidays in a given year
export function getBCHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>()

  const add = (date: Date, name: string) => {
    holidays.set(format(date, 'yyyy-MM-dd'), name)
  }

  // New Year's Day — Jan 1
  add(new Date(year, 0, 1), "New Year's Day")

  // Family Day — 3rd Monday of February
  add(nthWeekday(year, 1, 1, 3), 'Family Day')

  // Good Friday — 2 days before Easter
  add(addDays(easterSunday(year), -2), 'Good Friday')

  // Victoria Day — last Monday before May 25
  add(lastWeekdayBefore(1, new Date(year, 4, 25)), 'Victoria Day')

  // Canada Day — Jul 1 (observed Jul 2 if Sunday, Jul 3 if Saturday)
  const canadaDay = new Date(year, 6, 1)
  if (canadaDay.getDay() === 0) add(new Date(year, 6, 2), 'Canada Day')
  else if (canadaDay.getDay() === 6) add(new Date(year, 6, 3), 'Canada Day')
  else add(canadaDay, 'Canada Day')

  // BC Day — 1st Monday of August
  add(nthWeekday(year, 7, 1, 1), 'BC Day')

  // Labour Day — 1st Monday of September
  add(nthWeekday(year, 8, 1, 1), 'Labour Day')

  // National Day for Truth and Reconciliation — Sep 30
  add(new Date(year, 8, 30), 'Truth & Reconciliation')

  // Thanksgiving — 2nd Monday of October
  add(nthWeekday(year, 9, 1, 2), 'Thanksgiving')

  // Remembrance Day — Nov 11
  add(new Date(year, 10, 11), 'Remembrance Day')

  // Christmas Day — Dec 25
  add(new Date(year, 11, 25), 'Christmas Day')

  return holidays
}
