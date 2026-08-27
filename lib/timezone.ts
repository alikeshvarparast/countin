export function zonedDateTimeToUtcMs(
  dateYmd: string,
  timeHm: string,
  timeZone: string,
) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const [hour, minute] = timeHm.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const locale = new Date(utcGuess).toLocaleString("en-US", { timeZone });
  const asIfLocal = new Date(locale).getTime();
  const offset = utcGuess - asIfLocal;
  return utcGuess + offset;
}

export function eachSeasonDate(
  startDate: string,
  endDate: string,
  weekdays: number[],
) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(d.getDay())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
  }
  return dates;
}
