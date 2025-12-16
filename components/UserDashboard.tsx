
import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Folder, Trash2, Clock, Box, 
  Search, LogOut, LayoutGrid, MoreVertical, 
  FileText, Calendar, Edit2, User, Check, ShieldAlert
} from 'lucide-react';
import { ProjectData } from '../types';

interface UserDashboardProps {
  userEmail: string;
  userName: string;
  projects: ProjectData[];
  onOpenProject: (project: ProjectData) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onLogout: () => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onUpdateUser: (newName: string) => void;
  onSwitchToAdmin?: () => void; // Optional prop for admin switching
}

const ADMIN_EMAILS = ['harishgouda52001@google.com', 'harishgouda52001@gmail.com'];
const SETTINGS_KEY = 'ai-cad-settings-v1';

export const UserDashboard: React.FC<UserDashboardProps> = ({
  userEmail,
  userName,
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onLogout,
  onRenameProject,
  onUpdateUser,
  onSwitchToAdmin
}) => {
  const [search, setSearch] = useState('');
  
  // Project Renaming State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // User Profile Editing State
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserName, setEditUserName] = useState(userName);
  const userInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.lastModified - a.lastModified);

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
    }).format(new Date(ts));
  };

  // --- Helpers ---
  const handleCreateClick = () => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        const settings = saved ? JSON.parse(saved) : { maxProjects: 10 };
        
        // Admins bypass limits
        if (ADMIN_EMAILS.includes(userEmail.toLowerCase().trim())) {
             onCreateProject();
             return;
        }

        if (projects.length >= settings.maxProjects) {
            alert(`Project limit reached (${settings.maxProjects}). Please delete old projects or contact admin.`);
            return;
        }
        
        onCreateProject();
    } catch {
        onCreateProject();
    }
  };

  // --- Project Renaming Handlers ---
  const startEditing = (project: ProjectData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditName(project.name);
  };

  const saveEditing = (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation(); // Stop click from opening project
    e.preventDefault();
    
    if (!editingId || !editName.trim()) {
        if (editingId) setEditingId(null); // Cancel if empty
        return;
    }

    const newName = editName.trim();
    
    // Check for duplicate names (case-insensitive check against other projects)
    const isDuplicate = projects.some(p => 
      p.id !== editingId && p.name.trim().toLowerCase() === newName.toLowerCase()
    );

    if (isDuplicate) {
      alert("A project with this name already exists. Please choose a unique name.");
      // Keep editing mode open so user can fix it
      return; 
    }

    onRenameProject(editingId, newName);
    setEditingId(null);
  };

  // --- User Profile Handlers ---
  const startEditingUser = () => {
    setEditUserName(userName || 'Designer');
    setIsEditingUser(true);
    // Focus needs a slight delay for render
    setTimeout(() => userInputRef.current?.focus(), 0);
  };

  const saveUser = () => {
    if (editUserName.trim()) {
        onUpdateUser(editUserName.trim());
    }
    setIsEditingUser(false);
  };

  const handleUserKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        saveUser();
    } else if (e.key === 'Escape') {
        setIsEditingUser(false);
        setEditUserName(userName);
    }
  };

  // Check if current user is admin
  const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase().trim());

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      {/* Top Navigation */}
      <nav className="h-16 border-b border-white/5 bg-[#0f172a] px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Box size={20} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">AI CAD Dashboard</span>
        </div>
        
        <div className="flex items-center gap-6">
          
          {/* Admin Switcher Button - visible on all screens */}
          {isAdmin && onSwitchToAdmin && (
            <button 
              onClick={onSwitchToAdmin}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all"
            >
              <ShieldAlert size={14} /> Admin Panel
            </button>
          )}

          <div className="flex flex-col items-end hidden md:flex">
            {isEditingUser ? (
                <div className="flex items-center gap-2">
                    <input 
                        ref={userInputRef}
                        type="text"
                        value={editUserName}
                        onChange={(e) => setEditUserName(e.target.value)}
                        onBlur={saveUser}
                        onKeyDown={handleUserKeyDown}
                        className="bg-black/50 border border-indigo-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none w-32 text-right"
                    />
                </div>
            ) : (
                <div 
                    onClick={startEditingUser}
                    className="group cursor-pointer flex flex-col items-end"
                    title="Click to edit name"
                >
                    <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                        {userName || 'Designer'} 
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    </span>
                    <span className="text-xs text-slate-500">{userEmail}</span>
                </div>
            )}
          </div>
          
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          
          <div className="h-6 w-px bg-white/10 hidden md:block"></div>

          <button 
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your Projects</h1>
            <p className="text-slate-400">Manage and continue your 3D designs.</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="relative group">
               <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search projects..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="bg-[#1e293b] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 w-64 transition-all"
               />
             </div>
             <button 
               onClick={handleCreateClick}
               className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-all transform hover:scale-105"
             >
               <Plus size={18} /> New Project
             </button>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Folder size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-2">No projects found</h3>
            <p className="max-w-xs text-center mb-6">Start by creating a new design or searching for a different name.</p>
            <button 
               onClick={handleCreateClick}
               className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-2"
             >
               Create your first project <Plus size={16} />
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* New Project Card (Quick Action) */}
            <div 
              onClick={handleCreateClick}
              className="group cursor-pointer bg-[#0f172a]/40 border border-white/5 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[200px] hover:bg-[#0f172a] hover:border-indigo-500/30 transition-all"
            >
               <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                 <Plus size={24} className="text-indigo-400" />
               </div>
               <span className="font-medium text-slate-400 group-hover:text-indigo-400 transition-colors">Create New Project</span>
            </div>

            {/* Project Cards */}
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onOpenProject(project)}
                className="group relative bg-[#1e293b] border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col"
              >
                {/* Thumbnail / Header Color */}
                <div className="h-32 bg-[#020617] relative overflow-hidden flex items-center justify-center">
                   {/* Abstract Background based on ID */}
                   <div 
                     className="absolute inset-0 opacity-30" 
                     style={{ 
                       background: `radial-gradient(circle at ${parseInt(project.id.slice(-2))}% 50%, ${project.materialLegend?.[0]?.color || '#4f46e5'} 0%, transparent 70%)` 
                     }}
                   />
                   <Box size={40} className="text-slate-700 group-hover:text-indigo-500 transition-colors relative z-10 duration-500 group-hover:scale-110" />
                   
                   {/* Shape Count Badge */}
                   <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] text-slate-300 border border-white/10 flex items-center gap-1">
                      <LayoutGrid size={10} /> {project.shapes.length} Objects
                   </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    {editingId === project.id ? (
                      <div onClick={e => e.stopPropagation()} className="flex-1 mr-2">
                         <input 
                           autoFocus
                           className="w-full bg-black/50 border border-indigo-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                           value={editName}
                           onChange={e => setEditName(e.target.value)}
                           onBlur={saveEditing}
                           onKeyDown={e => e.key === 'Enter' && saveEditing(e)}
                           onClick={e => e.stopPropagation()}
                         />
                      </div>
                    ) : (
                      <h3 className="font-semibold text-white truncate pr-2 group-hover:text-indigo-300 transition-colors">{project.name}</h3>
                    )}
                    
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                        className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-slate-500 border-t border-white/5">
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(project.lastModified)}</span>
                    <button 
                      onClick={(e) => startEditing(project, e)}
                      className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                    >
                      <Edit2 size={12} /> Rename
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
