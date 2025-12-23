import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { UserData } from '../types';
import { Users, UserPlus, Ban, CheckCircle, RefreshCw, Key, Trash2, Search, AlertTriangle, UserCheck, Clock, ShieldCheck, Sparkles, BarChart3, Settings } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
  onGoToEditor: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onGoToEditor }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', days: 30, quota: 10 });
  const [editPasswordId, setEditPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
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
        dailyQuota: newUser.quota || 10,
        usageCount: 0,
        lastUsageDate: today
      });
      setNewUser({ username: '', password: '', days: 30, quota: 10 });
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

  const handleUpdateQuota = async (id: string, newQuota: number) => {
     const userRef = doc(db, "users", id);
     await updateDoc(userRef, {
       dailyQuota: newQuota
     });
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
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Members</p>
              <h3 className="text-2xl font-bold text-white">{totalMembers}</h3>
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <UserCheck className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Now</p>
              <h3 className="text-2xl font-bold text-white">{activeMembers}</h3>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Expired</p>
              <h3 className="text-2xl font-bold text-white">{expiredMembers}</h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Create User Panel (Left) */}
          <div className="lg:col-span-4">
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 sticky top-28 shadow-2xl">
              <div className="mb-6 pb-4 border-b border-slate-800">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  Register New Member
                </h2>
                <p className="text-xs text-slate-500 mt-1">Create account credentials and set validity period.</p>
              </div>

              <form onSubmit={handleAddUser} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-700"
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-700"
                    placeholder="Set password"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Validity (Days)</label>
                      <input
                        type="number"
                        value={newUser.days}
                        onChange={(e) => setNewUser({...newUser, days: parseInt(e.target.value)})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all font-mono"
                        min="1"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Daily Quota</label>
                      <input
                        type="number"
                        value={newUser.quota}
                        onChange={(e) => setNewUser({...newUser, quota: parseInt(e.target.value)})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all font-mono"
                        min="1"
                        required
                      />
                    </div>
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/30 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      'Processing...' 
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" /> 
                        Create Account
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Member List Panel (Right) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Search Bar */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex items-center gap-3 shadow-md">
               <Search className="w-5 h-5 text-slate-500" />
               <input 
                 type="text"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="Search by username..."
                 className="bg-transparent border-none outline-none text-white w-full placeholder-slate-600 text-sm"
               />
               <div className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-medium text-slate-400 border border-slate-700 whitespace-nowrap">
                  {filteredUsers.length} Results
               </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-widest font-bold">
                    <tr>
                      <th className="px-6 py-4">User Identity</th>
                      <th className="px-6 py-4">Usage Today</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Expiration</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => {
                        const isExpired = new Date(user.expiryDate) < new Date();
                        const isToday = user.lastUsageDate === new Date().toISOString().split('T')[0];
                        const displayUsage = isToday ? user.usageCount : 0;
                        const quota = user.dailyQuota || 10;
                        const usagePercent = Math.min((displayUsage / quota) * 100, 100);

                        return (
                          <tr key={user.id} className="hover:bg-slate-800/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md ${user.username === 'admin' ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                  {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-white">{user.username}</div>
                                  {editPasswordId === user.id ? (
                                     <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                       <input 
                                         type="text" 
                                         value={newPassword}
                                         onChange={(e) => setNewPassword(e.target.value)}
                                         className="bg-slate-950 border border-slate-600 rounded px-2 py-1 text-xs w-32 text-white focus:border-indigo-500 outline-none"
                                         placeholder="New Password"
                                         autoFocus
                                       />
                                       <button onClick={() => handleUpdatePassword(user.id)} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-white font-bold">SAVE</button>
                                       <button onClick={() => setEditPasswordId(null)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white">CANCEL</button>
                                     </div>
                                  ) : (
                                     <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                       <span className="opacity-50">Pass:</span> 
                                       <span className="font-mono bg-slate-800 px-1.5 rounded">{user.password}</span>
                                     </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1 w-24">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                                        <span>{displayUsage} / {quota}</span>
                                        <button onClick={() => {
                                            const newQ = parseInt(prompt("Set new daily quota:", quota.toString()) || "");
                                            if(!isNaN(newQ)) handleUpdateQuota(user.id, newQ);
                                        }} className="text-[10px] text-indigo-400 hover:underline">Edit</button>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full transition-all ${usagePercent >= 100 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                                          style={{width: `${usagePercent}%`}}
                                        ></div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                              {isExpired ? (
                                 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                   <Clock className="w-3 h-3" /> Expired
                                 </span>
                              ) : !user.isActive ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">
                                  <Ban className="w-3 h-3" /> Banned
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle className="w-3 h-3" /> Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col">
                                  <span className="text-sm text-slate-300 font-medium">
                                    {new Date(user.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {isExpired ? 'Access Revoked' : 'Valid until'}
                                  </span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => toggleBan(user.id, user.isActive, user.username)}
                                  className={`p-2 rounded-lg transition-all border ${
                                    user.isActive 
                                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10' 
                                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                  }`}
                                  title={user.isActive ? "Suspend Account" : "Activate Account"}
                                >
                                  {user.isActive ? <Ban className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setEditPasswordId(user.id);
                                    setNewPassword('');
                                  }}
                                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                  title="Reset Password"
                                >
                                  <Key className="w-4 h-4" />
                                </button>

                                <div className="w-px h-6 bg-slate-800 mx-1"></div>

                                <button
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                  title="Delete Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center">
                               <Search className="w-6 h-6 opacity-30" />
                            </div>
                            <p>No members found matching "{searchTerm}"</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};