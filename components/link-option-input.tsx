import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { LinkOption } from '@/services/master-data';

type LinkOptionInputProps = {
  errorText?: string;
  helperText?: string;
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
  label,
  loadOptions,
  onChangeText,
  onOptionSelect,
  placeholder,
  value,
}: LinkOptionInputProps) {
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!focused) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const nextOptions = await loadOptions(value);
      if (!cancelled) {
        setOptions(nextOptions);
        setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [focused, loadOptions, value]);

  const handleSelect = (nextValue: string) => {
    onChangeText(nextValue);
    onOptionSelect?.(nextValue);
    setOptions([]);
    setFocused(false);
  };

  return (
    <View style={[styles.block, focused ? styles.blockActive : null]}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={[styles.inputWrap, focused ? styles.inputWrapActive : null]}>
        <TextInput
          autoCorrect={false}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 120);
          }}
          placeholder={placeholder}
          style={[
            styles.input,
            { backgroundColor: surfaceMuted, borderColor: errorText ? dangerColor : borderColor },
            Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null,
          ]}
          value={value}
        />

        {focused && (loading || options.length > 0) ? (
          <View style={[styles.dropdown, { backgroundColor: surface, borderColor }]}>
            {loading ? (
              <View style={styles.optionRow}>
                <ThemedText>正在读取候选项...</ThemedText>
              </View>
            ) : (
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
            )}
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
    zIndex: 50,
  },
  inputWrap: {
    position: 'relative',
    zIndex: 20,
  },
  inputWrapActive: {
    zIndex: 60,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
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
    left: 0,
    position: 'absolute',
    right: 0,
    top: 58,
    overflow: 'hidden',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
