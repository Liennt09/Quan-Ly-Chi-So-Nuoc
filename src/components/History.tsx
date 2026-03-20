import React, { useState, useMemo } from 'react';
import { Area, SubLocation, Meter, Reading, Reporter } from '../types';
import { 
  Search, Filter, Download, Trash2, Edit2, ChevronLeft, 
  ChevronRight, Calendar, User, Droplets, Info, X, FileText 
} from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { exportToCSV } from '../lib/csv';

interface HistoryProps {
  areas: Area[];
  subLocations: SubLocation[];
  meters: Meter[];
  reporters: Reporter[];
  readings: Reading[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (reading: Reading) => void;
}

export default function History({ areas, subLocations, meters, reporters, readings, onDelete, onEdit }: HistoryProps) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    reporter: '',
    meterId: '',
    search: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const itemsPerPage = 15;

  const filteredReadings = useMemo(() => {
    return readings.filter(r => {
      const date = parseISO(r.recordDate);
      const start = filters.startDate ? parseISO(filters.startDate) : null;
      const end = filters.endDate ? parseISO(filters.endDate) : null;
      
      const dateMatch = (!start || date >= start) && (!end || date <= end);
      const reporterMatch = !filters.reporter || r.reporter === filters.reporter;
      const meterMatch = !filters.meterId || r.meterId === filters.meterId;
      
      const meterName = meters.find(m => m.id === r.meterId)?.name.toLowerCase() || '';
      const areaName = areas.find(a => a.id === r.areaId)?.name.toLowerCase() || '';
      const searchMatch = !filters.search || 
        meterName.includes(filters.search.toLowerCase()) || 
        areaName.includes(filters.search.toLowerCase()) ||
        r.note.toLowerCase().includes(filters.search.toLowerCase());

      return dateMatch && reporterMatch && meterMatch && searchMatch;
    }).sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
  }, [readings, filters, meters, areas]);

  const totalPages = Math.ceil(filteredReadings.length / itemsPerPage);
  const paginatedReadings = filteredReadings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = () => {
    exportToCSV(filteredReadings, areas, subLocations, meters);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await onDelete(deleteId);
      setDeleteId(null);
    } catch (err) {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Lịch sử dữ liệu</h2>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Download size={18} />
            Xuất CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <select
            value={filters.reporter}
            onChange={e => setFilters({ ...filters, reporter: e.target.value })}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="">Tất cả người báo cáo</option>
            {reporters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          <select
            value={filters.meterId}
            onChange={e => setFilters({ ...filters, meterId: e.target.value })}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="">Tất cả đồng hồ</option>
            {meters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Khu vực / Vị trí</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Đồng hồ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Chỉ số</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tiêu thụ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Người báo cáo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedReadings.map((r) => {
                const area = areas.find(a => a.id === r.areaId)?.name;
                const sub = subLocations.find(s => s.id === r.subLocationId)?.name;
                const meter = meters.find(m => m.id === r.meterId)?.name;
                
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{format(parseISO(r.recordDate), 'dd/MM/yyyy')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">{area}</p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Droplets size={14} className={r.waterType === 'Khai thác' ? 'text-blue-500' : 'text-emerald-500'} />
                        <span className="text-sm font-medium text-slate-700">{meter}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-900">{r.meterReading.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-blue-600">+{r.usage.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {r.reporter.charAt(0)}
                        </div>
                        <span className="text-sm text-slate-600">{r.reporter}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.note && (
                          <button 
                            onClick={() => setSelectedNote(r.note)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Xem ghi chú"
                          >
                            <FileText size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => onEdit(r)}
                          className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteId(r.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedReadings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Không tìm thấy dữ liệu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReadings.length)} trong tổng số {filteredReadings.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold text-slate-900 px-4">Trang {currentPage} / {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Note Modal */}
      {selectedNote && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                Ghi chú chi tiết
              </h3>
              <button onClick={() => setSelectedNote(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedNote}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedNote(null)}
                className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Đóng
              </button>
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
