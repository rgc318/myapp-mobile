import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export function ProductTextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  labelColor,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  labelColor?: string;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View style={styles.fieldBlock}>
      <ThemedText style={[styles.fieldLabel, labelColor ? { color: labelColor } : null]} type="defaultSemiBold">
        {label}
      </ThemedText>
      <TextInput
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(31,42,55,0.38)"
        style={[multiline ? styles.textarea : styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

export function ProductSelectorField({
  label,
  value,
  placeholder = '请选择',
  actionLabel = '选择',
  onPress,
}: {
  label: string;
  value: string;
  placeholder?: string;
  actionLabel?: string;
  onPress: () => void;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={styles.fieldBlock}>
      <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
      <Pressable onPress={onPress} style={[styles.selectorField, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText numberOfLines={1} style={styles.selectorFieldValue} type="defaultSemiBold">
          {value || placeholder}
        </ThemedText>
        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
          {actionLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export function ProductPickerSheet({
  visible,
  title,
  hint,
  placeholder,
  query,
  onChangeQuery,
  onClose,
  options,
  selectedValue,
  onSelect,
}: {
  visible: boolean;
  title: string;
  hint: string;
  placeholder: string;
  query: string;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  options: string[];
  selectedValue?: string;
  onSelect: (value: string) => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.modalSheet, { backgroundColor: surface }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle} type="title">
              {title}
            </ThemedText>
            <ThemedText style={styles.modalHint}>{hint}</ThemedText>
          </View>
          <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
            <TextInput
              onChangeText={onChangeQuery}
              placeholder={placeholder}
              placeholderTextColor="rgba(31,42,55,0.38)"
              style={styles.modalSearchInput}
              value={query}
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            {options.length ? (
              options.map((value) => {
                const active = value === selectedValue;
                return (
                  <Pressable
                    key={value}
                    onPress={() => onSelect(value)}
                    style={[
                      styles.modalOption,
                      { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                    ]}>
                    <ThemedText numberOfLines={1} style={styles.modalOptionValue} type="defaultSemiBold">
                      {value}
                    </ThemedText>
                    <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                      {active ? '当前' : '选择'}
                    </ThemedText>
                  </Pressable>
                );
              })
            ) : (
              <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                <ThemedText type="defaultSemiBold">没有找到匹配项</ThemedText>
                <ThemedText style={styles.modalHint}>换个关键词试试。</ThemedText>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
  },
  textInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  textarea: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorField: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  selectorFieldValue: {
    flex: 1,
    paddingRight: 12,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 14,
    maxHeight: '78%',
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(148,163,184,0.9)',
    borderRadius: 999,
    height: 4,
    width: 56,
  },
  modalHeader: {
    gap: 4,
  },
  modalTitle: {
    fontSize: 24,
  },
  modalHint: {
    opacity: 0.72,
  },
  modalSearchWrap: {
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  modalSearchInput: {
    fontSize: 15,
    minHeight: 40,
  },
  modalList: {
    gap: 10,
    paddingBottom: 8,
  },
  modalOption: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 14,
  },
  modalOptionValue: {
    flex: 1,
    paddingRight: 12,
  },
  emptyState: {
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
});
