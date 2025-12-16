
import React, { useState, useEffect } from 'react';
import { Box, ArrowRight, Loader2, ChevronLeft, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: { name: string; email: string }) => void;
  onBack: () => void;
}

// Google Logo Component
const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onBack }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Storage Key
  const MOCK_USERS_KEY = 'ai-cad-users-db';
  const NAV_STATE_KEY = 'ai-cad-nav-state-v1';
  const SETTINGS_KEY = 'ai-cad-settings-v1';
  const ADMIN_EMAILS = ['harishgouda52001@google.com', 'harishgouda52001@gmail.com'];

  // Seed or Update Admin User on mount
  useEffect(() => {
    try {
      const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '{}');
      const adminName = 'Harish Gouda';
      const adminPass = 'Aa@9141074129';
      
      const adminEmails = ADMIN_EMAILS;
      
      adminEmails.forEach(email => {
          const existingAdmin = storedUsers[email];
          // Check if Admin needs to be created or updated (e.g. if password changed)
          if (!existingAdmin || typeof existingAdmin === 'string' || existingAdmin.password !== adminPass) {
            storedUsers[email] = {
              name: adminName,
              password: adminPass,
              createdAt: existingAdmin?.createdAt || Date.now()
            };
            console.log(`Admin credentials enforced for ${email}.`);
          }
      });
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(storedUsers));
    } catch (e) {
      console.error('Error enforcing admin credentials', e);
    }
  }, []);

  // Reset fields when switching modes
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [isSignUp]);

  const getSettings = () => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        return saved ? JSON.parse(saved) : { allowSignups: true, maintenanceMode: false };
    } catch {
        return { allowSignups: true, maintenanceMode: false };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email || !password || (isSignUp && !name)) {
      setError('Please fill in all fields');
      return;
    }

    const settings = getSettings();
    const normalizedEmail = email.toLowerCase().trim();

    // Check Maintenance Mode (Admins bypass)
    if (!isSignUp && settings.maintenanceMode && !ADMIN_EMAILS.includes(normalizedEmail)) {
        setError('System is currently under maintenance. Please try again later.');
        return;
    }

    // Check Signup Restriction
    if (isSignUp && !settings.allowSignups) {
        setError('New registrations are currently disabled by the administrator.');
        return;
    }

    setIsLoading(true);

    // Simulate API network delay
    setTimeout(() => {
      try {
        const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '{}');

        if (isSignUp) {
          // --- SIGN UP LOGIC ---
          if (storedUsers[normalizedEmail]) {
            setError('User already exists. Please sign in.');
            setIsLoading(false);
            return;
          }

          // Create new user record
          storedUsers[normalizedEmail] = {
            name: name.trim(),
            password: password, // In a real app, hash this!
            createdAt: Date.now()
          };
          
          localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(storedUsers));
          
          // Switch to Sign In mode and show success message.
          setIsLoading(false);
          setSuccess('Account created successfully! Please sign in.');
          setIsSignUp(false);
          setPassword(''); // Clear password field to force re-entry
          
        } else {
          // --- SIGN IN LOGIC ---
          const userRecord = storedUsers[normalizedEmail];

          if (!userRecord) {
            setError('Account not found. Please create one.');
            setIsLoading(false);
            return;
          }

          // Handle legacy data structure (string only) just in case
          if (typeof userRecord === 'string') {
             // Clear nav state before login to prevent sticking to old dashboards
             localStorage.removeItem(NAV_STATE_KEY);
             onLogin({ name: userRecord, email: normalizedEmail });
             return;
          }

          // Check Password
          if (userRecord.password !== password) {
            setError('Incorrect password. Please try again.');
            setIsLoading(false);
            return;
          }

          // Success - Clear nav state before login
          localStorage.removeItem(NAV_STATE_KEY);
          onLogin({ name: userRecord.name, email: normalizedEmail });
        }
      } catch (e) {
        console.error(e);
        setError('An unexpected error occurred.');
        setIsLoading(false);
      }
    }, 1000);
  };

  const toggleMode = () => {
    if (!isSignUp) {
        // Checking if moving TO signup
        const settings = getSettings();
        if (!settings.allowSignups) {
            setError("New registrations are currently disabled.");
            return;
        }
    }
    
    setIsSignUp(!isSignUp);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setName('');
  };

  // Reusable Floating Label Input Component
  const FloatingInput = ({ 
    id, 
    type, 
    value, 
    onChange, 
    label, 
    autoFocus = false,
    endIcon
  }: { 
    id: string, 
    type: string, 
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
    label: string, 
    autoFocus?: boolean,
    endIcon?: React.ReactNode
  }) => (
    <div className="relative group">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        className="block px-3 pb-2.5 pt-4 w-full text-sm text-slate-100 bg-transparent rounded-lg border border-slate-600 appearance-none focus:outline-none focus:ring-0 focus:border-indigo-500 peer"
        placeholder=" "
      />
      <label 
        htmlFor={id} 
        className="absolute text-sm text-slate-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-[#0f172a] px-2 peer-focus:px-2 peer-focus:text-indigo-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
      >
        {label}
      </label>
      {endIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {endIcon}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      <div className="w-full max-w-[400px] md:max-w-[450px] p-4 flex flex-col min-h-screen md:min-h-0 md:justify-center">
        
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="self-start mb-6 md:absolute md:top-8 md:left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {/* Card Container */}
        <div className="bg-[#0f172a] border border-white/5 md:rounded-[28px] p-8 md:p-10 shadow-2xl ring-1 ring-white/5 flex flex-col gap-8">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
               <Box size={40} className="text-indigo-500" />
            </div>
            <h1 className="text-2xl font-medium text-white mb-2">
              {isSignUp ? 'Create your account' : 'Sign in'}
            </h1>
            <p className="text-[15px] text-slate-400">
              to continue to <span className="text-slate-200 font-medium">AI CAD Copilot</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {isSignUp && (
              <FloatingInput 
                id="name" 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                label="Full Name"
                autoFocus
              />
            )}

            <FloatingInput 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              label="Email"
              autoFocus={!isSignUp}
            />

            <FloatingInput 
              id="password" 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              label="Password"
              endIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-white focus:outline-none">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {error && (
              <div className="text-red-400 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                <AlertTriangle size={12} className="text-red-400" />
                {error}
              </div>
            )}

            {success && (
              <div className="text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                <CheckCircle2 size={12} className="text-emerald-400" />
                {success}
              </div>
            )}

            {!isSignUp && (
               <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                     <input 
                       type="checkbox" 
                       id="remember" 
                       checked={rememberMe}
                       onChange={() => setRememberMe(!rememberMe)}
                       className="rounded border-slate-600 bg-transparent text-indigo-600 focus:ring-offset-[#0f172a]"
                     />
                     <label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer select-none">Remember me</label>
                  </div>
                  <button type="button" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                    Forgot password?
                  </button>
               </div>
            )}

            <div className="mt-4 flex flex-col gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium h-10 rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : (isSignUp ? 'Create account' : 'Next')}
                {!isLoading && !isSignUp && <ArrowRight size={16} />}
              </button>

              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
              >
                {isSignUp ? 'Sign in instead' : 'Create account'}
              </button>
            </div>
            
          </form>

          {/* Divider */}
          <div className="relative flex items-center py-2">
             <div className="flex-grow border-t border-white/10"></div>
             <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">or</span>
             <div className="flex-grow border-t border-white/10"></div>
          </div>
          
          {/* Social Auth */}
          <button 
            type="button"
            className="w-full bg-white text-slate-900 hover:bg-slate-100 text-sm font-medium h-10 rounded-full transition-colors flex items-center justify-center gap-3"
          >
            <GoogleLogo />
            Continue with Google
          </button>

        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-between text-xs text-slate-500 px-4">
           <button className="hover:text-slate-300">English (United States)</button>
           <div className="flex gap-4">
              <button className="hover:text-slate-300">Help</button>
              <button className="hover:text-slate-300">Privacy</button>
              <button className="hover:text-slate-300">Terms</button>
           </div>
        </div>

      </div>
    </div>
  );
};
