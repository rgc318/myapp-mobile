import * as React from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { replaceItemImage, uploadItemImage } from '@/services/media';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function guessExtension(mimeType?: string | null) {
  const normalized = (mimeType ?? '').toLowerCase();
  if (normalized === 'image/jpeg') {
    return 'jpg';
  }
  if (normalized === 'image/png') {
    return 'png';
  }
  if (normalized === 'image/webp') {
    return 'webp';
  }
  if (normalized === 'image/gif') {
    return 'gif';
  }
  if (normalized === 'image/bmp') {
    return 'bmp';
  }
  if (normalized === 'image/heic') {
    return 'heic';
  }
  if (normalized === 'image/heif') {
    return 'heif';
  }
  return 'jpg';
}

function ensureFilename(fileName: string | null | undefined, mimeType?: string | null) {
  const trimmed = typeof fileName === 'string' ? fileName.trim() : '';
  if (trimmed) {
    return trimmed;
  }
  return `item-image-${Date.now()}.${guessExtension(mimeType)}`;
}

export function ItemImageField({
  value,
  onChange,
  itemCode,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  itemCode?: string | null;
  disabled?: boolean;
}) {
  const { showError, showSuccess } = useFeedback();
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textMuted = useThemeColor({}, 'icon');
  return <InnerItemImageField borderColor={borderColor} disabled={disabled} itemCode={itemCode} onChange={onChange} showError={showError} showSuccess={showSuccess} surfaceMuted={surfaceMuted} textMuted={textMuted} tintColor={tintColor} value={value} />;
}

function InnerItemImageField({
  value,
  onChange,
  itemCode,
  disabled,
  surfaceMuted,
  borderColor,
  tintColor,
  textMuted,
  showError,
  showSuccess,
}: {
  value: string;
  onChange: (value: string) => void;
  itemCode?: string | null;
  disabled: boolean;
  surfaceMuted: string;
  borderColor: string;
  tintColor: string;
  textMuted: string;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}) {
  const [isUploading, setIsUploading] = React.useState(false);

  const handlePickImage = async () => {
    if (disabled || isUploading) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('请先允许访问相册，才能上传商品图片。');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.base64) {
        throw new Error('未读取到图片内容，请重试。');
      }

      if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('图片请控制在 5MB 以内后再上传。');
      }

      setIsUploading(true);
      const uploaded = itemCode
        ? await replaceItemImage({
            itemCode,
            filename: ensureFilename(asset.fileName, asset.mimeType),
            fileContentBase64: asset.base64,
            contentType: asset.mimeType,
          })
        : await uploadItemImage({
            filename: ensureFilename(asset.fileName, asset.mimeType),
            fileContentBase64: asset.base64,
            contentType: asset.mimeType,
          });

      onChange(uploaded.fileUrl);
      showSuccess(itemCode ? '商品图片已替换' : '商品图片已上传');
    } catch (error) {
      showError(error instanceof Error ? error.message : '商品图片上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.fieldBlock}>
      <View style={styles.labelRow}>
        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
          商品图片
        </ThemedText>
      </View>
      <View style={[styles.card, { backgroundColor: surfaceMuted, borderColor }, disabled ? styles.disabled : null]}>
        <View style={styles.previewWrap}>
          {value ? (
            <Image contentFit="cover" source={value} style={styles.previewImage} />
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={[styles.emptyText, { color: textMuted }]}>还没有商品图片</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            disabled={disabled || isUploading}
            onPress={() => void handlePickImage()}
            style={[
              styles.primaryAction,
              { backgroundColor: tintColor, opacity: disabled || isUploading ? 0.6 : 1 },
            ]}>
            {isUploading ? <ActivityIndicator color="#fff" size="small" /> : null}
            <ThemedText style={styles.primaryActionText} type="defaultSemiBold">
              {isUploading ? '上传中…' : value ? '更换图片' : '上传图片'}
            </ThemedText>
          </Pressable>
          {value ? (
            <Pressable
              disabled={disabled || isUploading}
              onPress={() => onChange('')}
              style={[styles.secondaryAction, { borderColor }]}>
              <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                清空地址
              </ThemedText>
            </Pressable>
          ) : null}
          <ThemedText style={[styles.hint, { color: textMuted }]}>
            当前先支持从相册选择图片，建议单张控制在 5MB 以内。
          </ThemedText>
          {value ? (
            <ThemedText numberOfLines={2} style={[styles.urlText, { color: textMuted }]}>
              {value}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldBlock: {
    gap: 8,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  previewWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 180,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  actions: {
    gap: 10,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: '#fff',
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  urlText: {
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.72,
  },
});
