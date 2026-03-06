import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  getDocFromServer,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { TournamentSettings, Team, HistoryRecord, Registration, OperationType, FirestoreErrorInfo, Notice } from './types';
import { Trophy, Users, Settings, History as HistoryIcon, LogIn, LogOut, Plus, Trash2, Save, AlertCircle, ChevronRight, Image as ImageIcon, MessageSquare, Phone, Facebook, ClipboardList, CheckCircle, XCircle, User as UserIcon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './ErrorBoundary';

// --- Error Handler ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const compressImage = (file: File, maxWidth = 400, maxHeight = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          reject(new Error('Canvas context not found'));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- Components ---

const UserMenu = ({ user, onLogin, onLogout }: { user: User | null, onLogin: () => void, onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => user ? setIsOpen(!isOpen) : onLogin()}
        className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md hover:bg-zinc-800 border border-white/10 p-1 rounded-full transition-all shadow-xl"
      >
        {user ? (
          <div className="flex items-center gap-2 pr-3">
            <img 
              src={user.photoURL || ''} 
              alt={user.displayName || ''} 
              className="w-8 h-8 rounded-full border border-fire-orange/50"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col items-start leading-none hidden sm:flex">
              <span className="text-[10px] font-black text-fire-orange uppercase tracking-tighter">Profile</span>
              <span className="text-xs font-bold text-white truncate max-w-[80px]">{user.displayName?.split(' ')[0]}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pr-3">
            <div className="w-8 h-8 bg-fire-orange rounded-full flex items-center justify-center shadow-lg shadow-fire-orange/20">
              <UserIcon size={16} className="text-white" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">Guest</span>
              <span className="text-xs font-bold text-white">Login</span>
            </div>
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && user && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 bottom-full mb-3 w-56 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50"
          >
            <div className="p-3 border-b border-white/5 mb-1">
              <div className="flex items-center gap-3 mb-2">
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || ''} 
                  className="w-10 h-10 rounded-full border border-fire-orange"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden">
                  <div className="text-sm font-black text-white truncate">{user.displayName}</div>
                  <div className="text-[10px] font-bold text-white/40 truncate">{user.email}</div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                onLogout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2.5 hover:bg-fire-red/20 text-fire-red rounded-xl transition-colors text-sm font-bold"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminPanel = ({ 
  settings, 
  teams, 
  registrations,
  notices,
  onUpdateSettings, 
  onAddTeam, 
  onUpdateTeam, 
  onDeleteTeam,
  onClearTeams,
  onSaveHistory,
  onClearHistory,
  onUpdateRegistration,
  onDeleteRegistration,
  onAddNotice,
  onDeleteNotice,
  tournamentHistory,
  onCloneTeams,
  isCloning,
  onDeleteHistoryRecord
}: { 
  settings: TournamentSettings, 
  teams: Team[],
  registrations: Registration[],
  notices: Notice[],
  onUpdateSettings: (s: Partial<TournamentSettings>) => void,
  onAddTeam: () => void,
  onUpdateTeam: (id: string, t: Partial<Team>) => void,
  onDeleteTeam: (id: string) => void,
  onClearTeams: () => void,
  onSaveHistory: () => void,
  onClearHistory: () => void,
  onDeleteHistoryRecord: (id: string) => void,
  onUpdateRegistration: (id: string, status: 'approved' | 'rejected') => void,
  onDeleteRegistration: (id: string) => void,
  onAddNotice: (title: string, content: string) => void,
  onDeleteNotice: (id: string) => void,
  tournamentHistory: HistoryRecord[],
  onCloneTeams: (id: string) => void,
  isCloning: boolean
}) => {
  const [adminTab, setAdminTab] = useState<'teams' | 'registrations' | 'notices' | 'history'>('teams');
  const [newNotice, setNewNotice] = useState({ title: '', content: '' });
  const handleFileUpload = async (id: string, file: File) => {
    try {
      const compressedImage = await compressImage(file, 200, 200, 0.7);
      onUpdateTeam(id, { logoUrl: compressedImage });
    } catch (error) {
      console.error('Error compressing image:', error);
    }
  };

  return (
    <div className="p-4 bg-black/40 rounded-2xl border border-fire-orange/20">
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4">Admin Dashboard</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams Section */}
        <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-fire-yellow flex items-center gap-2 mb-4">
            <Users size={18} /> Manage Teams
          </h3>
          <section>
            <h3 className="text-sm font-bold text-fire-yellow mb-3 flex items-center gap-2">
              <Settings size={18} /> Header Info
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Round</label>
                <input 
                  type="text" 
                  value={settings.round} 
                  onChange={(e) => onUpdateSettings({ round: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Day</label>
                <input 
                  type="text" 
                  value={settings.day} 
                  onChange={(e) => onUpdateSettings({ day: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Ranking Limit</label>
                <input 
                  type="text" 
                  value={settings.rankingLimit} 
                  onChange={(e) => onUpdateSettings({ rankingLimit: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">YouTube Live URL</label>
                <input 
                  type="text" 
                  value={settings.youtubeUrl || ''} 
                  onChange={(e) => onUpdateSettings({ youtubeUrl: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                  placeholder="https://www.youtube.com/embed/..."
                />
              </div>
              <div className="col-span-full">
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Scrolling Notice</label>
                <input 
                  type="text" 
                  value={settings.notice || ''} 
                  onChange={(e) => onUpdateSettings({ notice: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                  placeholder="Enter scrolling notice text..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Timer End Time</label>
                <input 
                  type="datetime-local" 
                  value={settings.timerEnd ? new Date(settings.timerEnd.toDate ? settings.timerEnd.toDate() : settings.timerEnd).toISOString().slice(0, 16) : ''} 
                  onChange={(e) => onUpdateSettings({ timerEnd: Timestamp.fromDate(new Date(e.target.value)) })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">bKash Number</label>
                <input 
                  type="text" 
                  value={settings.bkashNumber || ''} 
                  onChange={(e) => onUpdateSettings({ bkashNumber: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Nagad Number</label>
                <input 
                  type="text" 
                  value={settings.nagadNumber || ''} 
                  onChange={(e) => onUpdateSettings({ nagadNumber: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Reg. Fee</label>
                <input 
                  type="text" 
                  value={settings.registrationFee || ''} 
                  onChange={(e) => onUpdateSettings({ registrationFee: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Custom ID</label>
                <input 
                  type="text" 
                  value={settings.customId || ''} 
                  onChange={(e) => onUpdateSettings({ customId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                  placeholder="ID: 123456"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Custom Password</label>
                <input 
                  type="text" 
                  value={settings.customPassword || ''} 
                  onChange={(e) => onUpdateSettings({ customPassword: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                  placeholder="Pass: 123"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/50 mb-0.5">Footer Text</label>
                <input 
                  type="text" 
                  value={settings.footerText || ''} 
                  onChange={(e) => onUpdateSettings({ footerText: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs focus:border-fire-orange outline-none"
                  placeholder="© SA ASIF"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-fire-yellow flex items-center gap-2">
                <Users size={18} /> Team Entries ({settings.round} | {settings.day})
              </h3>
              <div className="flex gap-2">
                {teams.length === 0 && tournamentHistory.length > 0 && (
                  <div className="relative group">
                    <button className="bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all">
                      <Plus size={14} /> Clone from History
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2 hidden group-hover:block z-50">
                      <div className="text-[10px] uppercase text-white/40 mb-2 px-2">Select Round to Clone</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {tournamentHistory.map(record => (
                          <button 
                            key={record.id}
                            onClick={() => record.id && onCloneTeams(record.id)}
                            disabled={isCloning}
                            className="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs text-white flex justify-between items-center"
                          >
                            <span>{record.tournamentData.round} | {record.tournamentData.day}</span>
                            <span className="text-[10px] text-white/40">{record.teams.length} Teams</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={onAddTeam}
                  className="bg-fire-orange hover:bg-fire-red text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-xs"
                >
                  <Plus size={14} /> Add Team Slot
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {teams.map((team, index) => (
                <div key={team.id} className="bg-white/5 border border-white/10 p-3 rounded-xl relative group">
                  <button 
                    onClick={() => team.id && onDeleteTeam(team.id)}
                    className="absolute top-2 right-2 bg-fire-red p-1.5 rounded-full shadow-lg hover:bg-red-500 transition-all z-10"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                      <div className="lg:col-span-6 flex gap-2 items-center">
                        <div className="relative w-10 h-10 bg-black/40 rounded border border-white/10 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-fire-orange transition-colors">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && team.id && handleFileUpload(team.id, e.target.files[0])}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          {team.logoUrl ? (
                            <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon size={16} className="text-white/20" />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="block text-[9px] uppercase text-white/40 mb-0.5">Team Name</label>
                          <input 
                            type="text" 
                            value={team.name} 
                            onChange={(e) => team.id && onUpdateTeam(team.id, { name: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[9px] uppercase text-white/40 mb-0.5">Leader Name</label>
                          <input 
                            type="text" 
                            value={team.leaderName || ''} 
                            onChange={(e) => team.id && onUpdateTeam(team.id, { leaderName: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[9px] uppercase text-white/40 mb-0.5 text-center">Position</label>
                          <input 
                            type="number" 
                            value={team.position || 0} 
                            onChange={(e) => team.id && onUpdateTeam(team.id, { position: parseInt(e.target.value) || 0 })}
                            className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm text-center"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[9px] uppercase text-white/40 mb-0.5 text-center">Game Time</label>
                          <input 
                            type="text" 
                            placeholder="00:00"
                            value={team.gameTime || ''} 
                            onChange={(e) => team.id && onUpdateTeam(team.id, { gameTime: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm text-center"
                          />
                        </div>
                      </div>
                    <div className="lg:col-span-6 grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase text-white/40 mb-0.5 text-center">Matches</label>
                        <input 
                          type="number" 
                          value={team.matches} 
                          onChange={(e) => team.id && onUpdateTeam(team.id, { matches: parseInt(e.target.value) || 0 })}
                          className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-white/40 mb-0.5 text-center">Booyah</label>
                        <input 
                          type="number" 
                          value={team.booyah} 
                          onChange={(e) => team.id && onUpdateTeam(team.id, { booyah: parseInt(e.target.value) || 0 })}
                          className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-white/40 mb-0.5 text-center">Kill Pts</label>
                        <input 
                          type="number" 
                          value={team.killPoints} 
                          onChange={(e) => team.id && onUpdateTeam(team.id, { killPoints: parseInt(e.target.value) || 0 })}
                          className="w-full bg-black/20 border border-white/10 rounded p-1 text-sm text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-white/40 mb-0.5 text-center">Pos. Pts</label>
                        <div className="space-y-1">
                          <input 
                            type="number" 
                            value={team.positionPoints} 
                            readOnly
                            className="w-full bg-black/40 border border-white/10 rounded p-1 text-sm text-center font-bold text-fire-yellow"
                          />
                          <div className="grid grid-cols-6 gap-1">
                            <input 
                              type="number" 
                              placeholder="M1"
                              value={team.m1Points || ''} 
                              onChange={(e) => team.id && onUpdateTeam(team.id, { m1Points: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/20 border border-white/10 rounded p-0.5 text-[8px] text-center placeholder:text-white/20"
                            />
                            <input 
                              type="number" 
                              placeholder="M2"
                              value={team.m2Points || ''} 
                              onChange={(e) => team.id && onUpdateTeam(team.id, { m2Points: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/20 border border-white/10 rounded p-0.5 text-[8px] text-center placeholder:text-white/20"
                            />
                            <input 
                              type="number" 
                              placeholder="M3"
                              value={team.m3Points || ''} 
                              onChange={(e) => team.id && onUpdateTeam(team.id, { m3Points: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/20 border border-white/10 rounded p-0.5 text-[8px] text-center placeholder:text-white/20"
                            />
                            <input 
                              type="number" 
                              placeholder="M4"
                              value={team.m4Points || ''} 
                              onChange={(e) => team.id && onUpdateTeam(team.id, { m4Points: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/20 border border-white/10 rounded p-0.5 text-[8px] text-center placeholder:text-white/20"
                            />
                            <input 
                              type="number" 
                              placeholder="M5"
                              value={team.m5Points || ''} 
                              onChange={(e) => team.id && onUpdateTeam(team.id, { m5Points: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/20 border border-white/10 rounded p-0.5 text-[8px] text-center placeholder:text-white/20"
                            />
                            <input 
                              type="number" 
                              placeholder="M6"
                              value={team.m6Points || ''} 
                              onChange={(e) => team.id && onUpdateTeam(team.id, { m6Points: parseInt(e.target.value) || 0 })}
                              className="w-full bg-black/20 border border-white/10 rounded p-0.5 text-[8px] text-center placeholder:text-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-2 flex items-center justify-end gap-4">
                      <div className="flex flex-col items-center">
                        <label className="block text-[9px] uppercase text-white/40 mb-1">Total</label>
                        <div className="text-sm font-black text-fire-orange bg-fire-orange/10 px-2 py-1 rounded border border-fire-orange/20">
                          {team.totalPoints}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <label className="block text-[9px] uppercase text-white/40 mb-1">Winner</label>
                        <button 
                          onClick={() => team.id && onUpdateTeam(team.id, { isWinner: !team.isWinner })}
                          className={`p-1.5 rounded-lg transition-all ${team.isWinner ? 'bg-fire-yellow text-black' : 'bg-white/5 text-white/20'}`}
                        >
                          <Trophy size={16} />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] uppercase text-white/40">Total</div>
                        <div className="text-lg font-black text-fire-orange leading-none">{team.totalPoints}</div>
                      </div>
                      <button 
                        onClick={() => team.id && onDeleteTeam(team.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all ml-2"
                        title="Delete Team"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button 
              onClick={onSaveHistory}
              className="bg-fire-red hover:bg-fire-orange text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-fire-red/20 text-sm"
            >
              <Save size={18} /> Archive to History
            </button>
          </div>
        </div>

        {/* Registrations Section */}
        <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-fire-yellow flex items-center gap-2 mb-4">
            <ClipboardList size={18} /> Registrations
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {registrations.length === 0 && <div className="text-white/20 italic text-center py-10">No registrations yet.</div>}
            {registrations.map(reg => (
              <div key={reg.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-fire-orange font-black uppercase text-sm">{reg.teamName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                      reg.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                      reg.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                      'bg-red-500/20 text-red-500'
                    }`}>
                      {reg.status}
                    </span>
                  </div>
                  <div className="text-xs text-white/60">Leader: {reg.leaderName} | Phone: {reg.phone}</div>
                  <div className="text-[10px] text-white/40 mt-1">Players: {reg.players.join(', ')}</div>
                  
                  {/* Payment Info */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase text-white/30 font-bold">Method</span>
                      <span className="text-[10px] font-black text-fire-yellow uppercase">{reg.paymentMethod || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase text-white/30 font-bold">Sender</span>
                      <span className="text-[10px] font-black text-white">{reg.senderNumber || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase text-white/30 font-bold">TrxID</span>
                      <span className="text-[10px] font-black text-white">{reg.transactionId || 'N/A'}</span>
                    </div>
                    {reg.paymentScreenshot && (
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase text-white/30 font-bold">Screenshot</span>
                        <div className="mt-1">
                          <img 
                            src={reg.paymentScreenshot} 
                            alt="Payment Screenshot" 
                            className="w-24 h-24 object-cover rounded-lg border border-white/20 cursor-pointer hover:opacity-80"
                            onClick={() => window.open(reg.paymentScreenshot, '_blank')}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {reg.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => reg.id && onUpdateRegistration(reg.id, 'approved')}
                        className="bg-green-600 hover:bg-green-500 p-2 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button 
                        onClick={() => reg.id && onUpdateRegistration(reg.id, 'rejected')}
                        className="bg-fire-red hover:bg-red-500 p-2 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircle size={18} />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => reg.id && onDeleteRegistration(reg.id)}
                    className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg transition-colors text-white/40 hover:text-fire-red"
                    title="Delete Registration"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notices Section */}
        <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-fire-yellow flex items-center gap-2 mb-4">
            <MessageSquare size={18} /> Notices
          </h3>
          <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
            <input 
              type="text" 
              placeholder="Notice Title"
              value={newNotice.title}
              onChange={e => setNewNotice({...newNotice, title: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm"
            />
            <textarea 
              placeholder="Notice Content"
              value={newNotice.content}
              onChange={e => setNewNotice({...newNotice, content: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm h-20"
            />
            <button 
              onClick={() => {
                if (newNotice.title && newNotice.content) {
                  onAddNotice(newNotice.title, newNotice.content);
                  setNewNotice({ title: '', content: '' });
                }
              }}
              className="bg-fire-orange text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              Post Notice
            </button>
          </div>
          <div className="space-y-2">
            {notices.map(notice => (
              <div key={notice.id} className="bg-white/5 border border-white/10 p-3 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">{notice.title}</div>
                  <div className="text-xs text-white/60">{notice.content}</div>
                </div>
                <button 
                  onClick={() => notice.id && onDeleteNotice(notice.id)}
                  className="text-fire-red hover:text-red-500 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* History Section */}
        <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-fire-yellow flex items-center gap-2 mb-4">
            <HistoryIcon size={18} /> History
          </h3>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-4 border-l-4 border-fire-orange pl-2">Current Leaderboard</h4>
            <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5">
              <div>
                <div className="text-xs font-bold text-white">{settings.round} | {settings.day}</div>
                <div className="text-[10px] text-white/60">{teams.length} Teams Active</div>
              </div>
              <button 
                onClick={onClearTeams}
                className="bg-fire-red/20 hover:bg-fire-red/40 text-fire-red px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-xs border border-fire-red/30"
              >
                <Trash2 size={14} /> Clear Current
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-4 border-l-4 border-fire-orange pl-2">Archived Records</h4>
            
            {tournamentHistory.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {tournamentHistory.map(record => (
                  <div key={record.id} className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5">
                    <div>
                      <div className="text-xs font-bold text-white">
                        {record.tournamentData.round} | {record.tournamentData.day}
                      </div>
                      <div className="text-[10px] text-white/60">
                        {record.date ? new Date(record.date.toDate()).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date'}
                      </div>
                    </div>
                    <button 
                      onClick={() => record.id && onDeleteHistoryRecord(record.id)}
                      className="text-fire-red hover:text-red-400 p-2 transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-white/40 text-xs italic">
                No archived history found.
              </div>
            )}

            {tournamentHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <button 
                  onClick={onClearHistory}
                  className="w-full bg-fire-red/20 hover:bg-fire-red/40 text-fire-red px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-bold border border-fire-red/30"
                >
                  <Trash2 size={16} /> Delete All Archived History
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Timer = ({ end }: { end: any }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!end) return;
    const endTime = end.toDate ? end.toDate().getTime() : new Date(end).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = endTime - now;
      setTimeLeft(Math.max(0, diff));
    }, 1000);

    return () => clearInterval(interval);
  }, [end]);

  if (!end || timeLeft === 0) return null;

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  const isDanger = timeLeft < 600000; // 10 minutes

  return (
    <motion.div 
      animate={isDanger ? { scale: [1, 1.05, 1], opacity: [1, 0.8, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
      className={`p-3 md:p-4 rounded-2xl border-2 text-center mb-4 md:mb-6 shadow-2xl ${
        isDanger 
          ? 'bg-fire-red/20 border-fire-red gold-glow animate-pulse' 
          : 'bg-black/40 border-fire-orange/30'
      }`}
    >
      <div className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isDanger ? 'text-fire-red' : 'text-fire-orange'}`}>
        {isDanger ? '⚠️ DANGER ZONE: TOURNAMENT STARTING ⚠️' : 'Tournament Countdown'}
      </div>
      <div className="flex justify-center gap-2 md:gap-3">
        <div className="flex flex-col">
          <span className="text-xl md:text-2xl font-black text-white leading-none">{hours.toString().padStart(2, '0')}</span>
          <span className="text-[6px] md:text-[7px] uppercase text-white/40 font-bold">Hrs</span>
        </div>
        <div className="text-xl md:text-2xl font-black text-white/20">:</div>
        <div className="flex flex-col">
          <span className="text-xl md:text-2xl font-black text-white leading-none">{minutes.toString().padStart(2, '0')}</span>
          <span className="text-[6px] md:text-[7px] uppercase text-white/40 font-bold">Min</span>
        </div>
        <div className="text-xl md:text-2xl font-black text-white/20">:</div>
        <div className="flex flex-col">
          <span className="text-xl md:text-2xl font-black text-white leading-none">{seconds.toString().padStart(2, '0')}</span>
          <span className="text-[6px] md:text-[7px] uppercase text-white/40 font-bold">Sec</span>
        </div>
      </div>
    </motion.div>
  );
};

const Leaderboard = ({ 
  settings, 
  teams, 
  notices,
  history,
  selectedHistoryId,
  onSelectHistory,
  setSelectedTeam,
  sortedTeams
}: { 
  settings: TournamentSettings, 
  teams: Team[], 
  notices: Notice[],
  history: HistoryRecord[],
  selectedHistoryId: string | null,
  onSelectHistory: (id: string | null) => void,
  setSelectedTeam: (team: Team | null) => void,
  sortedTeams: Team[]
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Timer */}
      {!selectedHistoryId && <Timer end={settings.timerEnd} />}

      {/* History Selector */}
      {history.length > 0 && (
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4 bg-black/20 p-3 md:p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${selectedHistoryId ? 'bg-white/20' : 'bg-green-500 animate-pulse'}`}></div>
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/60">
              {selectedHistoryId ? 'Viewing Archived Board' : 'Live Tournament Board'}
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select 
              value={selectedHistoryId || 'live'} 
              onChange={(e) => onSelectHistory(e.target.value === 'live' ? null : e.target.value)}
              className="flex-1 sm:w-64 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 md:px-3 md:py-2 text-[10px] md:text-xs text-white font-bold outline-none focus:border-fire-orange transition-all"
            >
              <option value="live">🔴 Live: {settings.round} | {settings.day}</option>
              <optgroup label="Archived Rounds">
                {history.map(record => (
                  <option key={record.id} value={record.id}>
                    📜 {record.date ? new Date(record.date.toDate()).toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown Day'}
                  </option>
                ))}
              </optgroup>
            </select>
            {selectedHistoryId && (
              <button 
                onClick={() => onSelectHistory(null)}
                className="bg-fire-orange hover:bg-fire-red text-white p-1.5 md:p-2 rounded-lg transition-all"
                title="Back to Live"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Custom ID & Password */}
      {(settings.customId || settings.customPassword) && (
        <div className="mb-6 grid grid-cols-2 gap-2 md:gap-3">
          <div className="bg-fire-orange/5 border border-fire-orange/20 p-2 md:p-3 rounded-xl text-center">
            <div className="text-[7px] md:text-[8px] uppercase text-fire-orange font-bold mb-0.5 md:mb-1">Custom ID</div>
            <div className="text-xs md:text-sm font-black text-white">{settings.customId || '---'}</div>
          </div>
          <div className="bg-fire-orange/5 border border-fire-orange/20 p-2 md:p-3 rounded-xl text-center">
            <div className="text-[7px] md:text-[8px] uppercase text-fire-orange font-bold mb-0.5 md:mb-1">Custom Password</div>
            <div className="text-xs md:text-sm font-black text-white">{settings.customPassword || '---'}</div>
          </div>
        </div>
      )}

      {/* Notices */}
      {notices.length > 0 && (
        <div className="mb-6 space-y-2">
          {notices.map(notice => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={notice.id} 
              className="bg-fire-orange/10 border-l-4 border-fire-orange p-3 rounded-r-xl"
            >
              <div className="text-xs font-black text-fire-orange uppercase tracking-wider">{notice.title}</div>
              <div className="text-sm text-white/80">{notice.content}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Live Stream */}
      {settings.youtubeUrl && (
        <div className="mb-8 aspect-video w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <iframe 
            width="100%" 
            height="100%" 
            src={settings.youtubeUrl} 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Header */}
      <div className="relative mb-6 text-center flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-fire-red rounded-lg flex items-center justify-center border border-fire-orange/50 shadow-lg shadow-fire-red/40">
            <Trophy className="text-fire-yellow" size={14} />
          </div>
          <div className="text-left">
            <div className="text-[7px] md:text-[8px] uppercase tracking-widest text-fire-orange font-bold leading-none">FFSC</div>
            <div className="text-[8px] md:text-[10px] font-black text-white leading-none">TOURNAMENT</div>
          </div>
        </div>

        <h2 className="text-lg md:text-2xl font-black text-fire-yellow italic tracking-tighter fire-glow uppercase mx-auto">
          Overall Standings
        </h2>

        <div className="mt-2 flex gap-4 text-center">
          <div className="text-[8px] md:text-[10px] font-bold text-white/60 uppercase">{settings.round} | {settings.day}</div>
          <div className="text-[8px] md:text-[10px] font-black text-fire-orange uppercase">Limit: {settings.rankingLimit}</div>
        </div>
      </div>

      {/* Notice Bar */}
      {settings.notice && (
        <div className="w-full bg-fire-red/20 border-y border-fire-orange/30 py-1.5 mb-6 overflow-hidden">
          <div className="scrolling-text text-fire-yellow font-bold uppercase tracking-wider text-xs">
            {settings.notice} • {settings.notice} • {settings.notice}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-fire-red/40 border-b-2 border-fire-orange">
              <th className="p-1.5 md:p-2 text-left text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic">Rank</th>
              <th className="p-1.5 md:p-2 text-left text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic">Team</th>
              <th className="p-1.5 md:p-2 text-center text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic">Matches</th>
              <th className="p-1.5 md:p-2 text-center text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic">Booyah</th>
              <th className="p-1.5 md:p-2 text-center text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic">Kill Pts</th>
              <th className="p-1.5 md:p-2 text-center text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic">Pos. Pts</th>
              <th className="p-1.5 md:p-2 text-center text-[8px] md:text-[10px] font-black uppercase text-fire-yellow italic bg-fire-orange/20">Total Pts</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {sortedTeams.map((team, index) => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                  key={team.id} 
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === 0 ? 'gold-glow bg-fire-orange/10' : index < 3 ? 'bg-fire-orange/5' : ''}`}
                >
                  <td className="p-1.5 md:p-2">
                    <div className={`w-5 h-5 md:w-7 md:h-7 rounded flex items-center justify-center font-black italic text-xs md:text-sm ${
                      index === 0 ? 'bg-fire-yellow text-black' : 
                      index === 1 ? 'bg-slate-300 text-black' : 
                      index === 2 ? 'bg-amber-700 text-white' : 
                      'text-white/60'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className={`p-1.5 md:p-2 ${team.isWinner ? 'gold-glow' : ''}`}>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className={`w-6 h-6 md:w-8 md:h-8 bg-black/40 rounded border flex items-center justify-center overflow-hidden shrink-0 ${team.isWinner ? 'border-fire-yellow' : 'border-white/10'}`}>
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon size={12} className="text-white/20" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className={`font-bold text-xs md:text-sm uppercase tracking-tight truncate max-w-[120px] sm:max-w-none ${team.isWinner ? 'text-fire-yellow' : 'text-white'}`}>
                          {team.name}
                        </div>
                        {team.isWinner && (
                          <span className="text-[6px] md:text-[8px] font-black text-fire-yellow uppercase tracking-widest flex items-center gap-0.5 md:gap-1">
                            <Trophy size={6} /> CHAMPION
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-1.5 md:p-2 text-center font-bold text-white/80 text-[10px] md:text-xs">{team.matches}</td>
                  <td className="p-1.5 md:p-2 text-center font-bold text-white/80 text-[10px] md:text-xs">{team.booyah}</td>
                  <td className="p-1.5 md:p-2 text-center font-bold text-white/80 text-[10px] md:text-xs">{team.killPoints}</td>
                  <td className="p-1.5 md:p-2 text-center font-bold text-white/80 text-[10px] md:text-xs">{team.positionPoints}</td>
                  <td className="p-1.5 md:p-2 text-center font-black text-sm md:text-base text-fire-orange bg-fire-orange/5">{team.totalPoints}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Participating Teams List (Everyone can see) */}
      <div className="mt-10 space-y-3">
        <h3 className="text-base md:text-lg font-black text-white uppercase italic border-l-4 border-fire-orange pl-3">Participating Teams</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
          {sortedTeams.map((team, idx) => (
            <div key={team.id} onClick={() => setSelectedTeam(team)} className="bg-zinc-900/50 border border-white/5 p-2 md:p-3 rounded-xl flex items-center gap-2 md:gap-3 hover:bg-zinc-800/50 transition-all cursor-pointer">
              <div className={`w-8 h-8 md:w-10 md:h-10 bg-black/40 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 ${team.isWinner ? 'border-fire-yellow gold-glow' : 'border-white/10'}`}>
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon size={14} className="text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[7px] md:text-[8px] font-black text-fire-orange uppercase tracking-tighter">Team #{idx + 1}</div>
                <div className={`text-[10px] md:text-xs font-bold truncate uppercase ${team.isWinner ? 'text-fire-yellow' : 'text-white'}`}>
                  {team.name}
                </div>
                <div className="text-[8px] md:text-[9px] text-white/40 font-bold uppercase truncate">
                  {team.leaderName || 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RegistrationForm = ({ user, onLogin, settings }: { user: User | null, onLogin: () => void, settings: TournamentSettings }) => {
  const [formData, setFormData] = useState({
    teamName: '',
    leaderName: '',
    phone: '',
    email: '',
    players: ['', '', '', ''],
    paymentMethod: 'bkash' as 'bkash' | 'nagad',
    transactionId: '',
    paymentScreenshot: '',
    senderNumber: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleScreenshotUpload = async (file: File) => {
    try {
      const compressedImage = await compressImage(file, 600, 800, 0.7);
      setFormData({ ...formData, paymentScreenshot: compressedImage });
    } catch (error) {
      console.error('Error compressing screenshot:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!user) {
      onLogin();
      return;
    }
    if (!formData.transactionId || !formData.paymentScreenshot || !formData.senderNumber) {
      setErrorMsg("Please provide Sender Number, Transaction ID and Payment Screenshot.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'registrations'), {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp(),
        userUid: user.uid,
        userEmail: user.email
      });
      setSuccess(true);
    } catch (error) {
      console.error("Registration failed", error);
      setErrorMsg("Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto bg-black/40 p-8 rounded-2xl border border-fire-orange/20 text-center space-y-4">
        <div className="w-16 h-16 bg-fire-orange/20 rounded-full flex items-center justify-center mx-auto border border-fire-orange/50">
          <LogIn size={32} className="text-fire-orange" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white uppercase italic">Login Required</h3>
          <p className="text-xs text-white/60">রেজিস্ট্রেশন করতে আপনার গুগল অ্যাকাউন্ট দিয়ে লগ ইন করুন।</p>
        </div>
        <button 
          onClick={onLogin}
          className="bg-fire-orange hover:bg-fire-red text-white px-6 py-2.5 rounded-xl font-black uppercase italic tracking-widest transition-all shadow-lg shadow-fire-orange/40 flex items-center gap-2 mx-auto text-sm"
        >
          <ImageIcon size={18} /> Continue with Google
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto bg-green-500/10 border border-green-500/30 p-8 rounded-2xl text-center">
        <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-white mb-1">Registration Successful!</h3>
        <p className="text-xs text-white/60">আপনার রেজিস্ট্রেশন সফল হয়েছে। অ্যাডমিন এটি যাচাই করে অ্যাপ্রুভ করবেন।</p>
        <button 
          onClick={() => setSuccess(false)}
          className="mt-4 bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg font-bold transition-all text-sm"
        >
          Register Another Team
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-black/40 p-5 rounded-2xl border border-fire-orange/20 shadow-2xl">
      <h2 className="text-xl font-black text-fire-yellow italic uppercase mb-5 flex items-center gap-2">
        <ClipboardList size={24} /> Tournament Registration
      </h2>
      
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-xs font-bold flex items-center gap-2">
          <XCircle size={16} />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase text-white/50 mb-1">Team Name *</label>
            <input 
              required
              type="text" 
              value={formData.teamName}
              onChange={e => setFormData({...formData, teamName: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:border-fire-orange outline-none"
              placeholder="টিমের নাম"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-white/50 mb-1">Leader Name *</label>
            <input 
              required
              type="text" 
              value={formData.leaderName}
              onChange={e => setFormData({...formData, leaderName: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:border-fire-orange outline-none"
              placeholder="লিডারের নাম"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase text-white/50 mb-1">Phone Number *</label>
            <input 
              required
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:border-fire-orange outline-none"
              placeholder="017XXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-white/50 mb-1">Email (Optional)</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:border-fire-orange outline-none"
              placeholder="example@mail.com"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-white/50 mb-2">Players List (UID/Name)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {formData.players.map((p, i) => (
              <input 
                key={i}
                type="text" 
                value={p}
                onChange={e => {
                  const newPlayers = [...formData.players];
                  newPlayers[i] = e.target.value;
                  setFormData({...formData, players: newPlayers});
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-xs focus:border-fire-orange outline-none"
                placeholder={`Player ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Payment Section */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fire-orange uppercase">Payment Details</h3>
            <div className="text-[10px] font-black text-white/40 uppercase">Fee: {settings.registrationFee || 'N/A'}</div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onClick={() => setFormData({...formData, paymentMethod: 'bkash'})}
              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${formData.paymentMethod === 'bkash' ? 'bg-pink-600/20 border-pink-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
            >
              <span className="text-xs font-bold">bKash</span>
              <span className="text-[8px] opacity-60">{settings.bkashNumber || 'Not Set'}</span>
            </button>
            <button 
              type="button"
              onClick={() => setFormData({...formData, paymentMethod: 'nagad'})}
              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${formData.paymentMethod === 'nagad' ? 'bg-orange-600/20 border-orange-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
            >
              <span className="text-xs font-bold">Nagad</span>
              <span className="text-[8px] opacity-60">{settings.nagadNumber || 'Not Set'}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase text-white/50 mb-1">Sender Number *</label>
              <input 
                required
                type="text" 
                value={formData.senderNumber}
                onChange={e => setFormData({...formData, senderNumber: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:border-fire-orange outline-none"
                placeholder="যে নম্বর থেকে টাকা পাঠিয়েছেন"
              />
              <p className="text-[8px] text-white/40 mt-1">
                যদি বিকাশ এর দোকান থেকে পাঠানো হয় টাকা তাহলে যে নম্বর থেকে পাঠানো হয়েছে সেই নম্বর আর শেষের ৩ নম্বর দাও
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">Transaction ID *</label>
                <input 
                  required
                  type="text" 
                  value={formData.transactionId}
                  onChange={e => setFormData({...formData, transactionId: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:border-fire-orange outline-none"
                  placeholder="Enter TrxID"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">Payment Screenshot *</label>
                <div className="relative h-[38px] bg-white/5 border border-dashed border-white/20 rounded-lg flex items-center justify-center gap-2 overflow-hidden hover:border-fire-orange transition-colors">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  {formData.paymentScreenshot ? (
                    <div className="flex items-center gap-2 px-2 w-full">
                      <CheckCircle size={14} className="text-green-500" />
                      <span className="text-[10px] text-white/60 truncate">Uploaded</span>
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={14} className="text-white/20" />
                      <span className="text-[10px] text-white/40 uppercase font-bold">Upload</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          disabled={submitting}
          type="submit"
          className="w-full bg-fire-orange hover:bg-fire-red text-white py-2.5 rounded-xl font-black uppercase italic tracking-widest transition-all shadow-lg shadow-fire-orange/20 disabled:opacity-50 text-sm"
        >
          {submitting ? 'Submitting...' : 'Submit Registration'}
        </button>
      </form>
    </div>
  );
};

const ContactSection = () => {
  return (
    <div className="max-w-4xl mx-auto text-center space-y-8 py-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-fire-yellow italic uppercase">Contact Admin</h2>
        <p className="text-xs text-white/60">আপনার কোনো প্রশ্ন থাকলে বা সাহায্যের প্রয়োজন হলে সরাসরি অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
      </div>
      
      <div className="space-y-8">
        {/* Admin 1 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-black text-white uppercase mb-4 text-left border-l-4 border-fire-orange pl-3">Admin 1</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a 
              href="https://wa.me/8801403250736" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-green-600/10 border border-green-600/30 p-6 rounded-2xl hover:bg-green-600/20 transition-all flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/40 group-hover:scale-110 transition-transform">
                <Phone size={24} className="text-white" />
              </div>
              <div>
                <div className="text-green-500 font-bold uppercase text-[10px]">WhatsApp</div>
                <div className="text-lg font-black text-white">01403250736</div>
              </div>
            </a>

            <a 
              href="https://www.facebook.com/sa.asif.on.fire" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-blue-600/10 border border-blue-600/30 p-6 rounded-2xl hover:bg-blue-600/20 transition-all flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 group-hover:scale-110 transition-transform">
                <Facebook size={24} className="text-white" />
              </div>
              <div>
                <div className="text-blue-400 font-bold uppercase text-[10px]">Facebook</div>
                <div className="text-lg font-black text-white">Admin Profile</div>
              </div>
            </a>
          </div>
        </div>

        {/* Admin 2 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-black text-white uppercase mb-4 text-left border-l-4 border-fire-orange pl-3">Admin 2</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a 
              href="https://wa.me/8801346669831" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-green-600/10 border border-green-600/30 p-6 rounded-2xl hover:bg-green-600/20 transition-all flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/40 group-hover:scale-110 transition-transform">
                <Phone size={24} className="text-white" />
              </div>
              <div>
                <div className="text-green-500 font-bold uppercase text-[10px]">WhatsApp</div>
                <div className="text-lg font-black text-white">+880 1346-669831</div>
              </div>
            </a>

            <a 
              href="https://www.facebook.com/nahid.afran.486392" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-blue-600/10 border border-blue-600/30 p-6 rounded-2xl hover:bg-blue-600/20 transition-all flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 group-hover:scale-110 transition-transform">
                <Facebook size={24} className="text-white" />
              </div>
              <div>
                <div className="text-blue-400 font-bold uppercase text-[10px]">Facebook</div>
                <div className="text-lg font-black text-white">Admin Profile</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      <div className="bg-fire-red/10 border border-fire-red/30 p-4 rounded-xl flex items-center gap-3 text-left">
        <AlertCircle className="text-fire-red shrink-0" size={20} />
        <p className="text-[10px] text-white/80">
          <span className="font-bold text-fire-red block mb-0.5">Pro Tip:</span>
          রেজিস্ট্রেশন করার পর আপনার পেমেন্ট স্ক্রিনশট নিয়ে হোয়াটসঅ্যাপে মেসেজ দিন দ্রুত অ্যাপ্রুভাল পাওয়ার জন্য।
        </p>
      </div>
    </div>
  );
};

const HistoryView = ({ records, onViewBoard, onEditHistory }: { records: HistoryRecord[], onViewBoard: (id: string) => void, onEditHistory: (record: HistoryRecord) => void }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-black text-fire-yellow italic uppercase flex items-center gap-2">
        <HistoryIcon size={24} /> Tournament History
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {records.map((record) => (
          <div key={record.id} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:border-fire-orange/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase leading-tight">
                    {record.date ? new Date(record.date.toDate()).toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown Day'}
                  </h3>
                </div>
                <div className="bg-fire-red/20 px-2 py-0.5 rounded text-[10px] font-bold text-fire-yellow">
                  {(record.teams || []).length} TEAMS
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                {(record.teams || []).slice(0, 3).map((team, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/60">#{i + 1} {team.name}</span>
                    <span className="font-bold text-fire-orange">{team.totalPoints} PTS</span>
                  </div>
                ))}
                {(record.teams || []).length > 3 && (
                  <div className="text-[10px] text-white/30 italic">+{(record.teams || []).length - 3} more teams...</div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => record.id && onViewBoard(record.id)}
                className="flex-1 bg-white/5 hover:bg-fire-orange text-white py-2 rounded-lg text-[10px] font-black uppercase italic tracking-widest transition-all border border-white/10 hover:border-fire-orange"
              >
                View
              </button>
              <button 
                onClick={() => onEditHistory(record)}
                className="flex-1 bg-white/5 hover:bg-blue-600 text-white py-2 rounded-lg text-[10px] font-black uppercase italic tracking-widest transition-all border border-white/10 hover:border-blue-600"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="col-span-full py-20 text-center text-white/20 italic">
            No historical records found.
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'admin' | 'history' | 'registration' | 'contact'>('home');
  const [settings, setSettings] = useState<TournamentSettings>({
    round: 'Round 1',
    day: 'Day 1',
    rankingLimit: '1-20',
    notice: 'Welcome to FFSC TOURNAMENT!',
    updatedAt: null
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentHistory, setTournamentHistory] = useState<HistoryRecord[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<'settings' | 'teams' | 'registrations' | 'notices'>('settings');
  const [isCloning, setIsCloning] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const sortedTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints || b.booyah - a.booyah);

  const ADMIN_EMAILS = ["nirjonnahuel520@gmail.com", "admin2@gmail.com", "nahidxfire20@gmail.com"]; // Add more admin emails here

  // Helper to get sanitized teams path
  const getTeamsPath = (round: string, day: string) => {
    const slug = `${round}_${day}`.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'default';
    return `tournaments/current/rounds/${slug}/teams`;
  };

  const teamsPath = getTeamsPath(settings.round, settings.day);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'tournaments', 'current'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Listen to Settings
    const unsubSettings = onSnapshot(doc(db, 'tournaments', 'current'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as TournamentSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tournaments/current'));

    // Listen to History
    const unsubHistory = onSnapshot(query(collection(db, 'history'), orderBy('date', 'desc')), (snapshot) => {
      const historyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryRecord));
      setTournamentHistory(historyList);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'history'));

    // Listen to Notices
    const unsubNotices = onSnapshot(query(collection(db, 'notices'), orderBy('createdAt', 'desc')), (snapshot) => {
      const noticeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice));
      setNotices(noticeList);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'notices'));

    return () => {
      clearTimeout(timer);
      unsubAuth();
      unsubSettings();
      unsubHistory();
      unsubNotices();
    };
  }, []);

  // Separate effect for Teams to handle dynamic path
  useEffect(() => {
    const unsubTeams = onSnapshot(query(collection(db, teamsPath), orderBy('order', 'asc')), (snapshot) => {
      const teamList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamList);
    }, (error) => handleFirestoreError(error, OperationType.GET, teamsPath));

    return () => unsubTeams();
  }, [teamsPath]);

  // Separate effect for Registrations
  useEffect(() => {
    if (!user) {
      setRegistrations([]);
      return;
    }
    const unsubRegistrations = onSnapshot(query(collection(db, 'registrations'), orderBy('createdAt', 'desc')), (snapshot) => {
      const regList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
      setRegistrations(regList);
    }, (error) => console.warn("Registrations access restricted to admins"));

    return () => unsubRegistrations();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setActiveTab('home');
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const updateSettings = async (newSettings: Partial<TournamentSettings>) => {
    try {
      const path = 'tournaments/current';
      await setDoc(doc(db, path), {
        ...settings,
        ...newSettings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tournaments/current');
    }
  };

  const addTeam = async () => {
    try {
      await addDoc(collection(db, teamsPath), {
        name: 'New Team',
        logoUrl: '',
        matches: 0,
        booyah: 0,
        killPoints: 0,
        m1Points: 0,
        m2Points: 0,
        m3Points: 0,
        m4Points: 0,
        m5Points: 0,
        m6Points: 0,
        positionPoints: 0,
        totalPoints: 0,
        order: teams.length,
        position: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, teamsPath);
    }
  };

  const updateTeam = async (id: string, updates: Partial<Team>) => {
    try {
      const team = teams.find(t => t.id === id);
      if (!team) return;

      const updatedTeam = { ...team, ...updates };
      
      // Calculate Position Points from match points
      const m1 = updatedTeam.m1Points || 0;
      const m2 = updatedTeam.m2Points || 0;
      const m3 = updatedTeam.m3Points || 0;
      const m4 = updatedTeam.m4Points || 0;
      const m5 = updatedTeam.m5Points || 0;
      const m6 = updatedTeam.m6Points || 0;
      updatedTeam.positionPoints = m1 + m2 + m3 + m4 + m5 + m6;
      
      updatedTeam.totalPoints = (updatedTeam.killPoints || 0) + (updatedTeam.positionPoints || 0);

      await updateDoc(doc(db, teamsPath, id), {
        ...updates,
        positionPoints: updatedTeam.positionPoints,
        totalPoints: updatedTeam.totalPoints
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${teamsPath}/${id}`);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await deleteDoc(doc(db, teamsPath, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${teamsPath}/${id}`);
    }
  };

  const clearAllTeams = async () => {
    try {
      const batch = writeBatch(db);
      teams.forEach(team => {
        if (team.id) {
          batch.delete(doc(db, teamsPath, team.id));
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, teamsPath);
    }
  };

  const cloneTeamsFromHistory = async (historyId: string) => {
    const record = tournamentHistory.find(h => h.id === historyId);
    if (!record || !record.teams) return;
    
    setIsCloning(true);
    try {
      const batch = writeBatch(db);
      record.teams.forEach((team, index) => {
        const newTeamRef = doc(collection(db, teamsPath));
        batch.set(newTeamRef, {
          name: team.name,
          logoUrl: team.logoUrl || '',
          leaderName: team.leaderName || '',
          matches: 0,
          booyah: 0,
          killPoints: 0,
          m1Points: 0,
          m2Points: 0,
          m3Points: 0,
          m4Points: 0,
          m5Points: 0,
          m6Points: 0,
          positionPoints: 0,
          totalPoints: 0,
          order: index,
          isWinner: false,
          position: 0
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, teamsPath);
    } finally {
      setIsCloning(false);
    }
  };

  const updateRegistrationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'registrations', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `registrations/${id}`);
    }
  };

  const deleteRegistration = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registrations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `registrations/${id}`);
    }
  };

  const addNotice = async (title: string, content: string) => {
    try {
      await addDoc(collection(db, 'notices'), {
        title,
        content,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notices');
    }
  };

  const deleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notices/${id}`);
    }
  };

  const saveToHistory = async () => {
    if (teams.length === 0) return;
    try {
      const path = 'history';
      await addDoc(collection(db, path), {
        date: serverTimestamp(),
        tournamentData: settings,
        teams: [...teams].sort((a, b) => b.totalPoints - a.totalPoints)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'history');
    }
  };

  const clearAllHistory = async () => {
    try {
      const batch = writeBatch(db);
      tournamentHistory.forEach(record => {
        if (record.id) {
          batch.delete(doc(db, 'history', record.id));
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'history');
    }
  };

  const deleteHistoryRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `history/${id}`);
    }
  };

  const editHistory = (record: HistoryRecord) => {
    setTeams(record.teams);
    setSettings(record.tournamentData);
    setActiveTab('home');
  };

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);
  const userRegistration = registrations.find(r => r.userUid === user?.uid);
  const isApproved = userRegistration?.status === 'approved';

  if (loading) {
    return (
      <div className="min-h-screen bg-fire-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-fire-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-fire-yellow font-black italic uppercase tracking-widest">Loading Battleground...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen pb-20">
        {/* Navigation */}
        <nav className="bg-black/60 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-2 md:px-4 h-14 md:h-16 flex items-center justify-between">
            <div className="flex items-center gap-1.5 md:gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
              <Trophy className="text-fire-orange w-5 h-5 md:w-6 md:h-6" />
              <span className="font-black italic text-sm md:text-xl tracking-tighter">FFSC TOURNAMENT</span>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setActiveTab('home')}
                className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-colors shrink-0 ${activeTab === 'home' ? 'bg-fire-orange text-white' : 'text-white/60 hover:text-white'}`}
              >
                Leaderboard
              </button>
              <button 
                onClick={() => setActiveTab('registration')}
                className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-colors shrink-0 ${activeTab === 'registration' ? 'bg-fire-orange text-white' : 'text-white/60 hover:text-white'}`}
              >
                Register
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-colors shrink-0 ${activeTab === 'history' ? 'bg-fire-orange text-white' : 'text-white/60 hover:text-white'}`}
              >
                History
              </button>
              <button 
                onClick={() => setActiveTab('contact')}
                className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-colors shrink-0 ${activeTab === 'contact' ? 'bg-fire-orange text-white' : 'text-white/60 hover:text-white'}`}
              >
                Contact
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-colors shrink-0 ${activeTab === 'admin' ? 'bg-fire-red text-white' : 'text-fire-red/60 hover:text-fire-red'}`}
                >
                  Admin
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'home' && (
              <Leaderboard 
                settings={selectedHistoryId ? (tournamentHistory.find(h => h.id === selectedHistoryId)?.tournamentData || settings) : settings} 
                teams={selectedHistoryId ? (tournamentHistory.find(h => h.id === selectedHistoryId)?.teams || []) : teams} 
                sortedTeams={selectedHistoryId ? ([...(tournamentHistory.find(h => h.id === selectedHistoryId)?.teams || [])].sort((a, b) => b.totalPoints - a.totalPoints || b.booyah - a.booyah)) : sortedTeams}
                notices={notices}
                history={tournamentHistory}
                selectedHistoryId={selectedHistoryId}
                onSelectHistory={setSelectedHistoryId}
                setSelectedTeam={setSelectedTeam}
              />
            )}
            {activeTab === 'registration' && <RegistrationForm user={user} onLogin={handleLogin} settings={settings} />}
            {activeTab === 'contact' && <ContactSection />}
            {activeTab === 'admin' && isAdmin && (
              <AdminPanel 
                settings={settings} 
                teams={teams}
                registrations={registrations}
                notices={notices}
                tournamentHistory={tournamentHistory}
                isCloning={isCloning}
                onUpdateSettings={updateSettings}
                onAddTeam={addTeam}
                onUpdateTeam={updateTeam}
                onDeleteTeam={deleteTeam}
                onClearTeams={clearAllTeams}
                onSaveHistory={saveToHistory}
                onClearHistory={clearAllHistory}
                onDeleteHistoryRecord={deleteHistoryRecord}
                onUpdateRegistration={updateRegistrationStatus}
                onDeleteRegistration={deleteRegistration}
                onAddNotice={addNotice}
                onDeleteNotice={deleteNotice}
                onCloneTeams={cloneTeamsFromHistory}
              />
            )}
            {activeTab === 'history' && (
              <HistoryView 
                records={tournamentHistory} 
                onViewBoard={(id) => {
                  setSelectedHistoryId(id);
                  setActiveTab('home');
                }} 
                onEditHistory={editHistory}
              />
            )}
          </motion.div>
        </main>

        {/* Footer Branding */}
        <footer className="fixed bottom-0 left-0 w-full bg-transparent border-t border-white/5 py-3 px-6 flex justify-between items-center z-40">
          <div className="flex items-center gap-4">
            <UserMenu user={user} onLogin={handleLogin} onLogout={handleLogout} />
            <div className="flex items-center gap-2 opacity-50 hidden sm:flex">
              <div className="w-6 h-6 bg-fire-red rounded flex items-center justify-center">
                <Trophy size={12} className="text-fire-yellow" />
              </div>
              <span className="text-[10px] font-black italic uppercase tracking-widest">FF SLOTE CHAMPIONSHIP</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <AnimatePresence>
              {isApproved && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-1.5 text-green-500"
                >
                  <CheckCircle size={10} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Registration Successful</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="text-[10px] text-white/20 uppercase font-bold">
              {settings.footerText || '© SA ASIF'}
            </div>
          </div>
        </footer>
      </div>
      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedTeam(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 bg-black/40 rounded-xl border flex items-center justify-center overflow-hidden ${selectedTeam.isWinner ? 'border-fire-yellow' : 'border-white/10'}`}>
                {selectedTeam.logoUrl ? (
                  <img src={selectedTeam.logoUrl} alt={selectedTeam.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon size={32} className="text-white/20" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase">{selectedTeam.name}</h3>
                <p className="text-xs text-fire-orange font-bold uppercase">Team Leader: {selectedTeam.leaderName || 'N/A'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] uppercase text-white/40 font-bold">Game Time</div>
                <div className="text-lg font-black text-white">{selectedTeam.gameTime || 'N/A'}</div>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] uppercase text-white/40 font-bold">Position</div>
                <div className="text-lg font-black text-fire-yellow">{selectedTeam.position || 'N/A'}</div>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] uppercase text-white/40 font-bold">Position Points</div>
                <div className="text-lg font-black text-fire-yellow">#{sortedTeams.findIndex(t => t.id === selectedTeam.id) + 1}</div>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] uppercase text-white/40 font-bold">Total Pts</div>
                <div className="text-lg font-black text-fire-orange">{selectedTeam.totalPoints}</div>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] uppercase text-white/40 font-bold">Booyah</div>
                <div className="text-lg font-black text-white">{selectedTeam.booyah}</div>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedTeam(null)}
              className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl font-bold text-sm transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </ErrorBoundary>
  );
}
