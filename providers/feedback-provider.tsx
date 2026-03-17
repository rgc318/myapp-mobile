import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type FeedbackTone = 'info' | 'success' | 'error';

type FeedbackState = {
  tone: FeedbackTone;
  message: string;
} | null;

type FeedbackContextValue = {
  showInfo: (message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  clear: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function FeedbackToast({
  feedback,
  onDismiss,
}: {
  feedback: Exclude<FeedbackState, null>;
  onDismiss: () => void;
}) {
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  const accentColor =
    feedback.tone === 'success' ? successColor : feedback.tone === 'error' ? dangerColor : tintColor;

  return (
    <Pressable onPress={onDismiss} style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: surface, borderColor }]}>
        <View style={[styles.toastAccent, { backgroundColor: accentColor }]} />
        <ThemedText style={styles.toastText} type="defaultSemiBold">
          {feedback.message}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFeedback(null);
  }, []);

  const show = useCallback(
    (tone: FeedbackTone, message: string) => {
      clear();
      setFeedback({ tone, message });
      timerRef.current = setTimeout(() => {
        setFeedback(null);
        timerRef.current = null;
      }, 3200);
    },
    [clear],
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showInfo: (message) => show('info', message),
      showSuccess: (message) => show('success', message),
      showError: (message) => show('error', message),
      clear,
    }),
    [clear, show],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {feedback ? <FeedbackToast feedback={feedback} onDismiss={clear} /> : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used inside FeedbackProvider.');
  }
  return context;
}

const styles = StyleSheet.create({
  toastWrap: {
    left: 14,
    position: 'absolute',
    right: 14,
    top: 58,
    zIndex: 100,
  },
  toast: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  toastAccent: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
