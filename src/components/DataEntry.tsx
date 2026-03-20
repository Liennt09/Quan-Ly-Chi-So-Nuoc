import React, { useState, useMemo, useEffect } from 'react';
import { Area, SubLocation, Meter, Reading, Reporter } from '../types';
import { Database, Calendar, User, Hash, FileText, AlertCircle, CheckCircle2, Loader2, Info, Trash2, Edit2, Droplets, Search, Download, AlertTriangle, X } from 'lucide-react';
import { format, isSameDay, subDays, parseISO } from 'date-fns';
import { validateReadingSequence, calculateUsage, checkUsageWarning } from '../lib/reading-utils';
import * as XLSX from 'xlsx';

interface DataEntryProps {
  areas: Area[];
  subLocations: SubLocation[];
  meters: Meter[];
  reporters: Reporter[];
  readings: Reading[];
  onSave: (data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  user: any;
}

export default function DataEntry({ areas, subLocations, meters, reporters, readings, onSave, onDelete, user }: DataEntryProps) {
  const [formData, setFormData] = useState({
    areaId: '',
    subLocationId: '',
    recordDate: format(new Date(), 'yyyy-MM-dd'),
    reporter: '',
    note: ''
  });

  const [meterReadings, setMeterReadings] = useState<Record<string, string>>({});
  const [editingMeterId, setEditingMeterId] = useState<string | null>(null);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'entry' | 'review'>('entry');
  const [showUpdateWarning, setShowUpdateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<any[] | null>(null);

  const [reviewFilters, setReviewFilters] = useState({
    areaId: '',
    subLocationId: '',
    recordDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const filteredSubLocations = useMemo(() => 
    subLocations.filter(s => s.areaId === formData.areaId), 
    [subLocations, formData.areaId]
  );

  const reviewSubLocations = useMemo(() => 
    subLocations.filter(s => s.areaId === reviewFilters.areaId), 
    [subLocations, reviewFilters.areaId]
  );

  const filteredMeters = useMemo(() => 
    meters.filter(m => m.subLocationId === formData.subLocationId), 
    [meters, formData.subLocationId]
  );

  // Initialize meterReadings when subLocation changes or on edit
  useEffect(() => {
    if (formData.subLocationId) {
      const initialReadings: Record<string, string> = {};
      filteredMeters.forEach(m => {
        const existing = readings.find(r => r.meterId === m.id && r.recordDate === formData.recordDate);
        initialReadings[m.id] = existing ? existing.meterReading.toString() : '';
      });
      setMeterReadings(initialReadings);
    }
  }, [formData.subLocationId, formData.recordDate, filteredMeters, readings]);

  const getMeterInfo = (meterId: string) => {
    const meterReadings = readings
      .filter(r => r.meterId === meterId)
      .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
    
    // Find last reading before current recordDate
    const last = meterReadings.find(r => r.recordDate < formData.recordDate);
    return last || null;
  };

  const warnings = useMemo(() => {
    const activeWarnings: string[] = [];
    filteredMeters.forEach(m => {
      const val = parseInt(meterReadings[m.id] || '');
      if (isNaN(val)) return;
      
      const last = getMeterInfo(m.id);
      const usage = calculateUsage(val, last || undefined, m.name);
      if (checkUsageWarning(usage, last || undefined)) {
        activeWarnings.push(m.name);
      }
    });
    return activeWarnings;
  }, [filteredMeters, meterReadings, formData.recordDate]);

  const handleEdit = (r: Reading) => {
    setFormData({
      areaId: r.areaId,
      subLocationId: r.subLocationId,
      recordDate: r.recordDate,
      reporter: r.reporter,
      note: r.note
    });
    setEditingMeterId(r.meterId);
    setMessage(null);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportReview = () => {
    const exportData = reviewReadings.map(r => {
      const area = areas.find(a => a.id === r.areaId)?.name;
      const sub = subLocations.find(s => s.id === r.subLocationId)?.name;
      const meter = meters.find(m => m.id === r.meterId)?.name;
      return {
        'Ngày nhập': r.recordDate,
        'Ngày tiêu thụ': r.usageDate,
        'Khu vực': area || 'N/A',
        'Vị trí': sub || 'N/A',
        'Đồng hồ': meter || 'N/A',
        'Loại': r.waterType,
        'Chỉ số (m³)': r.meterReading,
        'Tiêu thụ (m³)': r.waterType === 'Tiêu thụ' ? r.usage : 0,
        'Khai thác (m³)': r.waterType === 'Khai thác' ? r.usage : 0,
        'Người nhập': r.enteredBy,
        'Người báo cáo': r.reporter,
        'Ghi chú': r.note || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dữ liệu nước");
    XLSX.writeFile(wb, `du-lieu-nuoc-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const reviewReadings = useMemo(() => {
    return readings.filter(r => {
      const dateMatch = !reviewFilters.recordDate || r.recordDate === reviewFilters.recordDate;
      const areaMatch = !reviewFilters.areaId || r.areaId === reviewFilters.areaId;
      const subMatch = !reviewFilters.subLocationId || r.subLocationId === reviewFilters.subLocationId;
      return dateMatch && areaMatch && subMatch;
    }).sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
  }, [readings, reviewFilters]);

  const contextualReadings = useMemo(() => {
    return readings.filter(r => {
      const dateMatch = r.recordDate === formData.recordDate;
      const areaMatch = !formData.areaId || r.areaId === formData.areaId;
      const subMatch = !formData.subLocationId || r.subLocationId === formData.subLocationId;
      return dateMatch && areaMatch && subMatch;
    }).sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
  }, [readings, formData.recordDate, formData.areaId, formData.subLocationId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await onDelete(deleteId);
      setDeleteId(null);
      setMessage({ type: 'success', text: 'Đã xóa bản ghi thành công!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi xóa.' });
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.areaId || !formData.subLocationId || !formData.reporter) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin bắt buộc.' });
      return;
    }

    // Check if all meters have readings
    const missingMeters = filteredMeters.filter(m => !meterReadings[m.id]);
    if (missingMeters.length > 0) {
      setMessage({ type: 'error', text: `Vui lòng nhập đầy đủ chỉ số cho tất cả đồng hồ trong khu vực (${missingMeters.map(m => m.name).join(', ')}).` });
      return;
    }

    // Validate all readings
    for (const m of filteredMeters) {
      const val = parseInt(meterReadings[m.id]);
      if (isNaN(val)) {
        setMessage({ type: 'error', text: `Chỉ số đồng hồ ${m.name} phải là số nguyên.` });
        return;
      }
      
      const last = getMeterInfo(m.id);
      const error = validateReadingSequence(val, last || undefined);
      if (error) {
        setMessage({ type: 'error', text: error });
        return;
      }
    }

    // Check warnings
    if (warnings.length > 0 && !confirmWarnings) {
      setMessage({ type: 'error', text: 'Có sự thay đổi lượng nước bất thường (>50%). Vui lòng kiểm tra lại hoặc xác nhận để tiếp tục.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const usageDate = format(subDays(parseISO(formData.recordDate), 1), 'yyyy-MM-dd');
    const newReadings = filteredMeters.map(m => {
      const val = parseInt(meterReadings[m.id]);
      const last = getMeterInfo(m.id);
      const usage = calculateUsage(val, last || undefined, m.name);
      const existing = readings.find(r => r.meterId === m.id && r.recordDate === formData.recordDate);

      return {
        ...formData,
        meterId: m.id,
        meterReading: val,
        waterType: m.waterType,
        enteredBy: user.email,
        usage: usage,
        usageDate: usageDate,
        id: existing?.id
      };
    });

    // Check for past edits cascading update warning
    const hasSubsequentReadings = newReadings.some(nr => {
      return readings.some(r => r.meterId === nr.meterId && r.recordDate > nr.recordDate);
    });

    if (hasSubsequentReadings && !showUpdateWarning) {
      setPendingData(newReadings);
      setShowUpdateWarning(true);
      setLoading(false);
      return;
    }

    try {
      for (const reading of newReadings) {
        await onSave(reading);
      }
      setMessage({ type: 'success', text: 'Đã lưu dữ liệu thành công!' });
      setMeterReadings({});
      setConfirmWarnings(false);
      setShowUpdateWarning(false);
      setPendingData(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi lưu dữ liệu.' });
    } finally {
      setLoading(false);
    }
  };

  const executeSave = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      for (const reading of pendingData) {
        await onSave(reading);
      }
      setMessage({ type: 'success', text: 'Đã lưu dữ liệu thành công!' });
      setMeterReadings({});
      setConfirmWarnings(false);
      setShowUpdateWarning(false);
      setPendingData(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi lưu dữ liệu.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Update Warning Modal */}
      {showUpdateWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-orange-600 mb-4">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-bold">Cảnh báo cập nhật</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Bạn đang chỉnh sửa dữ liệu của một ngày trong quá khứ. 
              Hệ thống sẽ <strong>tự động cập nhật lại lượng tiêu thụ</strong> của các ngày kế tiếp dựa trên chỉ số mới này.
              Bạn có chắc chắn muốn tiếp tục?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUpdateWarning(false);
                  setPendingData(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeSave}
                className="flex-1 px-4 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all"
              >
                Tiếp tục cập nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit mx-auto">
        <button
          onClick={() => setActiveTab('entry')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'entry' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database size={18} />
          Nhập liệu mới
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'review' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText size={18} />
          Xem & Sửa dữ liệu
        </button>
      </div>

      {activeTab === 'entry' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="text-blue-600" size={24} />
              Nhập chỉ số đồng hồ
            </h2>
            <p className="text-slate-500 text-sm mt-1">Cập nhật chỉ số nước hàng ngày cho các khu vực</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {message && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                message.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
              }`}>
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Khu vực *</label>
                <select
                  value={formData.areaId}
                  onChange={e => setFormData({ ...formData, areaId: e.target.value, subLocationId: '' })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                >
                  <option value="">Chọn khu vực</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Vị trí con *</label>
                <select
                  value={formData.subLocationId}
                  disabled={!formData.areaId}
                  onChange={e => setFormData({ ...formData, subLocationId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">Chọn vị trí</option>
                  {filteredSubLocations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Ngày ghi nhận *</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    value={formData.recordDate}
                    onChange={e => setFormData({ ...formData, recordDate: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Người báo cáo *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={formData.reporter}
                    onChange={e => setFormData({ ...formData, reporter: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  >
                    <option value="">Chọn người báo cáo</option>
                    {reporters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Meters List */}
            {formData.subLocationId && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Danh sách đồng hồ trong vị trí</h3>
                <div className="space-y-3">
                  {filteredMeters.map(m => {
                    const last = getMeterInfo(m.id);
                    const currentVal = parseInt(meterReadings[m.id] || '');
                    const usage = calculateUsage(currentVal, last || undefined, m.name);
                    const hasWarning = checkUsageWarning(usage, last || undefined);

                    return (
                      <div 
                        key={m.id} 
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          editingMeterId === m.id 
                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-md' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Droplets size={16} className={m.waterType === 'Khai thác' ? 'text-blue-500' : 'text-emerald-500'} />
                            <span className="font-bold text-slate-900">{m.name}</span>
                            {m.isSubMeter && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Đồng hồ con</span>}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase">Chỉ số trước</p>
                            <p className="text-sm font-bold text-slate-700">{last?.meterReading || 0} m³</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="Nhập chỉ số mới"
                              autoFocus={editingMeterId === m.id}
                              value={meterReadings[m.id] || ''}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setMeterReadings({ ...meterReadings, [m.id]: val });
                                if (editingMeterId === m.id) setEditingMeterId(null);
                              }}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200">
                            <span className="text-sm text-slate-500">Tiêu thụ:</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${hasWarning ? 'text-orange-600' : 'text-blue-600'}`}>
                                +{usage.toLocaleString()} m³
                              </span>
                              {hasWarning && <AlertCircle size={16} className="text-orange-500" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3">
                <div className="flex items-start gap-3 text-orange-800">
                  <AlertCircle size={20} className="shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold">Cảnh báo thay đổi bất thường (&gt;50%)</p>
                    <p>Các đồng hồ sau có lượng nước thay đổi lớn: <span className="font-bold">{warnings.join(', ')}</span></p>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmWarnings}
                    onChange={e => setConfirmWarnings(e.target.checked)}
                    className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-bold text-orange-900">Tôi xác nhận các chỉ số này là chính xác</span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Ghi chú</label>
              <div className="relative">
                <FileText className="absolute left-4 top-4 text-slate-400" size={18} />
                <textarea
                  rows={3}
                  placeholder="Nhập ghi chú nếu có..."
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Lưu dữ liệu'}
            </button>
          </form>

          {/* Contextual Readings List (Quick View) */}
          <div className="p-8 border-t border-slate-100 bg-slate-50/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Dữ liệu vừa nhập ({formData.recordDate})</h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {contextualReadings.length} bản ghi
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Đồng hồ</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Chỉ số</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tiêu thụ</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contextualReadings.map((r) => {
                      const meter = meters.find(m => m.id === r.meterId);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Droplets size={14} className={r.waterType === 'Khai thác' ? 'text-blue-500' : 'text-emerald-500'} />
                              <div>
                                <p className="text-sm font-bold text-slate-900">{meter?.name}</p>
                                <p className="text-[10px] text-slate-500">
                                  {areas.find(a => a.id === r.areaId)?.name} - {subLocations.find(s => s.id === r.subLocationId)?.name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-slate-900">{r.meterReading.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-blue-600">+{r.usage.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleEdit(r)}
                                className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                title="Sửa"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setDeleteId(r.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Xóa"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {contextualReadings.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                          Chưa có dữ liệu nhập cho các tiêu chí đã chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Review Filters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ngày ghi nhận</label>
              <input
                type="date"
                value={reviewFilters.recordDate}
                onChange={e => setReviewFilters({ ...reviewFilters, recordDate: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Khu vực</label>
              <select
                value={reviewFilters.areaId}
                onChange={e => setReviewFilters({ ...reviewFilters, areaId: e.target.value, subLocationId: '' })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Tất cả khu vực</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vị trí con</label>
              <select
                value={reviewFilters.subLocationId}
                disabled={!reviewFilters.areaId}
                onChange={e => setReviewFilters({ ...reviewFilters, subLocationId: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50"
              >
                <option value="">Tất cả vị trí</option>
                {reviewSubLocations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Review List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-900">Danh sách dữ liệu chi tiết</h3>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {reviewReadings.length} bản ghi tìm thấy
                </span>
              </div>
              <button
                onClick={handleExportReview}
                disabled={reviewReadings.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <Download size={16} />
                Xuất CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Đồng hồ / Vị trí</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Chỉ số</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tiêu thụ</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reviewReadings.map((r) => {
                    const meter = meters.find(m => m.id === r.meterId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar size={14} />
                            <span className="text-sm font-medium">{format(new Date(r.recordDate), 'dd/MM/yyyy')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Droplets size={14} className={r.waterType === 'Khai thác' ? 'text-blue-500' : 'text-emerald-500'} />
                            <div>
                              <p className="text-sm font-bold text-slate-900">{meter?.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {areas.find(a => a.id === r.areaId)?.name} - {subLocations.find(s => s.id === r.subLocationId)?.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-slate-900">{r.meterReading.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-blue-600">+{r.usage.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleEdit(r)}
                              className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                              title="Sửa"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => setDeleteId(r.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Xóa"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {reviewReadings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                        Không tìm thấy dữ liệu phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 mb-8">Bạn có chắc chắn muốn xóa bản ghi này? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
