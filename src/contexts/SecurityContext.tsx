import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, SecuritySettings } from '../lib/storage/db';
import { deriveKey, hashForValidation, generateSalt } from '../lib/utils/crypto';

export type ModalContext = 'unlock' | 'protect' | 'setup';

interface SecurityContextType {
  isSetup: boolean;
  isGloballyLocked: boolean;
  sessionKey: CryptoKey | null;
  settings: SecuritySettings | null;
  isModalOpen: boolean;
  modalContext: ModalContext;
  setModalOpen: (open: boolean) => void;
  openModalForProtection: (onSuccess?: () => void) => void;
  lock: () => void;
  unlock: (password: string) => Promise<boolean>;
  setupSecurity: (password: string, masterKey: string) => Promise<void>;
  resetSecurity: (masterKey: string, newPassword: string) => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [isGloballyLocked, setIsGloballyLocked] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<ModalContext>('unlock');
  const [onUnlockSuccess, setOnUnlockSuccess] = useState<(() => void) | null>(null);

  const loadSettings = useCallback(async () => {
    const s = await db.settings.get('current');
    if (s) {
      setSettings(s);
    } else {
      setSettings({ id: 'current', isSetup: false });
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const lock = () => {
    setSessionKey(null);
    setIsGloballyLocked(true);
  };

  const unlock = async (password: string): Promise<boolean> => {
    if (!settings || !settings.hashedPassword || !settings.salt) return false;

    const saltBytes = new Uint8Array(
      settings.salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    const hash = await hashForValidation(password, saltBytes);
    if (hash === settings.hashedPassword) {
      const key = await deriveKey(password, saltBytes);
      setSessionKey(key);
      setIsGloballyLocked(false);
      
      // Call success callback if in protect context
      if (modalContext === 'protect' && onUnlockSuccess) {
        // Use setTimeout to ensure state is updated before callback runs
        setTimeout(() => {
          onUnlockSuccess();
          setOnUnlockSuccess(null);
        }, 0);
      }
      
      return true;
    }
    return false;
  };

  const setupSecurity = async (password: string, masterKey: string) => {
    const salt = generateSalt();
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashedPassword = await hashForValidation(password, salt);
    const hashedMasterKey = await hashForValidation(masterKey, salt);

    const newSettings: SecuritySettings = {
      id: 'current',
      isSetup: true,
      hashedPassword,
      hashedMasterKey,
      salt: saltHex
    };

    await db.settings.put(newSettings);
    setSettings(newSettings);
    
    // Auto-unlock after setup
    const key = await deriveKey(password, salt);
    setSessionKey(key);
    setIsGloballyLocked(false);

    // Call success callback if in protect context
    if (modalContext === 'protect' && onUnlockSuccess) {
      setTimeout(() => {
        onUnlockSuccess();
        setOnUnlockSuccess(null);
      }, 0);
    }
  };

  const resetSecurity = async (masterKey: string, newPassword: string): Promise<boolean> => {
    if (!settings || !settings.hashedMasterKey || !settings.salt) return false;

    const saltBytes = new Uint8Array(
      settings.salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    const hash = await hashForValidation(masterKey, saltBytes);
    if (hash === settings.hashedMasterKey) {
      await setupSecurity(newPassword, masterKey);
      return true;
    }
    return false;
  };

  const openModalForProtection = (onSuccess?: () => void) => {
    setModalContext('protect');
    if (onSuccess) {
      setOnUnlockSuccess(() => onSuccess);
    }
    setIsModalOpen(true);
  };

  return (
    <SecurityContext.Provider
      value={{
        isSetup: settings?.isSetup ?? false,
        isGloballyLocked,
        sessionKey,
        settings,
        isModalOpen,
        modalContext,
        setModalOpen: (open: boolean) => {
          if (open && modalContext !== 'protect') {
            setModalContext('unlock');
          }
          setIsModalOpen(open);
        },
        openModalForProtection,
        lock,
        unlock,
        setupSecurity,
        resetSecurity
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
