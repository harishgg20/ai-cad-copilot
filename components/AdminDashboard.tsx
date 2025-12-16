
import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Users, FolderOpen, Activity, Search, 
  Trash2, LogOut, BarChart3, Database, Lock, Settings, 
  ChevronRight, AlertTriangle, CheckCircle, RefreshCw, Layout,
  Save, AlertCircle, Server, ToggleLeft, ToggleRight
} from 'lucide-react';
import { ProjectData } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onSwitchToUser?: () => void;
}

interface UserRecord {
  name: string;
  password?: string;
  createdAt?: number;
}

// Storage Keys (Must match App.tsx)
const PROJECTS_STORAGE_KEY = 'ai-cad-projects-v2';
const MOCK_USERS_KEY = 'ai-cad-users-db';
const SETTINGS_KEY = 'ai-cad-settings-v1'; // New key for settings
const ADMIN_EMAILS = ['harishgouda52001@google.com', 'harishgouda52001@gmail.com'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onSwitchToUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'projects' | 'settings'>('overview');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [users, setUsers] = useState<Record<string, UserRecord>>({}); // Email -> Object
  const [stats, setStats] = useState({ totalStorage: '0 KB', apiCalls: 1245, serverStatus: 'Healthy' });

  // System Settings State (Initialized from LocalStorage)
  const [settings, setSettings] = useState(() => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        return saved ? JSON.parse(saved) : {
            allowSignups: true,
            maintenanceMode: false,
            maxProjects: 10,
            apiRateLimit: 100
        };
    } catch {
        return {
            allowSignups: true,
            maintenanceMode: false,
            maxProjects: 10,
            apiRateLimit: 100
        };
    }
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // Load Data
  const refreshData = () => {
    try {
      const storedProjects = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || '[]');
      setProjects(storedProjects);

      const rawUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '{}');
      
      // Normalize users (handle legacy string format vs new object format)
      const normalizedUsers: Record<string, UserRecord> = {};
      Object.entries(rawUsers).forEach(([email, data]) => {
         if (typeof data === 'string') {
            normalizedUsers[email] = { name: data, createdAt: Date.now() };
         } else {
            normalizedUsers[email] = data as UserRecord;
         }
      });
      
      setUsers(normalizedUsers);

      // Calc fake storage size
      const size = (JSON.stringify(storedProjects).length + JSON.stringify(rawUsers).length) / 1024;
      setStats(prev => ({ ...prev, totalStorage: `${size.toFixed(2)} KB` }));
    } catch (e) {
      console.error("Admin Load Error", e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Actions
  const handleDeleteUser = (email: string) => {
    if (!confirm(`Are you sure you want to ban/delete user: ${email}? This cannot be undone.`)) return;
    
    // 1. Delete user from Users DB
    const newUsersRaw = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '{}');
    delete newUsersRaw[email];
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(newUsersRaw));
    
    // 2. Delete all projects owned by this user
    const newProjects = projects.filter(p => p.ownerEmail !== email);
    setProjects(newProjects);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newProjects));
    
    // 3. Update local state
    const newUsersState = { ...users };
    delete newUsersState[email];
    setUsers(newUsersState);
  };

  const handleDeleteProject = (projectId: string) => {
    if (!confirm("Force delete this project?")) return;
    const newProjects = projects.filter(p => p.id !== projectId);
    setProjects(newProjects);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newProjects));
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    // Persist to LocalStorage
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    
    setTimeout(() => {
        setIsSaving(false);
        // alert("System settings updated successfully."); 
    }, 500);
  };

  const handleResetDatabase = () => {
     const phrase = "DELETE ALL DATA";
     const input = prompt(`DANGER ZONE: This will wipe all users and projects. Type "${phrase}" to confirm.`);
     if (input === phrase) {
         localStorage.removeItem(PROJECTS_STORAGE_KEY);
         localStorage.removeItem(MOCK_USERS_KEY);
         alert("Database wiped. Refreshing...");
         window.location.reload();
     }
  };

  // Helper
  const isAdmin = (email: string) => ADMIN_EMAILS.includes(email.toLowerCase().trim());

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-64 bg-[#0f172a] border-r border-white/5 flex flex-col flex-shrink-0 z-20">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
           <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20">
              <ShieldAlert size={18} className="text-white" />
           </div>
           <div>
             <h1 className="font-bold text-white tracking-tight">Admin Panel</h1>
             <p className="text-[10px] text-red-400 font-mono uppercase tracking-wider">Root Access</p>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Activity size={18} /> System Overview
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Users size={18} /> User Management
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'projects' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <FolderOpen size={18} /> Global Projects
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={18} /> System Settings
          </button>

          <div className="h-px bg-white/5 my-4 mx-2"></div>
          
          {onSwitchToUser && (
            <button 
                onClick={onSwitchToUser}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-indigo-500/10 transition-colors"
            >
                <Layout size={18} /> User View
            </button>
          )}

        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-[#020617] relative">
         <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none"></div>

         <div className="max-w-6xl mx-auto p-8 relative z-10">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h2 className="text-2xl font-semibold text-white mb-1">
                    {activeTab === 'overview' && 'System Dashboard'}
                    {activeTab === 'users' && 'User Registry'}
                    {activeTab === 'projects' && 'Project Repository'}
                    {activeTab === 'settings' && 'Platform Configuration'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {activeTab === 'overview' && `Last updated: ${new Date().toLocaleTimeString()}`}
                    {activeTab === 'users' && `Managing ${Object.keys(users).length} registered users`}
                    {activeTab === 'projects' && `Tracking ${projects.length} design files`}
                    {activeTab === 'settings' && 'Manage global application parameters'}
                  </p>
               </div>
               <button onClick={refreshData} className="p-2 bg-[#1e293b] rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-[#334155] transition-colors">
                  <RefreshCw size={18} />
               </button>
            </div>

            {/* --- OVERVIEW TAB --- */}
            {activeTab === 'overview' && (
               <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div className="bg-[#0f172a] border border-white/5 p-5 rounded-2xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users</span>
                           <Users size={16} className="text-indigo-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">{Object.keys(users).length}</div>
                        <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1"><CheckCircle size={10} /> Active</div>
                     </div>

                     <div className="bg-[#0f172a] border border-white/5 p-5 rounded-2xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Projects</span>
                           <FolderOpen size={16} className="text-indigo-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">{projects.length}</div>
                        <div className="text-xs text-slate-500 mt-2">+2 from last session</div>
                     </div>

                     <div className="bg-[#0f172a] border border-white/5 p-5 rounded-2xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Storage Used</span>
                           <Database size={16} className="text-indigo-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.totalStorage}</div>
                        <div className="text-xs text-slate-500 mt-2">LocalStorage limit</div>
                     </div>

                     <div className="bg-[#0f172a] border border-white/5 p-5 rounded-2xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">API Health</span>
                           <Activity size={16} className="text-emerald-400" />
                        </div>
                        <div className="text-3xl font-bold text-emerald-400">{stats.serverStatus}</div>
                        <div className="text-xs text-slate-500 mt-2">Gemini 1.5 Flash</div>
                     </div>
                  </div>

                  {/* System Log */}
                  <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6">
                     <h3 className="text-lg font-semibold text-white mb-4">System Activity Log</h3>
                     <div className="space-y-0">
                        <div className="flex items-center gap-4 py-3 border-b border-white/5">
                           <span className="text-xs font-mono text-slate-500 w-24">10:42:01 AM</span>
                           <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium">AUTH</span>
                           <span className="text-sm text-slate-300">Admin login detected (IP: 127.0.0.1)</span>
                        </div>
                        <div className="flex items-center gap-4 py-3 border-b border-white/5">
                           <span className="text-xs font-mono text-slate-500 w-24">10:41:55 AM</span>
                           <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">API</span>
                           <span className="text-sm text-slate-300">Gemini model generated 34 shapes for Project-102</span>
                        </div>
                        <div className="flex items-center gap-4 py-3 border-b border-white/5">
                           <span className="text-xs font-mono text-slate-500 w-24">10:30:12 AM</span>
                           <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">SYS</span>
                           <span className="text-sm text-slate-300">LocalStorage quota check passed</span>
                        </div>
                        <div className="flex items-center gap-4 py-3">
                           <span className="text-xs font-mono text-slate-500 w-24">10:28:00 AM</span>
                           <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-medium">USER</span>
                           <span className="text-sm text-slate-300">New user registration: user@example.com</span>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* --- USERS TAB --- */}
            {activeTab === 'users' && (
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email (ID)</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                       <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Projects</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(users).length === 0 ? (
                       <tr><td colSpan={5} className="p-8 text-center text-slate-500 text-sm">No users found.</td></tr>
                    ) : (
                      (Object.entries(users) as [string, UserRecord][]).map(([email, userData]) => (
                        <tr key={email} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                           <td className="p-4">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                   {userData.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-sm font-medium text-white">{userData.name}</span>
                                   {userData.createdAt && <span className="text-[10px] text-slate-500">Joined: {new Date(userData.createdAt).toLocaleDateString()}</span>}
                                </div>
                             </div>
                           </td>
                           <td className="p-4 text-sm text-slate-400 font-mono">{email}</td>
                           <td className="p-4">
                              {isAdmin(email) 
                                ? <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">Admin</span>
                                : <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300 border border-slate-600/50">User</span>
                              }
                           </td>
                           <td className="p-4 text-sm text-slate-400">
                             {projects.filter(p => p.ownerEmail === email).length}
                           </td>
                           <td className="p-4 text-right">
                              {!isAdmin(email) && (
                                <button 
                                  onClick={() => handleDeleteUser(email)}
                                  className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                           </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* --- PROJECTS TAB --- */}
            {activeTab === 'projects' && (
               <div className="bg-[#0f172a] border border-white/5 rounded-2xl overflow-hidden">
               <div className="p-4 border-b border-white/10 bg-white/5 flex gap-4">
                  <Search size={18} className="text-slate-500" />
                  <input type="text" placeholder="Search global projects..." className="bg-transparent text-sm text-white focus:outline-none w-full" />
               </div>
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-white/5 border-b border-white/10">
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Project Name</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Owner</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Complexity</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Modified</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {projects.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500 text-sm">No projects found.</td></tr>
                   ) : (
                     projects.map((proj) => (
                       <tr key={proj.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded bg-indigo-500/20 flex items-center justify-center">
                                  <Database size={14} className="text-indigo-400" />
                               </div>
                               <span className="text-sm font-medium text-white">{proj.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-slate-400">
                             {proj.ownerEmail || 'Unknown'}
                          </td>
                          <td className="p-4 text-sm text-slate-300">
                             {proj.shapes.length} shapes
                          </td>
                          <td className="p-4 text-sm text-slate-400">
                             {new Date(proj.lastModified).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                             <button 
                               onClick={() => handleDeleteProject(proj.id)}
                               className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors"
                               title="Force Delete"
                             >
                               <Trash2 size={16} />
                             </button>
                          </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
            )}
            
            {/* --- SETTINGS TAB --- */}
            {activeTab === 'settings' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                 
                 {/* General Settings */}
                 <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-600/10 rounded-lg"><Settings size={20} className="text-indigo-400" /></div>
                        <h3 className="text-lg font-semibold text-white">General Configuration</h3>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-slate-200">Allow New Registrations</h4>
                                <p className="text-xs text-slate-500">New users can sign up from the login page.</p>
                            </div>
                            <button 
                                onClick={() => setSettings(s => ({ ...s, allowSignups: !s.allowSignups }))}
                                className={`p-1.5 rounded-full transition-colors ${settings.allowSignups ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                            >
                                {settings.allowSignups ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-slate-200">Maintenance Mode</h4>
                                <p className="text-xs text-slate-500">Prevent regular users from accessing the dashboard.</p>
                            </div>
                            <button 
                                onClick={() => setSettings(s => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                                className={`p-1.5 rounded-full transition-colors ${settings.maintenanceMode ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                            >
                                {settings.maintenanceMode ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                            </button>
                        </div>
                        
                        <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Max Projects / User</label>
                                <input 
                                   type="number" 
                                   value={settings.maxProjects}
                                   onChange={(e) => setSettings(s => ({ ...s, maxProjects: parseInt(e.target.value) }))}
                                   className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">API Rate Limit (Req/Min)</label>
                                <input 
                                   type="number" 
                                   value={settings.apiRateLimit}
                                   onChange={(e) => setSettings(s => ({ ...s, apiRateLimit: parseInt(e.target.value) }))}
                                   className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                 </div>
                 
                 {/* Data Management */}
                 <div className="bg-[#0f172a] border border-red-500/20 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-red-600/10 rounded-lg"><AlertCircle size={20} className="text-red-400" /></div>
                        <h3 className="text-lg font-semibold text-white">Danger Zone</h3>
                    </div>
                    
                    <div className="flex items-center justify-between bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                        <div>
                            <h4 className="text-sm font-medium text-red-200">Reset Database</h4>
                            <p className="text-xs text-red-400/70">Permanently delete all users and projects. Cannot be undone.</p>
                        </div>
                        <button 
                            onClick={handleResetDatabase}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-red-900/20"
                        >
                            Wipe Data
                        </button>
                    </div>
                 </div>

                 {/* Save Action */}
                 <div className="flex justify-end pt-4">
                    <button 
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Changes
                    </button>
                 </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
