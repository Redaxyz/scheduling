export function expandDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  let guard = 0;
  while (cur.getTime() <= end.getTime() && guard < 366) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return dates;
}
