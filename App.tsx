import React, { useState } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from './services/firebase';
import { AdminDashboard } from './components/AdminDashboard';
import { ImageEditor } from './components/ImageEditor';
import { UserData, UserRole, AuthState } from './types';
import { Lock, User, AlertCircle, Loader2, Sparkles, Info } from 'lucide-react';

function App() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    role: UserRole.GUEST,
    user: null,
  });

  // State for Admin navigation (Dashboard vs Image Editor)
  // Default is 'EDITOR' so Admin sees the editing interface first
  const [adminView, setAdminView] = useState<'DASHBOARD' | 'EDITOR'>('EDITOR');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Check Hardcoded Admin
      if (username === 'admin' && password === '1234') {
        setAuth({
          isAuthenticated: true,
          role: UserRole.ADMIN,
          user: { 
            id: 'admin', 
            username: 'Administrator', 
            isActive: true, 
            expiryDate: new Date(2099, 1, 1).toISOString(),
            createdAt: new Date().toISOString() 
          }
        });
        return;
      }

      // 2. Check Firestore for Regular Users
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Incorrect username or password.');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() } as UserData;

      // 3. Logic Checks
      
      // Check Password
      if (userData.password !== password) {
        setError('Incorrect username or password.');
        setLoading(false);
        return;
      }

      // Check Active Status (Ban/Unban)
      if (!userData.isActive) {
        setError('Access denied: Your account has been suspended.');
        setLoading(false);
        return;
      }

      // Check Expiry Date
      const now = new Date();
      const expiry = new Date(userData.expiryDate);
      
      if (now > expiry) {
        setError(`Subscription expired on ${expiry.toLocaleDateString()}. Please contact admin.`);
        setLoading(false);
        return;
      }

      // All Passed -> Login Success
      setAuth({
        isAuthenticated: true,
        role: UserRole.USER,
        user: userData
      });

    } catch (err) {
      console.error(err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuth({
      isAuthenticated: false,
      role: UserRole.GUEST,
      user: null
    });
    setAdminView('EDITOR'); // Reset admin view to default
    setUsername('');
    setPassword('');
    setError('');
  };

  // --- ROUTING / VIEW LOGIC ---

  if (auth.isAuthenticated) {
    // If Admin
    if (auth.role === UserRole.ADMIN) {
        // Toggle between Dashboard and Editor for Admin
        if (adminView === 'EDITOR') {
            return (
                <ImageEditor 
                    user={auth.user} 
                    onLogout={handleLogout} 
                    onBackToAdmin={() => setAdminView('DASHBOARD')}
                />
            );
        }
        return (
            <AdminDashboard 
                onLogout={handleLogout} 
                onGoToEditor={() => setAdminView('EDITOR')} 
            />
        );
    }
    // If User -> Go directly to Image Editor
    return <ImageEditor user={auth.user} onLogout={handleLogout} />;
  }

  // --- LOGIN SCREEN ---
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-sm bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-8 relative z-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Professional AI</h1>
          <p className="text-gray-400 text-xs mt-1">Enterprise Image Generation Platform</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-950/50 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Username"
                required
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-950/50 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-950/30 p-3 rounded-lg border border-red-900/50">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-5">{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
           <div className="flex items-start gap-2 bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20">
              <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div className="text-[10px] text-gray-400">
                <p className="font-semibold text-indigo-300 mb-0.5">System Access:</p>
                <p>Authorized personnel only.</p>
                <p>Contact administrator for new accounts.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;