import { Reading } from '../types';
import { differenceInDays, parseISO, format } from 'date-fns';

/**
 * Validates if a new reading is logically consistent with existing readings.
 * @param currentReading The reading value being entered
 * @param prevReading The reading immediately before this date
 * @param nextReading The reading immediately after this date
 */
export const validateReadingSequence = (
  currentReading: number,
  prevReading?: Reading,
  nextReading?: Reading
) => {
  if (prevReading && currentReading < prevReading.meterReading) {
    return `Chỉ số mới (${currentReading}) không được nhỏ hơn chỉ số trước đó (${prevReading.meterReading} ngày ${prevReading.recordDate})`;
  }
  if (nextReading && currentReading > nextReading.meterReading) {
    return `Chỉ số mới (${currentReading}) không được lớn hơn chỉ số kế tiếp (${nextReading.meterReading} ngày ${nextReading.recordDate})`;
  }
  return null;
};

/**
 * Calculates usage based on current and previous reading.
 */
export const calculateUsage = (currentReading: number, prevReading?: Reading, meterName?: string) => {
  if (!prevReading) return 0;
  const diff = Math.max(0, currentReading - prevReading.meterReading);
  
  // Special calculation for specific meters: (N+1 - N) * 10
  const specialMeters = ['Debay', 'ĐH Đập Mới 1', 'ĐH Đập Mới 2'];
  if (meterName && specialMeters.includes(meterName)) {
    return diff * 10;
  }
  
  return diff;
};

/**
 * Checks if usage has changed by more than 50% compared to previous usage.
 */
export const checkUsageWarning = (currentUsage: number, prevReading?: Reading) => {
  if (!prevReading || prevReading.usage === 0) return false;
  const prevUsage = prevReading.usage;
  const ratio = currentUsage / prevUsage;
  return ratio > 1.5 || ratio < 0.5;
};
