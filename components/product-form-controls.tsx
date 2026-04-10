import { KeyboardTypeOptions, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type PickerOption = {
  value: string;
  label: string;
  description?: string | null;
};

export function ProductTextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  labelColor,
  required = false,
  editable = true,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  labelColor?: string;
  required?: boolean;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={[styles.fieldBlock, !editable ? styles.fieldBlockDisabled : null]}>
      {label ? (
        <View style={styles.labelRow}>
          <ThemedText style={[styles.fieldLabel, labelColor ? { color: labelColor } : null]} type="defaultSemiBold">
            {label}
          </ThemedText>
          {required ? (
            <ThemedText style={styles.requiredMark} type="defaultSemiBold">
              *
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(31,42,55,0.38)"
        style={[
          multiline ? styles.textarea : styles.textInput,
          { backgroundColor: surfaceMuted, borderColor, color: textColor },
          !editable ? styles.inputDisabled : null,
        ]}
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
  required = false,
  disabled = false,
  helperText,
  errorText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  actionLabel?: string;
  onPress: () => void;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  errorText?: string;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const dangerColor = useThemeColor({}, 'danger');
  const textMuted = useThemeColor({}, 'icon');

  return (
    <View style={[styles.fieldBlock, disabled ? styles.fieldBlockDisabled : null]}>
      <View style={styles.labelRow}>
        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
          {label}
        </ThemedText>
        {required ? (
          <ThemedText style={styles.requiredMark} type="defaultSemiBold">
            *
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.selectorField,
          {
            backgroundColor: surfaceMuted,
            borderColor: errorText ? dangerColor : borderColor,
          },
          disabled ? styles.inputDisabled : null,
        ]}>
        <ThemedText
          numberOfLines={1}
          style={[styles.selectorFieldValue, !value ? { color: textMuted } : null]}
          type="defaultSemiBold">
          {value || placeholder}
        </ThemedText>
        <ThemedText style={{ color: tintColor, opacity: disabled ? 0.5 : 1 }} type="defaultSemiBold">
          {disabled ? '只读' : actionLabel}
        </ThemedText>
      </Pressable>
      {errorText ? <ThemedText style={[styles.helperText, { color: dangerColor }]}>{errorText}</ThemedText> : null}
      {!errorText && helperText ? <ThemedText style={[styles.helperText, { color: textMuted }]}>{helperText}</ThemedText> : null}
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
  getOptionLabel,
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
  getOptionLabel?: (value: string) => string;
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
                const label = getOptionLabel ? getOptionLabel(value) : value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => onSelect(value)}
                    style={[
                      styles.modalOption,
                      { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                    ]}>
                    <ThemedText numberOfLines={1} style={styles.modalOptionValue} type="defaultSemiBold">
                      {label}
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

export function EntityPickerSheet({
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
  isLoading = false,
  emptyText = '没有找到匹配项',
}: {
  visible: boolean;
  title: string;
  hint: string;
  placeholder: string;
  query: string;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  options: PickerOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  isLoading?: boolean;
  emptyText?: string;
}) {
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textMuted = useThemeColor({}, 'icon');

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
              autoCorrect={false}
              onChangeText={onChangeQuery}
              placeholder={placeholder}
              placeholderTextColor="rgba(31,42,55,0.38)"
              style={styles.modalSearchInput}
              value={query}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                <ThemedText type="defaultSemiBold">正在读取候选项...</ThemedText>
                <ThemedText style={styles.modalHint}>请稍候。</ThemedText>
              </View>
            ) : options.length ? (
              options.map((option) => {
                const active = option.value === selectedValue;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => onSelect(option.value)}
                    style={[
                      styles.modalOption,
                      {
                        backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted,
                        borderColor,
                      },
                    ]}>
                    <View style={styles.modalOptionCopy}>
                      <ThemedText numberOfLines={1} style={styles.modalOptionValue} type="defaultSemiBold">
                        {option.label}
                      </ThemedText>
                      {option.description ? (
                        <ThemedText numberOfLines={2} style={[styles.modalOptionDescription, { color: textMuted }]}>
                          {option.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                      {active ? '当前' : '选择'}
                    </ThemedText>
                  </Pressable>
                );
              })
            ) : (
              <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                <ThemedText type="defaultSemiBold">{emptyText}</ThemedText>
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
  fieldBlockDisabled: {
    opacity: 0.9,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 14,
  },
  requiredMark: {
    color: '#DC2626',
    fontSize: 15,
    lineHeight: 18,
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
  inputDisabled: {
    opacity: 0.64,
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
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
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
  modalOptionCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  modalOptionValue: {
    flexShrink: 1,
  },
  modalOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
});
