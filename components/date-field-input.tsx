import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addDaysToIsoDate, buildIsoDate, getTodayIsoDate, splitIsoDate } from '@/lib/date-value';

type DateFieldInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  allowClear?: boolean;
};

export function DateFieldInput({
  label,
  value,
  onChange,
  placeholder = '选择日期',
  helperText,
  errorText,
  allowClear = false,
}: DateFieldInputProps) {
  const [visible, setVisible] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const [monthInput, setMonthInput] = useState('');
  const [dayInput, setDayInput] = useState('');
  const [modalError, setModalError] = useState('');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const dangerColor = useThemeColor({}, 'danger');
  const textMuted = '#94A3B8';

  useEffect(() => {
    if (!visible) {
      return;
    }

    const parts = splitIsoDate(value);
    setYearInput(parts.year);
    setMonthInput(parts.month);
    setDayInput(parts.day);
    setModalError('');
  }, [value, visible]);

  const displayValue = useMemo(() => value.trim() || placeholder, [placeholder, value]);

  const presetOptions = useMemo(
    () => [
      { label: '今天', value: getTodayIsoDate() },
      { label: '明天', value: addDaysToIsoDate(getTodayIsoDate(), 1) },
      { label: '+7天', value: addDaysToIsoDate(getTodayIsoDate(), 7) },
    ],
    [],
  );

  const applyValue = (nextValue: string) => {
    onChange(nextValue);
    setVisible(false);
    setModalError('');
  };

  const handleConfirm = () => {
    const nextValue = buildIsoDate(yearInput.trim(), monthInput.trim(), dayInput.trim());
    if (!nextValue) {
      setModalError('请输入有效日期，格式为 YYYY-MM-DD。');
      return;
    }

    applyValue(nextValue);
  };

  return (
    <View style={styles.block}>
      <ThemedText style={styles.label} type="defaultSemiBold">
        {label}
      </ThemedText>
      <Pressable
        onPress={() => setVisible(true)}
        style={[
          styles.field,
          { backgroundColor: surfaceMuted, borderColor: errorText ? dangerColor : borderColor },
        ]}>
        <ThemedText style={[styles.fieldValue, !value.trim() ? { color: textMuted } : null]}>
          {displayValue}
        </ThemedText>
        <ThemedText style={[styles.fieldAction, { color: tintColor }]} type="defaultSemiBold">
          选择
        </ThemedText>
      </Pressable>
      {errorText ? <ThemedText style={[styles.feedbackText, { color: dangerColor }]}>{errorText}</ThemedText> : null}
      {!errorText && helperText ? <ThemedText style={styles.feedbackText}>{helperText}</ThemedText> : null}

      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <Pressable onPress={() => setVisible(false)} style={styles.backdrop}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.sheet, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.sheetTitle} type="title">
              {label}
            </ThemedText>
            <ThemedText style={styles.sheetHint}>
              请选择有效日期，系统会按 `YYYY-MM-DD` 保存。
            </ThemedText>

            <View style={styles.presetRow}>
              {presetOptions.map((option) => (
                <Pressable
                  key={option.label}
                  onPress={() => applyValue(option.value)}
                  style={[styles.presetChip, { backgroundColor: surfaceMuted, borderColor }]}>
                  <ThemedText style={[styles.presetChipText, { color: tintColor }]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
              {allowClear ? (
                <Pressable
                  onPress={() => applyValue('')}
                  style={[styles.presetChip, { backgroundColor: surfaceMuted, borderColor }]}>
                  <ThemedText style={styles.presetChipText} type="defaultSemiBold">
                    清空
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.partRow}>
              <View style={styles.partBlock}>
                <ThemedText style={styles.partLabel}>年</ThemedText>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={setYearInput}
                  placeholder="2026"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.partInput, { backgroundColor: surfaceMuted, borderColor }]}
                  value={yearInput}
                />
              </View>
              <View style={styles.partBlock}>
                <ThemedText style={styles.partLabel}>月</ThemedText>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={setMonthInput}
                  placeholder="03"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.partInput, { backgroundColor: surfaceMuted, borderColor }]}
                  value={monthInput}
                />
              </View>
              <View style={styles.partBlock}>
                <ThemedText style={styles.partLabel}>日</ThemedText>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={setDayInput}
                  placeholder="29"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.partInput, { backgroundColor: surfaceMuted, borderColor }]}
                  value={dayInput}
                />
              </View>
            </View>

            {modalError ? (
              <ThemedText style={[styles.feedbackText, { color: dangerColor }]}>{modalError}</ThemedText>
            ) : null}

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setVisible(false)}
                style={[styles.actionButton, styles.ghostButton, { borderColor }]}>
                <ThemedText style={styles.ghostButtonText} type="defaultSemiBold">
                  取消
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={[styles.actionButton, styles.primaryButton, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                  确认
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  field: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldValue: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
  },
  fieldAction: {
    fontSize: 14,
  },
  feedbackText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 14,
  },
  sheetTitle: {
    fontSize: 20,
  },
  sheetHint: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 13,
  },
  partRow: {
    flexDirection: 'row',
    gap: 10,
  },
  partBlock: {
    flex: 1,
    gap: 6,
  },
  partLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  partInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null),
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: {
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  ghostButtonText: {
    color: '#334155',
  },
  primaryButton: {},
  primaryButtonText: {
    color: '#FFFFFF',
  },
});
