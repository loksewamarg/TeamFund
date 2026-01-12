import React, { useState, useMemo } from 'react';
import { AppState, Member } from '../types';
import { Plus, Trash2, Phone, X, Edit2, Search, Calendar, User, History as HistoryIcon, UserX, UserCheck, ChevronRight, Briefcase, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { generateId } from '../services/storageService';

interface MembersProps {
  state: AppState;
  onAddMember: (member: Member) => void;
  onUpdateMember: (member: Member) => void;
  onRemoveMember: (id: string) => void;
}

export const Members: React.FC<MembersProps> = ({ 
  state, 
  onAddMember, 
  onUpdateMember, 
  onRemoveMember,
}) => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Form States
  const [formData, setFormData] = useState({ name: '', job: '', mobile: '', address: '', active: true });

  const getMemberHistory = (memberId: string) => {
    return state.contributions
        .filter(c => c.memberId === memberId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredMembers = useMemo(() => {
    return state.members.filter(member => {
        // 1. Filter by Active/Inactive Status
        if (statusFilter === 'active' && !member.active) return false;
        if (statusFilter === 'inactive' && member.active) return false;
        
        // 2. Search
        const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              member.job.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
      });
  }, [state.members, statusFilter, searchTerm]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    onAddMember({
      id: generateId(),
      name: formData.name,
      job: formData.job || 'Member',
      mobile: formData.mobile,
      address: formData.address,
      joinedAt: new Date().toISOString(),
      active: true
    });
    setFormData({ name: '', job: '', mobile: '', address: '', active: true });
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !formData.name) return;
    onUpdateMember({
      ...selectedMember,
      name: formData.name,
      job: formData.job,
      mobile: formData.mobile,
      address: formData.address,
      active: formData.active
    });
    setFormData({ name: '', job: '', mobile: '', address: '', active: true });
    setIsEditModalOpen(false);
    
    // If detail modal is open, update the selected member there too
    if (isDetailModalOpen) {
       setSelectedMember(prev => prev ? ({...prev, name: formData.name, job: formData.job, mobile: formData.mobile, address: formData.address, active: formData.active}) : null);
    } else {
       setSelectedMember(null);
    }
  };

  const openEditModal = (e: React.MouseEvent | null, member: Member) => {
    if (e) e.stopPropagation();
    setSelectedMember(member);
    setFormData({ name: member.name, job: member.job, mobile: member.mobile || '', address: member.address || '', active: member.active });
    setIsEditModalOpen(true);
  };

  const openDetailModal = (member: Member) => {
    setSelectedMember(member);
    setIsDetailModalOpen(true);
  };

  const toggleMemberStatus = (member: Member) => {
     onUpdateMember({ ...member, active: !member.active });
     setSelectedMember({ ...member, active: !member.active });
  };

  return (
    <div className="relative min-h-[80vh] pb-24 md:pb-0 animate-fade-in">
      {/* Header Controls */}
      <div className="mb-6 flex flex-col gap-4">
         {/* Top Row: Search */}
         <div className="relative bg-md-sys-color-surface-container-high rounded-full h-12 flex items-center px-4 shadow-sm border border-transparent focus-within:border-md-sys-color-primary focus-within:bg-md-sys-color-surface-container-low transition-colors">
            <Search size={20} className="text-md-sys-color-on-surface-variant mr-3" />
            <input 
               type="text"
               placeholder="Search by name or job..."
               className="bg-transparent w-full h-full outline-none text-md-sys-color-on-surface placeholder:text-md-sys-color-on-surface-variant/70"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>

         {/* Bottom Row: Status Toggle */}
         <div className="flex bg-md-sys-color-surface-container-high rounded-md p-1 border border-md-sys-color-outline/10 w-fit">
            <button 
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${statusFilter === 'active' ? 'bg-md-sys-color-surface shadow-sm text-md-sys-color-on-surface' : 'text-md-sys-color-on-surface-variant'}`}
            >
                Active Team
            </button>
            <button 
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${statusFilter === 'inactive' ? 'bg-md-sys-color-surface shadow-sm text-md-sys-color-on-surface' : 'text-md-sys-color-on-surface-variant'}`}
            >
                Inactive
            </button>
         </div>
      </div>

      {/* Members List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => (
            <div 
                key={member.id} 
                onClick={() => openDetailModal(member)}
                className={`rounded-md-xl p-4 border flex items-center gap-4 cursor-pointer group hover:shadow-md-elevation-2 transition-all duration-300 ${
                    member.active 
                    ? 'bg-md-sys-color-surface-container-low border-md-sys-color-outline/10 hover:border-md-sys-color-outline/30' 
                    : 'bg-md-sys-color-surface-variant/20 border-md-sys-color-outline/5 opacity-80'
                }`}
            >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                    member.active 
                        ? 'bg-md-sys-color-primary-container text-md-sys-color-on-primary-container'
                        : 'bg-md-sys-color-outline/20 text-md-sys-color-on-surface-variant'
                }`}>
                    {member.name.charAt(0)}
                </div>
                
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-md-sys-color-on-surface text-lg truncate">{member.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-md-sys-color-on-surface-variant">
                        <span className="flex items-center gap-1 truncate"><Briefcase size={12} /> {member.job}</span>
                        {!member.active && <span className="text-[10px] bg-md-sys-color-outline/20 px-1.5 py-0.5 rounded text-md-sys-color-on-surface-variant">Inactive</span>}
                    </div>
                </div>

                <ChevronRight size={20} className="text-md-sys-color-outline/50 group-hover:text-md-sys-color-primary transition-colors" />
            </div>
        ))}
      </div>

      {filteredMembers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-md-sys-color-outline">
              <p>No {statusFilter} members found.</p>
          </div>
      )}

      {/* FAB */}
      <button 
         onClick={() => {
            setFormData({ name: '', job: '', mobile: '', address: '', active: true });
            setIsAddModalOpen(true);
         }}
         className="fixed bottom-24 md:bottom-10 right-6 bg-md-sys-color-primary-container text-md-sys-color-on-primary-container w-14 h-14 rounded-md-lg shadow-md-elevation-3 flex items-center justify-center hover:bg-md-sys-color-primary hover:text-md-sys-color-on-primary transition-all duration-300 z-40 active:scale-95"
      >
         <Plus size={24} />
      </button>

      {/* --- MODALS --- */}
      
      {/* Detail Modal */}
      {isDetailModalOpen && selectedMember && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
             <div className="bg-md-sys-color-surface w-full max-w-lg rounded-md-xl shadow-md-elevation-3 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-md-sys-color-surface-container p-6 border-b border-md-sys-color-outline/10 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${selectedMember.active ? 'bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container' : 'bg-md-sys-color-surface-variant text-md-sys-color-on-surface-variant'}`}>
                            {selectedMember.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-medium text-md-sys-color-on-surface flex items-center gap-2">
                                {selectedMember.name}
                                {!selectedMember.active && <span className="text-xs bg-md-sys-color-error-container text-md-sys-color-on-error-container px-2 py-0.5 rounded-full font-bold">Inactive</span>}
                            </h2>
                            <p className="text-md-sys-color-on-surface-variant flex items-center gap-2">
                                <Briefcase size={14} /> {selectedMember.job}
                            </p>
                            {selectedMember.mobile && (
                                <p className="text-md-sys-color-on-surface-variant flex items-center gap-2 text-sm mt-1">
                                    <Phone size={14} /> {selectedMember.mobile}
                                </p>
                            )}
                            {selectedMember.address && (
                                <p className="text-md-sys-color-on-surface-variant flex items-center gap-2 text-sm mt-1">
                                    <MapPin size={14} /> {selectedMember.address}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => openEditModal(null, selectedMember)} className="p-2 hover:bg-md-sys-color-surface-container-high rounded-full text-md-sys-color-on-surface-variant" title="Edit">
                            <Edit2 size={20} />
                        </button>
                        <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-md-sys-color-surface-container-high rounded-full">
                            <X size={24} className="text-md-sys-color-on-surface-variant" />
                        </button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-md-sys-color-surface-container-low p-4 rounded-lg">
                            <p className="text-xs text-md-sys-color-on-surface-variant uppercase tracking-wider">Total Contributed</p>
                            <p className="text-xl font-bold text-md-sys-color-primary mt-1">
                                {state.currency}{getMemberHistory(selectedMember.id).reduce((sum, c) => sum + c.amount, 0)}
                            </p>
                        </div>
                        <div className="bg-md-sys-color-surface-container-low p-4 rounded-lg">
                            <p className="text-xs text-md-sys-color-on-surface-variant uppercase tracking-wider">Joined</p>
                            <p className="text-lg font-medium text-md-sys-color-on-surface mt-1">
                                {format(new Date(selectedMember.joinedAt || new Date()), 'MMM yyyy')}
                            </p>
                        </div>
                    </div>

                    <h3 className="font-medium text-md-sys-color-on-surface mb-3 flex items-center gap-2">
                        <HistoryIcon size={18} /> Contribution History
                    </h3>
                    
                    <div className="space-y-2 mb-6">
                        {getMemberHistory(selectedMember.id).length > 0 ? (
                            getMemberHistory(selectedMember.id).map(c => (
                                <div key={c.id} className="flex justify-between items-center p-3 border border-md-sys-color-outline/10 rounded-lg hover:bg-md-sys-color-surface-container-high transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-md-sys-color-surface-container-high p-2 rounded-full">
                                            <Calendar size={16} className="text-md-sys-color-on-surface-variant" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-md-sys-color-on-surface">
                                                {format(new Date(c.date), 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-xs text-md-sys-color-on-surface-variant">
                                                {format(new Date(c.date), 'h:mm a')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-md-sys-color-primary">+{state.currency}{c.amount}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-sm text-md-sys-color-on-surface-variant py-4">No contributions yet.</p>
                        )}
                    </div>
                    
                    <div className="border-t border-md-sys-color-outline/10 pt-4 mt-auto space-y-3">
                        <button 
                            onClick={() => toggleMemberStatus(selectedMember)}
                            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                                selectedMember.active 
                                ? 'bg-md-sys-color-error-container text-md-sys-color-on-error-container hover:bg-md-sys-color-error-container/80' 
                                : 'bg-md-sys-color-primary-container text-md-sys-color-on-primary-container hover:bg-md-sys-color-primary-container/80'
                            }`}
                        >
                            {selectedMember.active ? <UserX size={18} /> : <UserCheck size={18} />}
                            {selectedMember.active ? 'Mark as Inactive' : 'Reactivate Member'}
                        </button>
                        
                        <button 
                            onClick={() => {
                                if(confirm('Are you sure you want to permanently delete this member? All history will be lost.')) {
                                    onRemoveMember(selectedMember.id);
                                    setIsDetailModalOpen(false);
                                }
                            }}
                            className="w-full py-2 text-sm text-md-sys-color-error hover:underline"
                        >
                            Permanently Delete Member
                        </button>
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* Forms */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-md-sys-color-surface-container-high w-full max-w-[320px] md:max-w-[400px] rounded-md-xl p-6 shadow-md-elevation-3">
              
              {/* Add Member Form */}
              {isAddModalOpen && (
                 <form onSubmit={handleAddSubmit} className="space-y-4">
                    <h3 className="text-xl text-md-sys-color-on-surface">New Member</h3>
                    <div className="space-y-3">
                        <input autoFocus placeholder="Name" required className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        <input placeholder="Job Title" className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.job} onChange={e => setFormData({...formData, job: e.target.value})} />
                        <input placeholder="Mobile Number" className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
                        <input placeholder="Address (Optional)" className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-md-sys-color-primary font-medium hover:bg-md-sys-color-primary/10 rounded-full">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-full font-medium shadow-md-elevation-1">Save</button>
                    </div>
                 </form>
              )}

              {/* Edit Member Form */}
              {isEditModalOpen && (
                 <form onSubmit={handleEditSubmit} className="space-y-4">
                    <h3 className="text-xl text-md-sys-color-on-surface">Edit Details</h3>
                    <div className="space-y-3">
                        <input autoFocus placeholder="Name" required className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        <input placeholder="Job Title" className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.job} onChange={e => setFormData({...formData, job: e.target.value})} />
                        <input placeholder="Mobile Number" className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
                        <input placeholder="Address (Optional)" className="w-full bg-md-sys-color-surface-container-low p-3 rounded-md outline-none border border-transparent focus:border-md-sys-color-primary" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                        
                        <div className="flex items-center justify-between bg-md-sys-color-surface-container-low p-3 rounded-md">
                           <span className="text-sm text-md-sys-color-on-surface">Member Status</span>
                           <button 
                             type="button"
                             onClick={() => setFormData({...formData, active: !formData.active})}
                             className={`px-3 py-1 rounded text-xs font-bold transition-colors ${formData.active ? 'bg-md-sys-color-primary-container text-md-sys-color-on-primary-container' : 'bg-md-sys-color-error-container text-md-sys-color-on-error-container'}`}
                           >
                              {formData.active ? 'ACTIVE' : 'INACTIVE'}
                           </button>
                        </div>
                    </div>
                     <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-md-sys-color-primary font-medium hover:bg-md-sys-color-primary/10 rounded-full">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-full font-medium shadow-md-elevation-1">Update</button>
                    </div>
                 </form>
              )}
           </div>
        </div>
      )}
    </div>
  );
};