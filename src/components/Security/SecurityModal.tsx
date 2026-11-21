import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Key, AlertCircle, Copy, Check, ShieldCheck, X, Shield, Info } from 'lucide-react';
import { useSecurity } from '../../contexts/SecurityContext';
import { generateMasterKey } from '../../lib/utils/crypto';

interface SecurityModalProps {
  isOpen: boolean;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen }) => {
  const { isSetup, unlock, setupSecurity, resetSecurity, setModalOpen, modalContext } = useSecurity();
  const [mode, setMode] = useState<'setup' | 'unlock' | 'recover'>(isSetup ? 'unlock' : 'setup');
  
  // Check if this is a "protect" context (user clicked Protect on an unprotected note)
  const isProtectContext = modalContext === 'protect' && mode === 'unlock';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatedMasterKey, setGeneratedMasterKey] = useState('');

  useEffect(() => {
    if (isSetup && mode === 'setup') {
      setMode('unlock');
    }
  }, [isSetup, mode]);

  if (!isOpen) return null;

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    
    const mk = generatedMasterKey || generateMasterKey();
    if (!generatedMasterKey) {
        setGeneratedMasterKey(mk);
        return; // Wait for user to copy master key
    }

    await setupSecurity(password, mk);
    setModalOpen(false);
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await unlock(password);
    if (!success) {
      setError('Incorrect password');
    } else {
      setModalOpen(false);
      setPassword('');
      setError('');
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await resetSecurity(masterKey, password);
    if (!success) {
      setError('Invalid Master Key');
    } else {
      setModalOpen(true); // Ensure modal stays open for reward/confirm? No, just keep flow
      setMasterKey('');
      setPassword('');
      setMode('unlock');
      setError('');
    }
  };

  const copyMasterKey = () => {
    navigator.clipboard.writeText(generatedMasterKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-panel w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-accent-primary p-6 text-white flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            {mode === 'setup' ? <ShieldCheck className="w-6 h-6" /> : isProtectContext ? <Shield className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {mode === 'setup' ? 'Security Setup' : mode === 'recover' ? 'Account Recovery' : isProtectContext ? 'Enable Protection' : 'App Locked'}
            </h2>
            <p className="text-white/80 text-sm">
              {mode === 'setup' ? 'Protect your notes with encryption' : isProtectContext ? 'Enter password to start protecting notes' : 'Enter your password to continue'}
            </p>
          </div>
          <button 
            onClick={() => setModalOpen(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg flex items-center space-x-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              {!generatedMasterKey ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">Set Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-bg-app border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                      placeholder="Minimum 4 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-bg-app border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                      placeholder="Repeat password"
                    />
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div className="flex-1">
                        <p className="font-bold mb-1">Important:</p>
                        <p className="text-xs opacity-90 leading-relaxed">
                            Protection encrypts your notes with this password. If you lose your password AND your Master Key, your data cannot be recovered. 
                        </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2 text-orange-600 font-semibold text-sm">
                    <Key className="w-4 h-4" />
                    <span>Master Recovery Key</span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Save this key in a secure location. You will need it if you forget your password.
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 bg-white/50 dark:bg-black/20 p-2 rounded text-[10px] break-all border border-border">
                      {generatedMasterKey}
                    </code>
                    <button
                      type="button"
                      onClick={copyMasterKey}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-text-secondary" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {generatedMasterKey && (
                  <button
                    type="button"
                    onClick={() => setGeneratedMasterKey('')}
                    className="flex-1 bg-bg-element hover:bg-bg-panel-hover text-text-primary py-3 rounded-xl font-bold border border-border transition-all"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-[2] bg-accent-primary hover:bg-accent-primary-hover text-white py-3 rounded-xl font-bold shadow-lg shadow-accent-primary/20 transition-all"
                >
                  {generatedMasterKey ? 'Complete Setup' : 'Generate Security Keys'}
                </button>
              </div>
            </form>
          )}

          {mode === 'unlock' && (
            <form onSubmit={handleUnlock} className="space-y-4">
              {/* Contextual info for protection flow */}
              {isProtectContext && (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start space-x-2">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold mb-1">One-time session unlock</p>
                    <p className="text-xs opacity-90 leading-relaxed">
                      Enter your password once to enable note protection for this session. 
                      After unlocking, you can protect any note instantly without being asked again — until you refresh or restart the app.
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Password</label>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-bg-app border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                  placeholder={isProtectContext ? 'Enter password to enable protection' : 'Enter password to unlock'}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-accent-primary hover:bg-accent-primary-hover text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-accent-primary/20 transition-all"
              >
                {isProtectContext ? <Shield className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{isProtectContext ? 'Protect' : 'Unlock Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('recover'); setError(''); }}
                className="w-full text-text-muted hover:text-text-primary text-sm transition-colors pt-2"
              >
                Forgot password? Use Master Key
              </button>
            </form>
          )}

          {mode === 'recover' && (
            <form onSubmit={handleRecover} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Master Key</label>
                <input
                  type="text"
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  className="w-full bg-bg-app border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                  placeholder="Paste your Master Recovery Key"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-bg-app border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                  placeholder="Enter new password"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all"
              >
                Reset Password & Unlock
              </button>
              <button
                type="button"
                onClick={() => { setMode('unlock'); setError(''); }}
                className="w-full text-text-muted hover:text-text-primary text-sm transition-colors pt-2"
              >
                Back to Unlock Screen
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
