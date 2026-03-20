import React, { useMemo, useState } from 'react';
import { Area, SubLocation, Meter, Reading } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area as RechartsArea
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertTriangle, Activity, 
  Droplets, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight,
  Maximize2, X, Filter, Calendar as CalendarIcon, Download
} from 'lucide-react';
import { format, subDays, isSameDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';

interface DashboardProps {
  areas: Area[];
  subLocations: SubLocation[];
  meters: Meter[];
  readings: Reading[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload, label, type }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const details = type === 'extraction' ? data.extractionDetails : data.consumptionDetails;
    const total = type === 'extraction' ? data.extraction : data.consumption;

    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xl max-w-[300px]">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-2">
          {details && details.length > 0 ? (
            <>
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2">
                {details.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between items-center gap-4 text-xs">
                    <span className="text-slate-600 truncate">{d.name}</span>
                    <span className="font-bold text-slate-900 shrink-0">{d.usage.toLocaleString()} m³</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">Tổng cộng</span>
                <span className={`text-sm font-bold ${type === 'extraction' ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {total.toLocaleString()} m³
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Không có dữ liệu</p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ areas, subLocations, meters, readings }: DashboardProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'extraction' | 'consumption'>('extraction');

  const handleExport = () => {
    const exportData = readings.map(r => {
      const area = areas.find(a => a.id === r.areaId)?.name || '';
      const subLoc = subLocations.find(sl => sl.id === r.subLocationId)?.name || '';
      const meter = meters.find(m => m.id === r.meterId)?.name || '';
      return {
        'Ngày nhập': r.recordDate,
        'Ngày tiêu thụ': r.usageDate,
        'Khu vực': area,
        'Vị trí': subLoc,
        'Đồng hồ': meter,
        'Loại nước': r.waterType,
        'Chỉ số': r.meterReading,
        'Tiêu thụ (m3)': r.waterType === 'Tiêu thụ' ? r.usage : 0,
        'Khai thác (m3)': r.waterType === 'Khai thác' ? r.usage : 0,
        'Người nhập': r.enteredBy,
        'Người báo cáo': r.reporter,
        'Ghi chú': r.note
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dữ liệu nước");
    XLSX.writeFile(wb, `bao-cao-nuoc-tong-hop-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  const stats = useMemo(() => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    
    const todayReadings = readings.filter(r => isSameDay(new Date(r.recordDate), today));
    const yesterdayReadings = readings.filter(r => isSameDay(new Date(r.recordDate), yesterday));
    
    // Filter out sub-meters for totals
    const mainMeterIds = meters.filter(m => !m.isSubMeter).map(m => m.id);
    const mainReadings = readings.filter(r => mainMeterIds.includes(r.meterId));

    const excludedMeterNames = ['ĐH 18,5 kw MB-GL'];
    
    const consumptionReadings = mainReadings.filter(r => {
      const meter = meters.find(m => m.id === r.meterId);
      return r.waterType === 'Tiêu thụ' && !excludedMeterNames.includes(meter?.name || '');
    });

    const totalConsumption = consumptionReadings.reduce((acc, r) => {
      const meter = meters.find(m => m.id === r.meterId);
      return meter?.isRelayMeter ? acc - r.usage : acc + r.usage;
    }, 0);
    const totalExtraction = mainReadings.filter(r => r.waterType === 'Khai thác').reduce((acc, r) => acc + r.usage, 0);
    
    const activeMeters = meters.length;
    const missingToday = meters.filter(m => !todayReadings.some(r => r.meterId === m.id)).length;
    
    const top5Meters = [...meters]
      .map(m => ({
        name: m.name,
        usage: readings.filter(r => r.meterId === m.id).reduce((acc, r) => acc + r.usage, 0)
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);

    return {
      totalConsumption,
      totalExtraction,
      activeMeters,
      missingToday,
      top5Meters,
      diff: totalExtraction - totalConsumption
    };
  }, [meters, readings]);

  const chartData30Days = useMemo(() => {
    const data = [];
    const mainMeters = meters.filter(m => !m.isSubMeter);
    const mainMeterIds = mainMeters.map(m => m.id);
    const excludedMeterNames = ['ĐH 18,5 kw MB-GL'];
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      // Use usageDate for charts to align with "Consumption of day N is from Reading of day N+1"
      // Fallback to recordDate for older data that doesn't have usageDate
      const dayReadings = readings.filter(r => (r.usageDate || r.recordDate) === dateStr && mainMeterIds.includes(r.meterId));
      
      const extractionReadings = dayReadings.filter(r => r.waterType === 'Khai thác');
      const consumptionReadings = dayReadings.filter(r => {
        const meter = meters.find(m => m.id === r.meterId);
        return r.waterType === 'Tiêu thụ' && !excludedMeterNames.includes(meter?.name || '');
      });

      const extractionDetails = extractionReadings.map(r => ({
        name: meters.find(m => m.id === r.meterId)?.name || 'N/A',
        usage: r.usage
      }));

      const consumptionDetails = consumptionReadings.map(r => ({
        name: meters.find(m => m.id === r.meterId)?.name || 'N/A',
        usage: r.usage
      }));

      data.push({
        date: format(date, 'dd/MM'),
        extraction: extractionReadings.reduce((acc, r) => acc + r.usage, 0),
        consumption: consumptionReadings.reduce((acc, r) => {
          const meter = meters.find(m => m.id === r.meterId);
          return meter?.isRelayMeter ? acc - r.usage : acc + r.usage;
        }, 0),
        extractionDetails,
        consumptionDetails
      });
    }
    return data;
  }, [readings, meters]);

  const areaChartsData = useMemo(() => {
    const excludedMeterNames = ['ĐH 18,5 kw MB-GL'];
    return areas.map(area => {
      const data = [];
      const areaSubLocationIds = subLocations.filter(sl => sl.areaId === area.id).map(sl => sl.id);
      const areaMeters = meters.filter(m => areaSubLocationIds.includes(m.subLocationId) && !m.isSubMeter);
      const areaMeterIds = areaMeters.map(m => m.id);
      
      for (let i = 14; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayReadings = readings.filter(r => (r.usageDate || r.recordDate) === dateStr && areaMeterIds.includes(r.meterId));
        
        const consumptionReadings = dayReadings.filter(r => {
          const meter = meters.find(m => m.id === r.meterId);
          return r.waterType === 'Tiêu thụ' && !excludedMeterNames.includes(meter?.name || '');
        });

        data.push({
          date: format(date, 'dd/MM'),
          extraction: dayReadings.filter(r => r.waterType === 'Khai thác').reduce((acc, r) => acc + r.usage, 0),
          consumption: consumptionReadings.reduce((acc, r) => {
            const meter = meters.find(m => m.id === r.meterId);
            return meter?.isRelayMeter ? acc - r.usage : acc + r.usage;
          }, 0),
        });
      }
      return { area, data };
    });
  }, [areas, meters, readings, subLocations]);

  const selectedArea = useMemo(() => 
    areas.find(a => a.id === selectedAreaId),
    [areas, selectedAreaId]
  );

  const selectedAreaData = useMemo(() => {
    if (!selectedAreaId) return [];
    const excludedMeterNames = ['ĐH 18,5 kw MB-GL'];
    const areaSubLocationIds = subLocations.filter(sl => sl.areaId === selectedAreaId).map(sl => sl.id);
    const areaMeters = meters.filter(m => areaSubLocationIds.includes(m.subLocationId) && !m.isSubMeter);
    const areaMeterIds = areaMeters.map(m => m.id);
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayReadings = readings.filter(r => (r.usageDate || r.recordDate) === dateStr && areaMeterIds.includes(r.meterId));
      
      const consumptionReadings = dayReadings.filter(r => {
        const meter = meters.find(m => m.id === r.meterId);
        return r.waterType === 'Tiêu thụ' && !excludedMeterNames.includes(meter?.name || '');
      });

      data.push({
        date: format(date, 'dd/MM'),
        fullDate: dateStr,
        extraction: dayReadings.filter(r => r.waterType === 'Khai thác').reduce((acc, r) => acc + r.usage, 0),
        consumption: consumptionReadings.reduce((acc, r) => {
          const meter = meters.find(m => m.id === r.meterId);
          return meter?.isRelayMeter ? acc - r.usage : acc + r.usage;
        }, 0),
      });
    }
    return data;
  }, [selectedAreaId, meters, readings, subLocations]);

  const meterDailyDetails = useMemo(() => {
    if (!selectedAreaId) return [];
    const areaSubLocationIds = subLocations.filter(sl => sl.areaId === selectedAreaId).map(sl => sl.id);
    const areaMeters = meters.filter(m => 
      areaSubLocationIds.includes(m.subLocationId) && 
      m.waterType === (activeTab === 'extraction' ? 'Khai thác' : 'Tiêu thụ')
    );
    
    return areaMeters.map(meter => {
      const dailyUsage = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        // Use usageDate for consistency with fallback
        const reading = readings.find(r => r.meterId === meter.id && (r.usageDate || r.recordDate) === dateStr);
        dailyUsage.push({
          date: format(date, 'dd/MM'),
          usage: reading?.usage || 0,
          reading: reading?.meterReading || 0
        });
      }
      return {
        ...meter,
        dailyUsage
      };
    });
  }, [selectedAreaId, meters, readings, subLocations, activeTab]);

  const selectedMeter = useMemo(() => 
    meters.find(m => m.id === selectedMeterId),
    [meters, selectedMeterId]
  );

  const selectedMeterData = useMemo(() => {
    if (!selectedMeterId) return [];
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const reading = readings.find(r => r.meterId === selectedMeterId && (r.usageDate || r.recordDate) === dateStr);
      data.push({
        date: format(date, 'dd/MM'),
        usage: reading?.usage || 0,
        reading: reading?.meterReading || 0
      });
    }
    return data;
  }, [selectedMeterId, readings]);

  const areaData = useMemo(() => {
    const mainMeterIds = meters.filter(m => !m.isSubMeter).map(m => m.id);
    const excludedMeterNames = ['ĐH 18,5 kw MB-GL'];
    return areas.map(a => {
      const areaReadings = readings.filter(r => r.areaId === a.id && mainMeterIds.includes(r.meterId));
      const filteredReadings = areaReadings.filter(r => {
        const meter = meters.find(m => m.id === r.meterId);
        return r.waterType === 'Khai thác' || !excludedMeterNames.includes(meter?.name || '');
      });
      return {
        name: a.name,
        usage: filteredReadings.reduce((acc, r) => {
          const meter = meters.find(m => m.id === r.meterId);
          if (r.waterType === 'Tiêu thụ' && meter?.isRelayMeter) {
            return acc - r.usage;
          }
          return acc + r.usage;
        }, 0)
      };
    });
  }, [areas, readings, meters]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h2>
          <p className="text-slate-500 font-medium">Thống kê dữ liệu nước thời gian thực</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download size={18} className="text-blue-600" />
            Xuất dữ liệu CSV
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-slate-700">Hệ thống đang hoạt động</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Droplets size={24} />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-wider">Tổng</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Tổng khai thác</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalExtraction.toLocaleString()} m³</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">Hiệu quả</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Tổng tiêu thụ</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalConsumption.toLocaleString()} m³</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <Activity size={24} />
            </div>
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg uppercase tracking-wider">Đồng hồ</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Đang hoạt động</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.activeMeters}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg uppercase tracking-wider">Cảnh báo</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Chưa nhập liệu hôm nay</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.missingToday}</h3>
        </div>
      </div>

      {/* Charts Row 1 - Separated Extraction and Consumption */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Biểu đồ Khai thác (30 ngày)</h3>
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs font-bold">
              <Droplets size={14} />
              <span>Tổng: {stats.totalExtraction.toLocaleString()} m³</span>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData30Days}>
                <defs>
                  <linearGradient id="colorExtraction" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip content={<CustomTooltip type="extraction" />} />
                <RechartsArea type="monotone" dataKey="extraction" name="Khai thác" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorExtraction)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Biểu đồ Tiêu thụ (30 ngày)</h3>
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold">
              <TrendingUp size={14} />
              <span>Tổng: {stats.totalConsumption.toLocaleString()} m³</span>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData30Days}>
                <defs>
                  <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip content={<CustomTooltip type="consumption" />} />
                <RechartsArea type="monotone" dataKey="consumption" name="Tiêu thụ" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorConsumption)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Area Specific Charts Section */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-slate-900">Thống kê theo Khu vực</h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('extraction')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'extraction' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Khai thác
            </button>
            <button 
              onClick={() => setActiveTab('consumption')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'consumption' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tiêu thụ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {areaChartsData.map(({ area, data }) => (
            <div key={area.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm ${activeTab === 'extraction' ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {activeTab === 'extraction' ? <Droplets size={20} /> : <TrendingUp size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{area.name}</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {activeTab === 'extraction' ? 'Khai thác' : 'Tiêu thụ'} - 14 ngày
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'extraction' ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                  title="Xem chi tiết"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
              <div className="p-5 flex-1">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id={`colorArea-${area.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={activeTab === 'extraction' ? '#3b82f6' : '#10b981'} stopOpacity={0.1}/>
                          <stop offset="95%" stopColor={activeTab === 'extraction' ? '#3b82f6' : '#10b981'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                      />
                      <RechartsArea 
                        type="monotone" 
                        dataKey={activeTab} 
                        name={activeTab === 'extraction' ? 'Khai thác' : 'Tiêu thụ'} 
                        stroke={activeTab === 'extraction' ? '#3b82f6' : '#10b981'} 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill={`url(#colorArea-${area.id})`} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">
                    Tổng: {data.reduce((acc, d) => acc + (activeTab === 'extraction' ? d.extraction : d.consumption), 0).toLocaleString()} m³
                  </div>
                  <button 
                    onClick={() => setSelectedAreaId(area.id)}
                    className={`text-xs font-bold hover:underline ${activeTab === 'extraction' ? 'text-blue-600' : 'text-emerald-600'}`}
                  >
                    Chi tiết từng đồng hồ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Area Detail Modal */}
      {selectedAreaId && selectedArea && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedArea.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">Chi tiết tiêu thụ và khai thác 30 ngày qua</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAreaId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Droplets size={18} className="text-blue-600" />
                    Khai thác theo ngày
                  </h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedAreaData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Bar dataKey="extraction" name="Khai thác" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-600" />
                    Tiêu thụ theo ngày
                  </h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedAreaData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Bar dataKey="consumption" name="Tiêu thụ" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-6">Chi tiết từng đồng hồ</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-100">
                        <th className="text-left py-3 font-bold uppercase tracking-wider text-[10px]">Đồng hồ</th>
                        <th className="text-left py-3 font-bold uppercase tracking-wider text-[10px]">Loại</th>
                        <th className="text-right py-3 font-bold uppercase tracking-wider text-[10px]">Chỉ số mới nhất</th>
                        <th className="text-right py-3 font-bold uppercase tracking-wider text-[10px]">Tiêu thụ 7 ngày (m³)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {meterDailyDetails.map(meter => (
                        <tr key={meter.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="py-4">
                            <div className="flex items-center">
                              <div className="font-bold text-slate-900">{meter.name}</div>
                              {meter.isSubMeter && (
                                <span className="ml-2 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-bold rounded uppercase border border-amber-100 whitespace-nowrap">
                                  Đồng hồ con
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">{subLocations.find(sl => sl.id === meter.subLocationId)?.name}</div>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meter.waterType === 'Khai thác' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {meter.waterType}
                            </span>
                          </td>
                          <td className="py-4 text-right font-bold text-slate-900">
                            {meter.dailyUsage[0].reading.toLocaleString()}
                          </td>
                          <td className="py-4">
                            <div className="flex items-center justify-end gap-6">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-slate-900">
                                  {meter.dailyUsage.reduce((acc, d) => acc + d.usage, 0).toLocaleString()}
                                </span>
                                <div className="flex gap-1 mt-1">
                                  {meter.dailyUsage.map((d, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-1.5 rounded-full ${d.usage > 0 ? (meter.waterType === 'Khai thác' ? 'bg-blue-400' : 'bg-emerald-400') : 'bg-slate-200'}`}
                                      style={{ height: `${Math.min(Math.max(d.usage * 2, 4), 16)}px` }}
                                      title={`${d.date}: ${d.usage} m³`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <button 
                                onClick={() => setSelectedMeterId(meter.id)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Phóng to biểu đồ"
                              >
                                <Maximize2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-6">So sánh Xu hướng Tổng</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedAreaData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Legend />
                      <Line type="monotone" dataKey="extraction" name="Khai thác" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="consumption" name="Tiêu thụ" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedAreaId(null)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meter Detail Modal (Zoomed Line Chart) */}
      {selectedMeterId && selectedMeter && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 md:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedMeter.waterType === 'Khai thác' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedMeter.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">Biểu đồ tiêu thụ chi tiết 30 ngày qua (m³)</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMeterId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedMeterData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}}
                      interval={2}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value.toLocaleString()} m³`, 'Tiêu thụ']}
                    />
                    <Bar 
                      dataKey="usage" 
                      fill={selectedMeter.waterType === 'Khai thác' ? '#3b82f6' : '#10b981'} 
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Tổng 30 ngày</p>
                  <p className="text-xl font-bold text-slate-900">
                    {selectedMeterData.reduce((acc, d) => acc + d.usage, 0).toLocaleString()} m³
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Trung bình/ngày</p>
                  <p className="text-xl font-bold text-slate-900">
                    {(selectedMeterData.reduce((acc, d) => acc + d.usage, 0) / 30).toFixed(1)} m³
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Cao nhất</p>
                  <p className="text-xl font-bold text-slate-900">
                    {Math.max(...selectedMeterData.map(d => d.usage)).toLocaleString()} m³
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedMeterId(null)}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 2 - Pie and Top Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Tỷ trọng theo khu vực</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={areaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="usage"
                >
                  {areaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" align="center" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3 - Top Meters and Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Top 5 đồng hồ tiêu thụ cao nhất</h3>
          <div className="space-y-4">
            {stats.top5Meters.map((m, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-700">{m.name}</span>
                    <span className="text-sm font-bold text-slate-900">{m.usage.toLocaleString()} m³</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${(m.usage / (stats.top5Meters[0].usage || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Cảnh báo bất thường</h3>
          <div className="space-y-3">
            {stats.missingToday > 0 && (
              <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                <AlertTriangle className="text-red-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-red-900">Thiếu dữ liệu nhập liệu</p>
                  <p className="text-xs text-red-700 mt-0.5">Có {stats.missingToday} đồng hồ chưa được cập nhật chỉ số trong ngày hôm nay.</p>
                </div>
              </div>
            )}
            {Math.abs(stats.diff) > stats.totalExtraction * 0.1 && (
              <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <AlertCircle className="text-orange-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-orange-900">Chênh lệch khai thác/tiêu thụ cao</p>
                  <p className="text-xs text-orange-700 mt-0.5">Mức chênh lệch hiện tại là {stats.diff.toLocaleString()} m³ ({((stats.diff / stats.totalExtraction) * 100).toFixed(1)}%).</p>
                </div>
              </div>
            )}
            {stats.missingToday === 0 && Math.abs(stats.diff) <= stats.totalExtraction * 0.1 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <p className="text-slate-900 font-bold">Hệ thống ổn định</p>
                <p className="text-slate-500 text-sm">Không phát hiện bất thường nào trong dữ liệu hiện tại.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
