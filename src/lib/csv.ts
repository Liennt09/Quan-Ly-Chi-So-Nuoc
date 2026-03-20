import { Reading, Area, SubLocation, Meter } from '../types';
import { format } from 'date-fns';

export const exportToCSV = (
  readings: Reading[],
  areas: Area[],
  subLocations: SubLocation[],
  meters: Meter[]
) => {
  const headers = [
    'Ngày',
    'Khu vực',
    'Vị trí',
    'Đồng hồ',
    'Loại nước',
    'Chỉ số',
    'Tiêu thụ',
    'Người báo cáo',
    'Ghi chú',
    'Người nhập'
  ];

  const rows = readings.map((r) => {
    const area = areas.find((a) => a.id === r.areaId)?.name || '';
    const sub = subLocations.find((s) => s.id === r.subLocationId)?.name || '';
    const meter = meters.find((m) => m.id === r.meterId)?.name || '';
    
    return [
      r.recordDate,
      area,
      sub,
      meter,
      r.waterType,
      r.meterReading,
      r.usage,
      r.reporter,
      r.note.replace(/"/g, '""'), // Escape quotes
      r.enteredBy
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `lich-su-nuoc-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
