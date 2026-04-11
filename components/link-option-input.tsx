import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { LinkOption } from '@/services/master-data';

type LinkOptionInputProps = {
  errorText?: string;
  helperText?: string;
  inputActionText?: string;
  label: string;
  loadOptions: (query: string) => Promise<LinkOption[]>;
  onChangeText: (value: string) => void;
  onOptionSelect?: (value: string) => void;
  placeholder: string;
  value: string;
};

export function LinkOptionInput({
  errorText,
  helperText,
  inputActionText,
  label,
  loadOptions,
  onChangeText,
  onOptionSelect,
  placeholder,
  value,
}: LinkOptionInputProps) {
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const tintColor = useThemeColor({}, 'tint');
  const textMuted = useThemeColor({}, 'icon');

  useEffect(() => {
    if (!pickerOpen) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const nextOptions = await loadOptions(pickerQuery);
      if (!cancelled) {
        setOptions(nextOptions);
        setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadOptions, pickerOpen, pickerQuery]);

  const closePicker = () => {
    setPickerOpen(false);
    setPickerQuery('');
    setOptions([]);
  };

  const handleSelect = (nextValue: string) => {
    onChangeText(nextValue);
    onOptionSelect?.(nextValue);
    closePicker();
  };

  const handleQueryChange = (nextValue: string) => {
    setPickerQuery(nextValue);
    onChangeText(nextValue);
  };

  return (
    <View style={styles.block}>
      {label ? <ThemedText type="defaultSemiBold">{label}</ThemedText> : null}
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={[
          styles.selectorField,
          { backgroundColor: surfaceMuted, borderColor: errorText ? dangerColor : borderColor },
        ]}>
        <ThemedText
          numberOfLines={1}
          style={[styles.selectorValue, !value ? { color: textMuted } : null]}
          type="defaultSemiBold">
          {value || placeholder}
        </ThemedText>
        <ThemedText style={[styles.inputActionText, { color: tintColor }]} type="defaultSemiBold">
          {inputActionText || '选择'}
        </ThemedText>
      </Pressable>

      <Modal animationType="slide" onRequestClose={closePicker} transparent visible={pickerOpen}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={closePicker} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                {label || '选择候选项'}
              </ThemedText>
              <ThemedText style={[styles.modalHint, { color: textMuted }]}>
                搜索并选择系统中已有记录，避免手工录错。
              </ThemedText>
            </View>
            <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <TextInput
                autoCorrect={false}
                onChangeText={handleQueryChange}
                placeholder={placeholder}
                placeholderTextColor="rgba(31,42,55,0.38)"
                style={[
                  styles.modalSearchInput,
                  Platform.OS === 'web' ? ({ outlineWidth: 0 } as never) : null,
                ]}
                value={pickerQuery}
              />
            </View>
            <ScrollView
              contentContainerStyle={styles.modalList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">正在读取候选项...</ThemedText>
                  <ThemedText style={[styles.modalHint, { color: textMuted }]}>请稍候。</ThemedText>
                </View>
              ) : options.length ? (
                options.map((option, index) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={`${option.value}-${index}`}
                      onPress={() => handleSelect(option.value)}
                      style={[
                        styles.modalOption,
                        { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                      ]}>
                      <View style={styles.optionText}>
                        <ThemedText numberOfLines={1} style={styles.modalOptionValue} type="defaultSemiBold">
                          {option.label}
                        </ThemedText>
                        {option.description ? (
                          <ThemedText numberOfLines={2} style={[styles.optionDesc, { color: textMuted }]}>
                            {option.description}
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText style={[styles.optionAction, { color: tintColor }]} type="defaultSemiBold">
                        {active ? '当前' : '选择'}
                      </ThemedText>
                    </Pressable>
                  );
                })
              ) : (
                <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">没有匹配的候选项</ThemedText>
                  <ThemedText style={[styles.modalHint, { color: textMuted }]}>换个关键词试试。</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {errorText ? <ThemedText style={[styles.helperText, { color: dangerColor }]}>{errorText}</ThemedText> : null}
      {!errorText && helperText ? <ThemedText style={styles.helperText}>{helperText}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  selectorField: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  selectorValue: {
    flex: 1,
    fontSize: 15,
  },
  inputActionText: {
    fontSize: 13,
  },
  helperText: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '78%',
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(148,163,184,0.55)',
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 44,
  },
  modalHeader: {
    gap: 8,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
  },
  modalHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalSearchWrap: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  modalSearchInput: {
    color: '#1F2937',
    fontSize: 15,
    minHeight: 50,
    paddingVertical: 12,
  },
  modalList: {
    gap: 10,
    paddingBottom: 18,
  },
  modalOption: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOptionValue: {
    fontSize: 15,
  },
  emptyState: {
    borderRadius: 16,
    gap: 6,
    padding: 18,
  },
});
