import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
  const [focused, setFocused] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasTypedSinceFocus, setHasTypedSinceFocus] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!dropdownOpen) {
      setLoading(false);
      return;
    }

    const query = !hasTypedSinceFocus && value.trim() ? '' : value;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const nextOptions = await loadOptions(query);
      if (!cancelled) {
        setOptions(nextOptions);
        setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dropdownOpen, hasTypedSinceFocus, loadOptions, value]);

  const handleSelect = (nextValue: string) => {
    onChangeText(nextValue);
    onOptionSelect?.(nextValue);
    setOptions([]);
    setFocused(false);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  return (
    <View style={[styles.block, focused || dropdownOpen ? styles.blockActive : null]}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={[styles.inputWrap, focused || dropdownOpen ? styles.inputWrapActive : null]}>
        <TextInput
          autoCorrect={false}
          ref={inputRef}
          onChangeText={(nextValue) => {
            setHasTypedSinceFocus(true);
            onChangeText(nextValue);
          }}
          onFocus={() => {
            setFocused(true);
            setDropdownOpen(true);
            setHasTypedSinceFocus(false);
          }}
          onBlur={() => {
            setTimeout(() => {
              setFocused(false);
              setDropdownOpen(false);
            }, 120);
          }}
          placeholder={placeholder}
          style={[
            styles.input,
            inputActionText ? styles.inputWithAction : null,
            { backgroundColor: surfaceMuted, borderColor: errorText ? dangerColor : borderColor },
            Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null,
          ]}
          value={value}
        />

        {inputActionText ? (
          <Pressable
            onPress={() => {
              if (dropdownOpen) {
                setDropdownOpen(false);
                setFocused(false);
                inputRef.current?.blur();
                return;
              }

              setDropdownOpen(true);
              setHasTypedSinceFocus(false);
            }}
            style={styles.inputAction}>
            <ThemedText style={[styles.inputActionText, { color: tintColor }]} type="defaultSemiBold">
              {inputActionText}
            </ThemedText>
          </Pressable>
        ) : null}

        {dropdownOpen ? (
          <View style={[styles.dropdown, { backgroundColor: surface, borderColor }]}>
            <View style={[styles.dropdownHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={styles.dropdownHeaderText} type="defaultSemiBold">
                候选项
              </ThemedText>
              <ThemedText style={[styles.dropdownHeaderMeta, { color: tintColor }]}>
                {loading ? '正在更新' : `${options.length} 项`}
              </ThemedText>
            </View>
            <ScrollView
              bounces={options.length > 4}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.dropdownScroll}>
            {loading ? (
              <View style={styles.optionRow}>
                <ThemedText>正在读取候选项...</ThemedText>
              </View>
            ) : (
              options.length ? (
                options.map((option, index) => (
                  <View key={`${option.value}-${index}`}>
                    <Pressable onPress={() => handleSelect(option.value)} style={styles.optionRow}>
                      <View style={styles.optionText}>
                        <ThemedText type="defaultSemiBold">{option.label}</ThemedText>
                        {option.description ? (
                          <ThemedText style={styles.optionDesc}>{option.description}</ThemedText>
                        ) : null}
                      </View>
                      <ThemedText style={[styles.optionAction, { color: tintColor }]}>选择</ThemedText>
                    </Pressable>
                    {index < options.length - 1 ? (
                      <View style={[styles.separator, { backgroundColor: borderColor }]} />
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={styles.optionRow}>
                  <ThemedText>没有匹配的候选项</ThemedText>
                </View>
              )
            )}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {errorText ? <ThemedText style={[styles.helperText, { color: dangerColor }]}>{errorText}</ThemedText> : null}
      {!errorText && helperText ? <ThemedText style={styles.helperText}>{helperText}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    position: 'relative',
    zIndex: 1,
  },
  blockActive: {
    zIndex: 200,
  },
  inputWrap: {
    position: 'relative',
    zIndex: 20,
  },
  inputWrapActive: {
    zIndex: 220,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  inputWithAction: {
    paddingRight: 74,
  },
  inputAction: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 0,
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
  dropdown: {
    borderRadius: 14,
    borderWidth: 1,
    elevation: 16,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 240,
    top: 58,
    overflow: 'hidden',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    maxHeight: 280,
  },
  dropdownHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownHeaderText: {
    fontSize: 13,
  },
  dropdownHeaderMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownScroll: {
    maxHeight: 224,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionDesc: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 18,
  },
  optionAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
});
