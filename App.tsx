
import React, { useState, useEffect, useRef } from 'react';
import { AppMode, Shape, Message, ModalConfig, Attachment, MaterialInfo, ProjectData } from './types';
import { Viewer3D } from './components/Viewer3D';
import { ChatPanel } from './components/ChatPanel';
import { Modal } from './components/Modal';
import { LoginPage } from './components/LoginPage';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard'; // Import Admin
import { sendMessageToGemini } from './services/geminiService';
import { Box, Download, Info, ShieldCheck, Zap, Check, Undo2, Redo2, Save, FolderOpen, ArrowLeft, Edit2 } from 'lucide-react';

// Configuration
// Accepting both domains to handle typos or auto-complete differences
const ADMIN_EMAILS = ['harishgouda52001@google.com', 'harishgouda52001@gmail.com'];

// Helper to check admin status
const isAdminEmail = (email: string) => ADMIN_EMAILS.includes(email.toLowerCase().trim());

// Helper to generate a simple STL string (Mocking STLExporter for MVP simplicity)
const generateMockSTL = (shapes: Shape[]) => {
  return `solid ExportedModel\n  // This file contains ${shapes.length} shapes.\n  // STL export logic would go here.\nendsolid ExportedModel`;
};

// Storage Keys
const PROJECTS_STORAGE_KEY = 'ai-cad-projects-v2';
const SESSION_STORAGE_KEY = 'ai-cad-session-v1';
const NAV_STATE_KEY = 'ai-cad-nav-state-v1';
const MOCK_USERS_KEY = 'ai-cad-users-db';
const SETTINGS_KEY = 'ai-cad-settings-v1';

// Helpers for Persistence
const getStoredProjects = (): ProjectData[] => {
  try { return JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || '[]'); } catch { return []; }
};
const getStoredSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null'); } catch { return null; }
};
const getStoredNav = () => {
  try { return JSON.parse(localStorage.getItem(NAV_STATE_KEY) || '{}'); } catch { return {}; }
};
const getSystemSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
};

