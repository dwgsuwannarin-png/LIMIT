import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { UserData } from '../types';
import { Users, UserPlus, Ban, CheckCircle, RefreshCw, Key, Trash2, Search, AlertTriangle, UserCheck, Clock, ShieldCheck, Sparkles, BarChart3, Settings, X, Pencil, Zap, Save, Lock, Crown, Star } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
  onGoToEditor: () => void;
}

// Quota Tiers Configuration
const QUOTA_TIERS = [
  { id: 'starter', label: 'Starter', amount: 5, icon: Star, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  { id: 'pro', label: 'Pro', amount: 50, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  { id: 'enterprise', label: 'Enterprise', amount: 500, icon: Crown, color: 'text-indigo-400', bg: 'bg-indigo-500/20' }
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onGoToEditor }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', days: 30, quota: 5 });
  const [editPasswordId, setEditPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  // Quota Editing State
  const [editQuotaId, setEditQuotaId] = useState<string | null>(null);
  const [editingQuotaValue, setEditingQuotaValue] = useState<number>(0);

  // System Settings State
  const [newSystemKey, setNewSystemKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for realtime updates
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserData[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserData));
      setUsers(usersData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;

    // Check if username already exists locally to prevent duplicates quickly
    if (users.some(u => u.username === newUser.username)) {
      alert("Username already exists!");
      return;
    }

    setLoading(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + newUser.days);
      const today = new Date().toISOString().split('T')[0];

      await addDoc(collection(db, "users"), {
        username: newUser.username,
        password: newUser.password,
        isActive: true,
        expiryDate: expiryDate.toISOString(),
        createdAt: new Date().toISOString(),
        dailyQuota: newUser.quota || 5,
        usageCount: 0,
        lastUsageDate: today
      });
      setNewUser({ username: '', password: '', days: 30, quota: 5 });
    } catch (error) {
      console.error("Error adding user: ", error);
      alert("Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async (id: string, currentStatus: boolean, username: string) => {
    const action = currentStatus ? "BAN" : "ACTIVATE";
    if (!window.confirm(`Are you sure you want to ${action} user "${username}"?`)) return;

    const userRef = doc(db, "users", id);
    await updateDoc(userRef, {
      isActive: !currentStatus
    });
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY DELETE user "${username}"?\nThis action cannot be undone.`)) return;
    
    try {
      await deleteDoc(doc(db, "users", id));
    } catch (error) {
      console.error("Error deleting user: ", error);
      alert("Failed to delete user.");
    }
  };

  const handleUpdatePassword = async (id: string) => {
    if (!newPassword) return;
    try {
      const userRef = doc(db, "users", id);
      await updateDoc(userRef, {
        password: newPassword
      });
      setEditPasswordId(null);
      setNewPassword('');
      alert("Password updated successfully.");
    } catch (error) {
      console.error("Error updating password: ", error);
      alert("Failed to update password.");
    }
  };

  const startEditingQuota = (id: string, currentQuota: number) => {
      setEditQuotaId(id);
      setEditingQuotaValue(currentQuota);
  };

  const saveQuota = async (id: string) => {
      try {
        const userRef = doc(db, "users", id);
        await updateDoc(userRef, {
           dailyQuota: editingQuotaValue
        });
        setEditQuotaId(null);
      } catch (err) {
        console.error("Failed to update quota", err);
        alert("Failed to update quota");
      }
  };

  const handleSaveSystemKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSystemKey) return;
    setIsSavingKey(true);
    try {
        // Save to a specialized 'settings' collection
        await setDoc(doc(db, "settings", "global"), {
            geminiApiKey: newSystemKey,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        setNewSystemKey('');
        alert("System API Key has been updated in the database.");
    } catch (err) {
        console.error("Failed to save system key", err);
        alert("Failed to save system key.");
    } finally {
        setIsSavingKey(false);
    }
  };

  // Helper to identify tier
  const getTierInfo = (quota: number) => {
      if (quota >= 500) return QUOTA_TIERS[2]; // Enterprise
      if (quota >= 50) return QUOTA_TIERS[1]; // Pro
      return QUOTA_TIERS[0]; // Starter
  };

  // Stats Logic
  const totalMembers = users.length;
  const activeMembers = users.filter(u => u.isActive && new Date(u.expiryDate) > new Date()).length;
  const expiredMembers = users.filter(u => new Date(u.expiryDate) < new Date()).length;

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none tracking-tight">Admin Console</h1>
            <p className="text-[11px] text-slate-400 font-medium mt-1">System Management Dashboard</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onGoToEditor}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
             <Sparkles className="w-4 h-4" />
             Open Image Editor
          </button>
          
          <div className="w-px h-6 bg-slate-800 mx-1"></div>

          <button 
            onClick={onLogout}
            className="px-5 py-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 border border-slate-700 hover:border-red-500/30 rounded-xl transition-all text-sm font-semibold flex items-center gap-2"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="container mx-auto p-6 space-y-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Members</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalMembers}</h3>
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <UserCheck className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Active</p>
              <h3 className="text-2xl font-bold text-white mt-1">{activeMembers}</h3>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Expired</p>
              <h3 className="text-2xl font-bold text-white mt-1">{expiredMembers}</h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Forms */}
          <div className="lg:col-span-1 space-y-6">
              
              {/* Add User Form */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6 text-indigo-400">
                  <UserPlus className="w-5 h-5" />
                  <h2 className="text-lg font-bold">Register New User</h2>
                </div>
                
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Username</label>
                    <div className="relative">
                      <UserPlus className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Enter username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Password</label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Set password"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Plan / Quota</label>
                    <div className="flex gap-2 mb-2">
                        {QUOTA_TIERS.map(tier => (
                            <button
                                type="button"
                                key={tier.id}
                                onClick={() => setNewUser({...newUser, quota: tier.amount})}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                                    newUser.quota === tier.amount 
                                    ? `bg-slate-800 border-indigo-500 text-white` 
                                    : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}
                            >
                                <tier.icon className={`w-3 h-3 ${newUser.quota === tier.amount ? tier.color : ''}`} />
                                {tier.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                          <Zap className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                          <input 
                            type="number"
                            min="1"
                            value={newUser.quota}
                            onChange={(e) => setNewUser({...newUser, quota: Number(e.target.value)})}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            placeholder="Custom Amount"
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Duration</label>
                      <div className="relative">
                          <Clock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                          <select
                            value={newUser.days}
                            onChange={(e) => setNewUser({...newUser, days: Number(e.target.value)})}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none appearance-none"
                          >
                            <option value={7}>7 Days</option>
                            <option value={30}>30 Days</option>
                            <option value={90}>3 Months</option>
                            <option value={365}>1 Year</option>
                          </select>
                      </div>
                    </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Create Account
                  </button>
                </form>
              </div>

              {/* System Settings Form */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 text-amber-400">
                  <Settings className="w-5 h-5" />
                  <h2 className="text-lg font-bold">System Settings</h2>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-200 leading-relaxed">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Enter the Admin API Key here to enable generation for all members. This overrides the system environment variable.
                    </p>
                </div>
                <form onSubmit={handleSaveSystemKey} className="space-y-4">
                   <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Gemini API Key</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="password"
                        value={newSystemKey}
                        onChange={(e) => setNewSystemKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder-slate-600"
                        placeholder="AIza..."
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingKey || !newSystemKey}
                    className="w-full bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 font-bold py-3 rounded-xl border border-slate-700 hover:border-amber-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSavingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save System Key
                  </button>
                </form>
              </div>
          </div>

          {/* User List Table */}
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-fit">
            <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-900/80 backdrop-blur">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <Users className="w-5 h-5 text-indigo-400" />
                 Member List
              </h2>
              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search username..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="p-4 font-medium">User Info</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Plan Expiry</th>
                    <th className="p-4 font-medium">Usage Today</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                         No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isExpired = new Date(user.expiryDate) < new Date();
                      const tier = getTierInfo(user.dailyQuota || 0);

                      return (
                        <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-red-500/20 text-red-400'}`}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-slate-200">{user.username}</p>
                                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${tier.color} ${tier.bg}`}>
                                        <tier.icon className="w-2 h-2" />
                                        {tier.label}
                                    </div>
                                </div>
                                {editPasswordId === user.id ? (
                                   <div className="flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-left-2">
                                      <input 
                                        type="text" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-24 bg-slate-950 border border-slate-600 rounded px-2 py-0.5 text-xs text-white"
                                        placeholder="New Pass"
                                        autoFocus
                                      />
                                      <button onClick={() => handleUpdatePassword(user.id)} className="bg-green-500/20 text-green-400 p-0.5 rounded hover:bg-green-500/30"><CheckCircle className="w-3 h-3" /></button>
                                      <button onClick={() => {setEditPasswordId(null); setNewPassword('');}} className="bg-red-500/20 text-red-400 p-0.5 rounded hover:bg-red-500/30"><X className="w-3 h-3" /></button>
                                   </div>
                                ) : (
                                   <button 
                                     onClick={() => setEditPasswordId(user.id)}
                                     className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-1 mt-0.5 transition-colors"
                                   >
                                     <Key className="w-3 h-3" /> Reset Pass
                                   </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                             {user.isActive ? (
                               <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                                 <CheckCircle className="w-3 h-3" /> Active
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                                 <Ban className="w-3 h-3" /> Banned
                               </span>
                             )}
                          </td>
                          <td className="p-4">
                             <div className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-slate-300'}`}>
                               {new Date(user.expiryDate).toLocaleDateString()}
                             </div>
                             {isExpired && <span className="text-[10px] text-red-500 font-bold uppercase">Expired</span>}
                          </td>
                          <td className="p-4">
                             {editQuotaId === user.id ? (
                               <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    value={editingQuotaValue}
                                    onChange={(e) => setEditingQuotaValue(Number(e.target.value))}
                                    className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                                  />
                                  <button onClick={() => saveQuota(user.id)} className="text-green-400 hover:bg-green-400/10 p-1 rounded"><CheckCircle className="w-3 h-3" /></button>
                                  <button onClick={() => setEditQuotaId(null)} className="text-red-400 hover:bg-red-400/10 p-1 rounded"><X className="w-3 h-3" /></button>
                               </div>
                             ) : (
                               <div className="group/quota flex items-center gap-2">
                                  <div className="text-sm">
                                    <span className="font-semibold text-white">{user.usageCount || 0}</span>
                                    <span className="text-slate-500"> / {user.dailyQuota || 10}</span>
                                  </div>
                                  <button 
                                    onClick={() => startEditingQuota(user.id, user.dailyQuota || 10)}
                                    className="opacity-0 group-hover/quota:opacity-100 transition-opacity text-indigo-400 hover:bg-indigo-400/10 p-1 rounded"
                                    title="Edit Quota"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                               </div>
                             )}
                          </td>
                          <td className="p-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                               <button 
                                 onClick={() => toggleBan(user.id, user.isActive, user.username)}
                                 className={`p-2 rounded-lg transition-colors ${
                                   user.isActive 
                                     ? 'text-slate-400 hover:bg-red-500/10 hover:text-red-400' 
                                     : 'text-emerald-400 hover:bg-emerald-500/10'
                                 }`}
                                 title={user.isActive ? "Ban User" : "Activate User"}
                               >
                                 {user.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                               </button>
                               <button 
                                 onClick={() => handleDeleteUser(user.id, user.username)}
                                 className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                 title="Delete User"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};