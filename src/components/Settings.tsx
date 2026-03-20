import React, { useState, useMemo } from 'react';
import { Area, SubLocation, Meter, Reading, Reporter, WaterType } from '../types';
import { 
  Plus, Trash2, Edit2, Map, MapPin, Droplets, 
  Users, AlertCircle, CheckCircle2, X, Info, Filter
} from 'lucide-react';

interface SettingsProps {
  areas: Area[];
  subLocations: SubLocation[];
  meters: Meter[];
  reporters: Reporter[];
  readings: Reading[];
  onAdd: (collection: string, data: any) => Promise<void>;
  onDelete: (collection: string, id: string) => Promise<void>;
  onUpdate: (collection: string, id: string, data: any) => Promise<void>;
}

export default function Settings({ areas, subLocations, meters, reporters, readings, onAdd, onDelete, onUpdate }: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'areas' | 'subs' | 'meters' | 'reporters'>('areas');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    areaName: '',
    subName: '',
    subAreaId: '',
    meterName: '',
    meterSubId: '',
    meterType: 'Tiêu thụ' as WaterType,
    isSubMeter: false,
    isRelayMeter: false,
    reporterName: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string, id: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: string, id: string, data: any } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [filterAreaId, setFilterAreaId] = useState('');
  const [filterSubId, setFilterSubId] = useState('');

  // Reset search when tab changes
  React.useEffect(() => {
    setSearchTerm('');
    setSearchField('all');
    setFilterAreaId('');
    setFilterSubId('');
  }, [activeSubTab]);

  const handleAdd = async (type: string, data: any) => {
    setError(null);
    setSuccess(null);
    
    // Check duplicates
    if (type === 'areas' && areas.some(a => a.name.toLowerCase() === data.name.toLowerCase())) {
      setError('Tên khu vực đã tồn tại.');
      return;
    }
    if (type === 'reporters' && reporters.some(r => r.name.toLowerCase() === data.name.toLowerCase())) {
      setError('Tên người báo cáo đã tồn tại.');
      return;
    }

    try {
      if (editingItem) {
        await onUpdate(type, editingItem.id, data);
        setSuccess('Cập nhật thành công!');
        setEditingItem(null);
      } else {
        await onAdd(type, data);
        setSuccess('Thêm mới thành công!');
      }
      setFormData({ 
        areaName: '', 
        subName: '', 
        subAreaId: '',
        meterName: '', 
        meterSubId: '',
        meterType: 'Tiêu thụ',
        isSubMeter: false,
        isRelayMeter: false,
        reporterName: '' 
      });
    } catch (err) {
      setError('Có lỗi xảy ra.');
    }
  };

  const startEdit = (type: string, item: any) => {
    setError(null);
    setSuccess(null);
    setEditingItem({ type, id: item.id, data: item });
    
    if (type === 'areas') {
      setFormData({ ...formData, areaName: item.name });
    } else if (type === 'sub_locations') {
      setFormData({ ...formData, subName: item.name, subAreaId: item.areaId });
    } else if (type === 'meters') {
      setFormData({ 
        ...formData, 
        meterName: item.name, 
        meterSubId: item.subLocationId,
        meterType: item.waterType,
        isSubMeter: item.isSubMeter,
        isRelayMeter: item.isRelayMeter || false
      });
    } else if (type === 'reporters') {
      setFormData({ ...formData, reporterName: item.name });
    }
  };

  const confirmDelete = (type: string, id: string) => {
    setError(null);
    setSuccess(null);

    // Dependency checks
    if (type === 'areas' && subLocations.some(s => s.areaId === id)) {
      setError('Không thể xóa khu vực đang chứa các vị trí con.');
      return;
    }
    if (type === 'sub_locations' && meters.some(m => m.subLocationId === id)) {
      setError('Không thể xóa vị trí đang chứa các đồng hồ.');
      return;
    }
    if (type === 'meters' && readings.some(r => r.meterId === id)) {
      setError('Không thể xóa đồng hồ đã có dữ liệu lịch sử.');
      return;
    }

    setDeleteConfirm({ type, id });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    
    try {
      await onDelete(type, id);
      setSuccess('Đã xóa thành công!');
      setDeleteConfirm(null);
    } catch (err) {
      setError('Có lỗi xảy ra khi xóa.');
      setDeleteConfirm(null);
    }
  };

  const filteredList = useMemo(() => {
    let list: any[] = [];
    if (activeSubTab === 'areas') list = areas;
    else if (activeSubTab === 'subs') {
      list = subLocations;
      if (filterAreaId) {
        list = list.filter(s => s.areaId === filterAreaId);
      }
    }
    else if (activeSubTab === 'meters') {
      list = meters;
      if (filterAreaId) {
        const areaSubs = subLocations.filter(s => s.areaId === filterAreaId).map(s => s.id);
        list = list.filter(m => areaSubs.includes(m.subLocationId));
      }
      if (filterSubId) {
        list = list.filter(m => m.subLocationId === filterSubId);
      }
    }
    else if (activeSubTab === 'reporters') list = reporters;

    if (!searchTerm) return list;

    const term = searchTerm.toLowerCase();
    return list.filter(item => {
      if (activeSubTab === 'areas') {
        return item.name.toLowerCase().includes(term);
      }
      if (activeSubTab === 'subs') {
        const area = areas.find(a => a.id === item.areaId);
        if (searchField === 'name' || searchField === 'all') {
          if (item.name.toLowerCase().includes(term)) return true;
        }
        if (searchField === 'area' || searchField === 'all') {
          if (area?.name.toLowerCase().includes(term)) return true;
        }
        return false;
      }
      if (activeSubTab === 'meters') {
        const sub = subLocations.find(s => s.id === item.subLocationId);
        const area = areas.find(a => a.id === sub?.areaId);
        if (searchField === 'name' || searchField === 'all') {
          if (item.name.toLowerCase().includes(term)) return true;
        }
        if (searchField === 'location' || searchField === 'all') {
          if (sub?.name.toLowerCase().includes(term) || area?.name.toLowerCase().includes(term)) return true;
        }
        if (searchField === 'type' || searchField === 'all') {
          if (item.waterType.toLowerCase().includes(term)) return true;
        }
        return false;
      }
      if (activeSubTab === 'reporters') {
        return item.name.toLowerCase().includes(term);
      }
      return false;
    });
  }, [activeSubTab, areas, subLocations, meters, reporters, searchTerm, searchField, filterAreaId, filterSubId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cấu hình hệ thống</h2>
          <p className="text-slate-500 font-medium">Quản lý danh mục khu vực, vị trí và đồng hồ</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { id: 'areas', name: 'Khu vực', icon: Map },
          { id: 'subs', name: 'Vị trí con', icon: MapPin },
          { id: 'meters', name: 'Đồng hồ', icon: Droplets },
          { id: 'reporters', name: 'Người báo cáo', icon: Users },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id as any); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              activeSubTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.name}
          </button>
        ))}
      </div>

      {(error || success) && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-2 duration-200 ${
          error ? 'bg-red-50 border-red-100 text-red-800' : 'bg-green-50 border-green-100 text-green-800'
        }`}>
          {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <p className="text-sm font-medium">{error || success}</p>
          <button onClick={() => { setError(null); setSuccess(null); }} className="ml-auto opacity-50 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {editingItem ? <Edit2 className="text-orange-600" size={20} /> : <Plus className="text-blue-600" size={20} />}
              {editingItem ? 'Chỉnh sửa' : 'Thêm mới'}
            </div>
            {editingItem && (
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setFormData({ 
                    areaName: '', subName: '', subAreaId: '',
                    meterName: '', meterSubId: '', meterType: 'Tiêu thụ',
                    isSubMeter: false, isRelayMeter: false, reporterName: '' 
                  });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </h3>
          
          {activeSubTab === 'areas' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên khu vực</label>
                <input
                  type="text"
                  value={formData.areaName}
                  onChange={e => setFormData({ ...formData, areaName: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Khu A"
                />
              </div>
              <button 
                onClick={() => handleAdd('areas', { name: formData.areaName })}
                className={`w-full text-white py-2 rounded-xl font-bold transition-all ${editingItem ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {editingItem ? 'Cập nhật khu vực' : 'Thêm khu vực'}
              </button>
            </div>
          )}

          {activeSubTab === 'subs' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Thuộc khu vực</label>
                <select
                  value={formData.subAreaId}
                  onChange={e => setFormData({ ...formData, subAreaId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Chọn khu vực</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên vị trí con</label>
                <input
                  type="text"
                  value={formData.subName}
                  onChange={e => setFormData({ ...formData, subName: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Tầng 1"
                />
              </div>
              <button 
                onClick={() => handleAdd('sub_locations', { name: formData.subName, areaId: formData.subAreaId })}
                className={`w-full text-white py-2 rounded-xl font-bold transition-all ${editingItem ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {editingItem ? 'Cập nhật vị trí' : 'Thêm vị trí'}
              </button>
            </div>
          )}

          {activeSubTab === 'meters' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Thuộc vị trí</label>
                <select
                  value={formData.meterSubId}
                  onChange={e => setFormData({ ...formData, meterSubId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Chọn vị trí con</option>
                  {subLocations.map(s => (
                    <option key={s.id} value={s.id}>
                      {areas.find(a => a.id === s.areaId)?.name} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên đồng hồ</label>
                <input
                  type="text"
                  value={formData.meterName}
                  onChange={e => setFormData({ ...formData, meterName: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Đồng hồ tổng"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Loại nước</label>
                <div className="flex gap-2">
                  {['Khai thác', 'Tiêu thụ'].map(type => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, meterType: type as WaterType })}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${
                        formData.meterType === type ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Phân loại đồng hồ</label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {[
                      { label: 'Đồng hồ con', value: true },
                      { label: 'Đồng hồ chính', value: false }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setFormData({ ...formData, isSubMeter: opt.value })}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${
                          formData.isSubMeter === opt.value ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {[
                      { label: 'Đồng hồ chuyển tiếp', value: true },
                      { label: 'Đồng hồ thường', value: false }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setFormData({ ...formData, isRelayMeter: opt.value })}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${
                          formData.isRelayMeter === opt.value ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleAdd('meters', { 
                  name: formData.meterName, 
                  subLocationId: formData.meterSubId, 
                  waterType: formData.meterType,
                  isSubMeter: formData.isSubMeter,
                  isRelayMeter: formData.isRelayMeter
                })}
                className={`w-full text-white py-2 rounded-xl font-bold transition-all ${editingItem ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {editingItem ? 'Cập nhật đồng hồ' : 'Thêm đồng hồ'}
              </button>
            </div>
          )}

          {activeSubTab === 'reporters' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên người báo cáo</label>
                <input
                  type="text"
                  value={formData.reporterName}
                  onChange={e => setFormData({ ...formData, reporterName: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>
              <button 
                onClick={() => handleAdd('reporters', { name: formData.reporterName })}
                className={`w-full text-white py-2 rounded-xl font-bold transition-all ${editingItem ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {editingItem ? 'Cập nhật người báo cáo' : 'Thêm người báo cáo'}
              </button>
            </div>
          )}
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-bold text-slate-900">Danh sách hiện tại</h3>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filters */}
              {(activeSubTab === 'subs' || activeSubTab === 'meters') && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <Map size={14} className="text-slate-400" />
                  <select
                    value={filterAreaId}
                    onChange={e => { setFilterAreaId(e.target.value); setFilterSubId(''); }}
                    className="text-xs font-bold text-slate-600 outline-none bg-transparent"
                  >
                    <option value="">Tất cả khu vực</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {activeSubTab === 'meters' && filterAreaId && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm animate-in fade-in slide-in-from-left-2 duration-200">
                  <MapPin size={14} className="text-slate-400" />
                  <select
                    value={filterSubId}
                    onChange={e => setFilterSubId(e.target.value)}
                    className="text-xs font-bold text-slate-600 outline-none bg-transparent"
                  >
                    <option value="">Tất cả vị trí</option>
                    {subLocations.filter(s => s.areaId === filterAreaId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Box */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <Filter size={16} className="text-slate-400" />
                {activeSubTab === 'subs' && (
                  <select 
                    value={searchField} 
                    onChange={e => setSearchField(e.target.value)}
                    className="text-xs font-bold text-slate-600 outline-none bg-transparent border-r border-slate-100 pr-2 mr-1"
                  >
                    <option value="all">Tất cả</option>
                    <option value="name">Tên vị trí</option>
                    <option value="area">Khu vực</option>
                  </select>
                )}
                {activeSubTab === 'meters' && (
                  <select 
                    value={searchField} 
                    onChange={e => setSearchField(e.target.value)}
                    className="text-xs font-bold text-slate-600 outline-none bg-transparent border-r border-slate-100 pr-2 mr-1"
                  >
                    <option value="all">Tất cả</option>
                    <option value="name">Tên đ/hồ</option>
                    <option value="location">Vị trí</option>
                    <option value="type">Loại nước</option>
                  </select>
                )}
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="text-sm outline-none w-full md:w-40"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
            {activeSubTab === 'areas' && filteredList.map(a => (
              <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                    <Map size={16} />
                  </div>
                  <span className="font-semibold text-slate-700">{a.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit('areas', a)} className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => confirmDelete('areas', a.id)} className="p-2 text-slate-400 hover:text-red-600 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {activeSubTab === 'subs' && filteredList.map(s => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400">{areas.find(a => a.id === s.areaId)?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit('sub_locations', s)} className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => confirmDelete('sub_locations', s.id)} className="p-2 text-slate-400 hover:text-red-600 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {activeSubTab === 'meters' && filteredList.map(m => (
              <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    m.waterType === 'Khai thác' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    <Droplets size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">{m.name}</p>
                    <p className="text-xs text-slate-400">
                      {subLocations.find(s => s.id === m.subLocationId)?.name} ({m.waterType})
                      <span className="flex gap-2 mt-1">
                        {m.isSubMeter && <span className="text-blue-500 font-bold">• Đồng hồ con</span>}
                        {m.isRelayMeter && <span className="text-orange-500 font-bold">• Đồng hồ chuyển tiếp</span>}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit('meters', m)} className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => confirmDelete('meters', m.id)} className="p-2 text-slate-400 hover:text-red-600 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {activeSubTab === 'reporters' && filteredList.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                    <Users size={16} />
                  </div>
                  <span className="font-semibold text-slate-700">{r.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit('reporters', r)} className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => confirmDelete('reporters', r.id)} className="p-2 text-slate-400 hover:text-red-600 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {((activeSubTab === 'areas' && filteredList.length === 0) ||
              (activeSubTab === 'subs' && filteredList.length === 0) ||
              (activeSubTab === 'meters' && filteredList.length === 0) ||
              (activeSubTab === 'reporters' && filteredList.length === 0)) && (
              <div className="p-12 text-center text-slate-400 font-medium">
                {searchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có dữ liệu.'}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 mb-8">Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
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
