import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { ThemedConfirmModal } from './ThemedConfirmModal';
import {
  checkForAppUpdate,
  dismissUpdatePrompt,
  fetchAppVersionInfo,
  openPlayStore,
  type UpdateCheckResult,
} from '../../services/appUpdate';

/**
 * Checks the API for a newer Play Store build and shows the branded
 * ThemedConfirmModal when an update is available.
 */
export const AppUpdateGate: React.FC = () => {
  const [prompt, setPrompt] = useState<UpdateCheckResult | null>(null);
  const checking = useRef(false);
  const appState = useRef(AppState.currentState);

  const runCheck = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await checkForAppUpdate();
      setPrompt(result);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void runCheck();
    }, 900);
    return () => clearTimeout(t);
  }, [runCheck]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        void runCheck();
      }
      appState.current = next;
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [runCheck]);

  const onUpdate = useCallback(async () => {
    const url = prompt?.storeUrl;
    await openPlayStore(url);
    // Keep forced dialog open; soft updates stay until they leave to store.
  }, [prompt?.storeUrl]);

  const onLater = useCallback(async () => {
    if (!prompt || prompt.forceUpdate) return;
    const info = await fetchAppVersionInfo();
    if (info) await dismissUpdatePrompt(info);
    setPrompt(null);
  }, [prompt]);

  if (!prompt?.updateAvailable) return null;

  return (
    <ThemedConfirmModal
      visible
      title="Update Available"
      message={`${prompt.message}\n\nInstalled ${prompt.currentLabel} → ${prompt.latestLabel}`}
      icon="cloud-download-outline"
      confirmLabel="UPDATE"
      cancelLabel="LATER"
      hideCancel={prompt.forceUpdate}
      dismissible={!prompt.forceUpdate}
      onConfirm={() => {
        void onUpdate();
      }}
      onCancel={() => {
        void onLater();
      }}
    />
  );
};