export default function App() {
  // --- STATE INITIALIZATION WITH PERSISTENCE ---
  
  // Projects
  const [projects, setProjects] = useState<ProjectData[]>(getStoredProjects);

  // User Session
  const [user, setUser] = useState<{name: string, email: string}>(() => {
    const session = getStoredSession();
    return session || { name: '', email: '' };
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredSession());

  // Navigation State (Mode & Project ID)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    const nav = getStoredNav();
    return nav.projectId || null;
  });

  const [mode, setMode] = useState<AppMode>(() => {
    const session = getStoredSession();
    if (!session) return AppMode.LANDING;
    
    // PRIORITY: Check if stored session is an admin
    if (session.email && isAdminEmail(session.email)) {
       const nav = getStoredNav();
       // Only stay in Workspace if we were actually editing. 
       // OTHERWISE FORCE ADMIN. Do not default to Dashboard for this user.
       if (nav.mode === AppMode.WORKSPACE) {
          return AppMode.WORKSPACE;
       }
       return AppMode.ADMIN;
    }
    
    // Check Maintenance Mode for regular users on initial load
    const settings = getSystemSettings();
    if (settings.maintenanceMode) {
      // If maintenance is on, force regular users to Landing (or they will be caught by effect below)
      return AppMode.LANDING; 
    }

    const nav = getStoredNav();
    // Verify if the project still exists if trying to restore workspace
    if (nav.mode === AppMode.WORKSPACE && nav.projectId) {
       const projs = getStoredProjects();
       if (projs.find(p => p.id === nav.projectId)) {
         return AppMode.WORKSPACE;
       }
       return AppMode.DASHBOARD;
    }
    return nav.mode === AppMode.DASHBOARD ? AppMode.DASHBOARD : AppMode.DASHBOARD;
  });

  // Workspace Data (Shapes, etc.) - Restore if starting in Workspace
  const [shapes, setShapes] = useState<Shape[]>(() => {
    const nav = getStoredNav();
    if (nav.mode === AppMode.WORKSPACE && nav.projectId) {
      const p = getStoredProjects().find(p => p.id === nav.projectId);
      return p ? p.shapes : [];
    }
    return [];
  });

  const [materialLegend, setMaterialLegend] = useState<MaterialInfo[]>(() => {
    const nav = getStoredNav();
    if (nav.mode === AppMode.WORKSPACE && nav.projectId) {
      const p = getStoredProjects().find(p => p.id === nav.projectId);
      return p ? p.materialLegend : [];
    }
    return [];
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const nav = getStoredNav();
    if (nav.mode === AppMode.WORKSPACE && nav.projectId) {
      const p = getStoredProjects().find(p => p.id === nav.projectId);
      return p ? p.messages : [];
    }
    return [];
  });

  const [history, setHistory] = useState<string[]>(() => {
    const nav = getStoredNav();
    if (nav.mode === AppMode.WORKSPACE && nav.projectId) {
      const p = getStoredProjects().find(p => p.id === nav.projectId);
      return p ? p.history : [];
    }
    return [];
  });
  
  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    title: '',
    content: '',
    type: 'info'
  });
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  // Undo/Redo State
  const [pastStates, setPastStates] = useState<Shape[][]>([]);
  const [futureStates, setFutureStates] = useState<Shape[][]>([]);

  // Auto-save indication state
  const [showSaved, setShowSaved] = useState(false);
  const isFirstRender = useRef(true);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // --- PERSISTENCE EFFECT FOR NAVIGATION ---
  useEffect(() => {
    if (isAuthenticated) {
        const stateToSave = { 
            mode, 
            projectId: currentProjectId 
        };
        localStorage.setItem(NAV_STATE_KEY, JSON.stringify(stateToSave));
    } else {
        localStorage.removeItem(NAV_STATE_KEY);
    }
  }, [mode, currentProjectId, isAuthenticated]);

  // --- MAINTENANCE MODE ENFORCEMENT ---
  useEffect(() => {
    if (isAuthenticated && !isAdminEmail(user.email)) {
       const settings = getSystemSettings();
       if (settings.maintenanceMode) {
          console.log("Maintenance Mode Active - Force Logout for User");
          handleLogout();
          alert("System is currently undergoing maintenance. Please try again later.");
       }
    }
  }, [mode, isAuthenticated, user.email]);

  // --- PERSISTENCE LOGIC ---

  // Save specific project to the projects array and localstorage
  const saveCurrentProject = (
    updatedShapes: Shape[], 
    updatedLegend: MaterialInfo[], 
    updatedHistory: string[],
    updatedMessages: Message[]
  ) => {
    if (!currentProjectId) return;

    setProjects(prevProjects => {
      const updatedList = prevProjects.map(p => {
        if (p.id === currentProjectId) {
          return {
            ...p,
            shapes: updatedShapes,
            materialLegend: updatedLegend,
            history: updatedHistory,
            messages: updatedMessages,
            lastModified: Date.now()
          };
        }
        return p;
      });
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedList));
      return updatedList;
    });

    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Auto-save trigger when workspace state changes
  useEffect(() => {
    if (mode !== AppMode.WORKSPACE || !currentProjectId) return;
    
    // Skip initial render to avoid overwriting with empty state if loading
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Debounce save slightly or just save
    const timer = setTimeout(() => {
       saveCurrentProject(shapes, materialLegend, history, messages);
    }, 1000);

    return () => clearTimeout(timer);
  }, [shapes, materialLegend, history, messages, mode, currentProjectId]);


  // --- HISTORY / UNDO / REDO ---

  const pushToHistory = () => {
    setPastStates(prev => [...prev, shapes]);
    setFutureStates([]);
  };

  const undo = () => {
    if (pastStates.length === 0) return;
    const newPast = [...pastStates];
    const previousState = newPast.pop();
    
    setFutureStates(prev => [shapes, ...prev]);
    setPastStates(newPast);
    if (previousState) setShapes(previousState);
  };

  const redo = () => {
    if (futureStates.length === 0) return;
    const newFuture = [...futureStates];
    const nextState = newFuture.shift();
    
    setPastStates(prev => [...prev, shapes]);
    setFutureStates(newFuture);
    if (nextState) setShapes(nextState);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== AppMode.WORKSPACE) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shapes, pastStates, futureStates, mode]);


  // --- PROJECT MANAGEMENT HANDLERS ---

  const handleCreateProject = () => {
    const newProject: ProjectData = {
      id: `proj-${Date.now()}`,
      name: `Untitled Project ${projects.length + 1}`,
      lastModified: Date.now(),
      shapes: [],
      materialLegend: [],
      history: [],
      messages: [
        {
          id: 'welcome',
          role: 'model',
          text: "Hello! I'm your AI CAD Copilot. This is a new project. Ask me to create something!",
          timestamp: Date.now(),
        }
      ],
      ownerEmail: user.email // Store owner for Admin tracking
    };

    setProjects(prev => {
      const newList = [newProject, ...prev];
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newList));
      return newList;
    });

    handleOpenProject(newProject);
  };

  const handleOpenProject = (project: ProjectData) => {
    setCurrentProjectId(project.id);
    setShapes(project.shapes);
    setMaterialLegend(project.materialLegend);
    setHistory(project.history);
    setMessages(project.messages);
    
    // Reset Undo/Redo history for clean session
    setPastStates([]);
    setFutureStates([]);
    setReferenceImage(null); 
    
    setMode(AppMode.WORKSPACE);
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      setProjects(prev => {
        const newList = prev.filter(p => p.id !== projectId);
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newList));
        return newList;
      });
    }
  };

  const handleRenameProject = (projectId: string, newName: string) => {
     setProjects(prev => {
        const newList = prev.map(p => p.id === projectId ? { ...p, name: newName, lastModified: Date.now() } : p);
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newList));
        return newList;
     });
  };

  const handleBackToDashboard = () => {
    // Force a save before leaving
    saveCurrentProject(shapes, materialLegend, history, messages);
    
    // If admin, go back to Admin Panel, not User Dashboard
    if (user.email && isAdminEmail(user.email)) {
        setMode(AppMode.ADMIN);
    } else {
        setMode(AppMode.DASHBOARD);
    }
    setCurrentProjectId(null);
  };
  
  // --- USER PROFILE ---
  const handleUpdateUser = (newName: string) => {
    setUser(prev => {
        const updated = { ...prev, name: newName };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));

        // Update persistence in DB
        if (prev.email) {
            try {
                const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '{}');
                const userRecord = storedUsers[prev.email];
                
                if (userRecord) {
                    if (typeof userRecord === 'string') {
                        // Handle legacy data
                         storedUsers[prev.email] = { name: newName, createdAt: Date.now() };
                    } else {
                        // Handle new object structure
                         storedUsers[prev.email] = { ...userRecord, name: newName };
                    }
                    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(storedUsers));
                }
            } catch(e) { console.error(e); }
        }
        return updated;
    });
  };

  const handleLogout = () => {
    setUser({ name: '', email: '' });
    setIsAuthenticated(false);
    setMode(AppMode.LANDING);
    setCurrentProjectId(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(NAV_STATE_KEY);
  };
  
  // --- TITLE EDITING ---
  
  const startEditingTitle = () => {
    const currentName = projects.find(p => p.id === currentProjectId)?.name || 'Untitled';
    setEditedTitle(currentName);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const saveTitleEdit = () => {
    if (!currentProjectId) return;
    
    const newName = editedTitle.trim();
    if (!newName) {
       setIsEditingTitle(false);
       return;
    }

    // Check for duplicate names
    const isDuplicate = projects.some(p => 
      p.id !== currentProjectId && p.name.trim().toLowerCase() === newName.toLowerCase()
    );

    if (isDuplicate) {
      alert("A project with this name already exists. Please choose a unique name.");
      // Keep editing mode active
      titleInputRef.current?.focus();
      return; 
    }

    handleRenameProject(currentProjectId, newName);
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitleEdit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };


  // --- WORKSPACE HANDLERS ---

  const handleSendMessage = async (text: string, attachment?: Attachment) => {
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text, 
      timestamp: Date.now(),
      attachment: attachment 
    };
    
    if (attachment && (attachment.mimeType.startsWith('image/') || attachment.mimeType === 'application/pdf')) {
       setReferenceImage(`data:${attachment.mimeType};base64,${attachment.data}`);
    }
    
    setMessages(prev => [...prev, userMsg]);
    setHistory(prev => [...prev, text]);
    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(text, shapes, history, attachment);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);

      if (response.designUpdate) {
        pushToHistory();
        setShapes(response.designUpdate);
      }
      
      if (response.materialLegend) {
        setMaterialLegend(response.materialLegend);
      }

      if (response.isReview) {
         setModalConfig({
             isOpen: true,
             title: 'Design Review',
             content: response.text,
             type: 'review'
         });
      } else if (response.isExplanation) {
         setModalConfig({
             isOpen: true,
             title: 'Design Explanation',
             content: response.text,
             type: 'info'
         });
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I encountered an error connecting to the AI. Please try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShapeUpdate = (updatedShape: Shape) => {
    pushToHistory();
    setShapes(prev => prev.map(s => s.id === updatedShape.id ? updatedShape : s));
  };
  
  const handleShapesUpdate = (updatedShapes: Shape[]) => {
    pushToHistory();
    setShapes(prev => {
      const updateMap = new Map(updatedShapes.map(s => [s.id, s]));
      return prev.map(s => updateMap.get(s.id) || s);
    });
  };
  
  const handleDeleteShapes = (idsToDelete: string[]) => {
    pushToHistory();
    setShapes(prev => prev.filter(s => !idsToDelete.includes(s.id)));
  };

  const handleAddShape = (newShape: Shape) => {
    pushToHistory();
    setShapes(prev => [...prev, newShape]);
  };

  const handleExportSTL = () => {
    const stlContent = generateMockSTL(shapes);
    const blob = new Blob([stlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projects.find(p => p.id === currentProjectId)?.name || 'project'}.stl`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const triggerQuickAction = (action: string) => {
    let prompt = "";
    if (action === "review") prompt = "Review this design for manufacturability and structural integrity.";
    if (action === "explain") prompt = "Explain the current design and geometry choices.";
    if (action === "electrical") prompt = "Add a standard electrical layout (sockets, switches, lights) to the current design. IMPORTANT: Also generate detailed 3D wiring connections between them, showing Phase (Red), Neutral (Blue), and Earth (Green) wires as thin cylinders running along the walls.";
    
    if (prompt) handleSendMessage(prompt);
  };

  // --- AUTH FLOW ---

  const handleLoginSuccess = (userData: { name: string, email: string }) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userData));

    // Admin Logic Check
    if (isAdminEmail(userData.email)) {
       console.log("Admin Logged In - Redirecting to Admin Panel");
       setMode(AppMode.ADMIN);
    } else {
       setMode(AppMode.DASHBOARD);
    }
  };

  // --- RENDERING ---

  if (mode === AppMode.LOGIN) {
    return (
      <LoginPage 
        onLogin={handleLoginSuccess}
        onBack={() => setMode(AppMode.LANDING)}
      />
    );
  }

  // Admin Dashboard Render
  if (mode === AppMode.ADMIN) {
    return <AdminDashboard onLogout={handleLogout} onSwitchToUser={() => setMode(AppMode.DASHBOARD)} />;
  }

  if (mode === AppMode.LANDING) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] relative overflow-hidden text-slate-200">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px]"></div>
        
        <div className="z-10 text-center max-w-2xl px-6">
          <div className="flex justify-center mb-6">
             <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 ring-1 ring-white/10">
               <Box size={48} className="text-white" />
             </div>
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight mb-6">
            Build 3D models with <span className="text-indigo-400">natural language</span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 leading-relaxed">
            The AI CAD Copilot that turns your words into precise 3D geometry.
          </p>
          <div className="flex gap-4 justify-center">
             <button 
              onClick={() => setMode(AppMode.LOGIN)}
              className="px-8 py-4 bg-white text-slate-900 text-lg font-medium rounded-full hover:bg-slate-200 transition-all transform hover:scale-105 shadow-xl flex items-center gap-2"
            >
              <Zap size={20} className="fill-indigo-500 text-indigo-500" />
              Sign In to Design
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === AppMode.DASHBOARD) {
    return (
      <UserDashboard 
        userEmail={user.email}
        userName={user.name}
        projects={projects}
        onOpenProject={handleOpenProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onLogout={handleLogout}
        onRenameProject={handleRenameProject}
        onUpdateUser={handleUpdateUser}
        onSwitchToAdmin={() => setMode(AppMode.ADMIN)} // Pass switcher handler
      />
    );
  }

  // --- WORKSPACE VIEW ---

  const currentProjectName = projects.find(p => p.id === currentProjectId)?.name || 'Untitled';

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Modal config={modalConfig} onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} />
      
      {/* Header */}
      <header className="h-16 bg-[#0f172a] border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0 relative z-20 shadow-lg">
        <div className="flex items-center gap-6">
          
          <button 
             onClick={handleBackToDashboard}
             className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
             title="Back to Dashboard"
          >
             <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Box size={20} className="text-white" />
            </div>
            
            {/* Title Editing Area */}
            <div className="flex flex-col">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={saveTitleEdit}
                  onKeyDown={handleTitleKeyDown}
                  className="font-semibold text-sm text-slate-100 bg-black/50 border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none min-w-[150px]"
                />
              ) : (
                <div 
                   className="group flex items-center gap-2 cursor-pointer" 
                   onClick={startEditingTitle}
                   title="Click to rename"
                >
                   <h1 className="font-semibold text-sm text-slate-100 tracking-tight group-hover:text-indigo-300 transition-colors">
                     {currentProjectName}
                   </h1>
                   <Edit2 size={10} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              <span className="text-[10px] text-slate-500">Workspace</span>
            </div>
          </div>

          <div className="w-px h-6 bg-white/10"></div>

          {/* Undo/Redo & Save Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-white/5">
              <button 
                onClick={undo}
                disabled={pastStates.length === 0}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button 
                onClick={redo}
                disabled={futureStates.length === 0}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
            </div>
            
            <div 
              className={`flex items-center gap-2 transition-all duration-500 ease-out transform ${
                showSaved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20">
                <Check size={12} className="text-green-500" strokeWidth={3} />
              </div>
              <span className="text-xs font-medium text-slate-500">Saved</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => triggerQuickAction('explain')}
            className="hidden md:flex px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors gap-2 items-center"
          >
            <Info size={16} /> Explain
          </button>
          
          <button 
            onClick={() => triggerQuickAction('electrical')}
            className="hidden md:flex px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors gap-2 items-center"
          >
            <Zap size={16} className="text-yellow-400" /> Electrical
          </button>

          <button 
            onClick={() => triggerQuickAction('review')}
            className="hidden md:flex px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors gap-2 items-center"
          >
            <ShieldCheck size={16} /> Review
          </button>
          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>
          <button 
            onClick={handleExportSTL}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/20 border border-indigo-500/50"
          >
            <Download size={16} /> Export STL
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 relative">
        {/* Left: Chat */}
        <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col h-full flex-shrink-0 z-10">
          <ChatPanel 
            messages={messages} 
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>

        {/* Right: 3D Viewer */}
        <div className="flex-1 h-full hidden md:block relative z-0">
          <Viewer3D 
            shapes={shapes} 
            referenceImage={referenceImage} 
            materialLegend={materialLegend}
            onShapeUpdate={handleShapeUpdate}
            onShapesUpdate={handleShapesUpdate}
            onAddShape={handleAddShape}
            onDeleteShapes={handleDeleteShapes}
          />
        </div>
      </div>
    </div>
  );
}
