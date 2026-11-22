import { AppError } from '../../../shared/utils/appError.js';
import { DateFilterQuery, DatePreset, GroupByInterval, ResolvedDateRange } from '../types/analytics.types.js';

const TIMEZONE_OFFSET_HOURS = 5.5; // Asia/Kolkata (UTC+5:30)

export function getLocalTimezoneDate(date: Date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * TIMEZONE_OFFSET_HOURS);
}

export function parseDateFilter(query: DateFilterQuery): ResolvedDateRange {
  const preset: DatePreset = query.preset || (query.startDate && query.endDate ? 'custom' : 'last30days');
  const groupBy: GroupByInterval = query.groupBy || (preset === 'today' || preset === 'yesterday' ? 'day' : 'day');

  const now = new Date();
  let start: Date;
  let end: Date = new Date(now.getTime());

  if (preset === 'custom') {
    if (!query.startDate || !query.endDate) {
      throw new AppError('Both startDate and endDate are required for custom date range.', 400);
    }
    start = new Date(query.startDate);
    end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format provided. Please use ISO 8601 or YYYY-MM-DD.', 400);
    }
    if (start > end) {
      throw new AppError('startDate cannot be later than endDate.', 400);
    }
    // Set start to start-of-day, end to end-of-day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'today') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'yesterday') {
    start = new Date(now);
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'last7days') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'last30days') {
    start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'thisweek') {
    start = new Date(now);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'thismonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (preset === 'previousmonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else {
    start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }

  // Calculate previous period of exact same duration for comparison
  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    startDate: start,
    endDate: end,
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString(),
    preset,
    groupBy,
    previousStartDate: previousStart,
    previousEndDate: previousEnd,
    previousStartDateIso: previousStart.toISOString(),
    previousEndDateIso: previousEnd.toISOString(),
  };
}

export function formatDateBucket(dateStr: string, groupBy: GroupByInterval = 'day'): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  if (groupBy === 'month') {
    return `${yyyy}-${mm}`;
  }
  if (groupBy === 'week') {
    // ISO week format
    const temp = new Date(d.getTime());
    temp.setDate(temp.getDate() + 4 - (temp.getDay() || 7));
    const yearStart = new Date(temp.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${yyyy}-W${String(weekNo).padStart(2, '0')}`;
  }
  return `${yyyy}-${mm}-${dd}`;
}
