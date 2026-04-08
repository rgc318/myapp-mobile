import * as React from 'react';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { deleteItemImage, replaceItemImage, uploadItemImage } from '@/services/media';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.78;

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

async function compressPickedImage(asset: ImagePicker.ImagePickerAsset) {
  if (!asset.uri) {
    throw new Error('未读取到图片文件，请重试。');
  }

  const width = typeof asset.width === 'number' ? asset.width : 0;
  const height = typeof asset.height === 'number' ? asset.height : 0;
  const longestEdge = Math.max(width, height);
  const shouldResize = longestEdge > MAX_IMAGE_DIMENSION;
  const resizeAction = shouldResize
    ? width >= height
      ? { width: MAX_IMAGE_DIMENSION }
      : { height: MAX_IMAGE_DIMENSION }
    : null;

  const manipulator = ImageManipulator.manipulate(asset.uri);
  if (resizeAction) {
    manipulator.resize(resizeAction);
  }

  const rendered = await manipulator.renderAsync();
  const saved = await rendered.saveAsync({
    base64: true,
    compress: COMPRESS_QUALITY,
    format: SaveFormat.JPEG,
  });

  if (!saved.base64) {
    throw new Error('图片压缩失败，请重试。');
  }

  return {
    base64: saved.base64,
    mimeType: 'image/jpeg',
    fileName: ensureFilename(asset.fileName, 'image/jpeg').replace(/\.[^.]+$/, '.jpg'),
    fileSize: typeof saved.fileSize === 'number' ? saved.fileSize : null,
  };
}

export function ItemImageField({
  value,
  onChange,
  itemCode,
  disabled = false,
  variant = 'default',
}: {
  value: string;
  onChange: (value: string) => void;
  itemCode?: string | null;
  disabled?: boolean;
  variant?: 'default' | 'cover';
}) {
  const { showError, showSuccess } = useFeedback();
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textMuted = useThemeColor({}, 'icon');
  return <InnerItemImageField borderColor={borderColor} disabled={disabled} itemCode={itemCode} onChange={onChange} showError={showError} showSuccess={showSuccess} surfaceMuted={surfaceMuted} textMuted={textMuted} tintColor={tintColor} value={value} variant={variant} />;
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
  variant,
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
  variant: 'default' | 'cover';
}) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isCover = variant === 'cover';

  const uploadAsset = React.useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      const processed = await compressPickedImage(asset);
      if (typeof processed.fileSize === 'number' && processed.fileSize > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('图片请控制在 5MB 以内后再上传。');
      }

      setIsUploading(true);
      try {
        const uploaded = itemCode
          ? await replaceItemImage({
              itemCode,
              filename: processed.fileName,
              fileContentBase64: processed.base64,
              contentType: processed.mimeType,
            })
          : await uploadItemImage({
              filename: processed.fileName,
              fileContentBase64: processed.base64,
              contentType: processed.mimeType,
            });

        onChange(uploaded.fileUrl);
        showSuccess(itemCode ? '商品图片已替换' : '商品图片已上传');
      } finally {
        setIsUploading(false);
      }
    },
    [itemCode, onChange, showSuccess],
  );

  const handlePickImage = async () => {
    if (disabled || isUploading || isDeleting) {
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

      await uploadAsset(result.assets[0]);
    } catch (error) {
      showError(error instanceof Error ? error.message : '商品图片上传失败');
    }
  };

  const handleTakePhoto = async () => {
    if (disabled || isUploading || isDeleting) {
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error('请先允许访问相机，才能直接拍照上传商品图片。');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
      });

      if (result.canceled) {
        return;
      }

      await uploadAsset(result.assets[0]);
    } catch (error) {
      showError(error instanceof Error ? error.message : '商品图片拍照上传失败');
    }
  };

  const handleClearImage = async () => {
    if (!value || disabled || isUploading || isDeleting) {
      return;
    }

    if (!itemCode) {
      onChange('');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteItemImage(itemCode);
      onChange('');
      showSuccess('商品图片已删除');
    } catch (error) {
      showError(error instanceof Error ? error.message : '商品图片删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.fieldBlock, isCover ? styles.coverFieldBlock : null]}>
      <View style={styles.labelRow}>
        <ThemedText style={[styles.fieldLabel, isCover ? styles.coverFieldLabel : null]} type="defaultSemiBold">
          商品图片
        </ThemedText>
        {isCover ? (
          <ThemedText style={[styles.coverEyebrow, { color: textMuted }]}>建议优先上传封面图</ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.card,
          isCover ? styles.coverCard : null,
          { backgroundColor: surfaceMuted, borderColor },
          disabled ? styles.disabled : null,
        ]}>
        <View style={[styles.previewWrap, isCover ? styles.coverPreviewWrap : null]}>
          {value ? (
            <Image contentFit="cover" source={value} style={styles.previewImage} />
          ) : (
            <View style={[styles.emptyState, isCover ? styles.coverEmptyState : null]}>
              <ThemedText style={[styles.emptyText, isCover ? styles.coverEmptyTitle : null, { color: textMuted }]}>
                还没有商品图片
              </ThemedText>
              {isCover ? (
                <ThemedText style={[styles.coverEmptyHint, { color: textMuted }]}>
                  上传后会作为商品首图展示在列表、详情和下游单据里。
                </ThemedText>
              ) : null}
            </View>
          )}
        </View>
        <View style={[styles.actions, isCover ? styles.coverActions : null]}>
          <View style={[styles.actionRow, isCover ? styles.coverActionRow : null]}>
            <Pressable
              disabled={disabled || isUploading || isDeleting}
              onPress={() => void handlePickImage()}
              style={[
                styles.primaryAction,
                isCover ? styles.coverPrimaryAction : null,
                { backgroundColor: tintColor, opacity: disabled || isUploading || isDeleting ? 0.6 : 1 },
              ]}>
              {isUploading ? <ActivityIndicator color="#fff" size="small" /> : null}
              <ThemedText style={styles.primaryActionText} type="defaultSemiBold">
                {isUploading ? '上传中…' : value ? '相册更换' : '相册上传'}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={disabled || isUploading || isDeleting}
              onPress={() => void handleTakePhoto()}
              style={[styles.secondaryAction, isCover ? styles.coverSecondaryAction : null, { borderColor }]}>
              <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                拍照上传
              </ThemedText>
            </Pressable>
            {value ? (
              <Pressable
                disabled={disabled || isUploading || isDeleting}
                onPress={() => void handleClearImage()}
                style={[styles.secondaryAction, isCover ? styles.coverSecondaryAction : null, { borderColor }]}>
                {isDeleting ? <ActivityIndicator color={tintColor} size="small" /> : null}
                <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                  {isDeleting ? '删除中…' : itemCode ? '删除图片' : '清空地址'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          <ThemedText style={[styles.hint, { color: textMuted }]}>
            当前支持相册上传和相机拍照，建议单张控制在 5MB 以内。
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
  coverFieldBlock: {
    gap: 10,
  },
  labelRow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 14,
  },
  coverFieldLabel: {
    fontSize: 15,
  },
  coverEyebrow: {
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  coverCard: {
    borderRadius: 24,
    gap: 14,
    padding: 16,
  },
  previewWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 180,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPreviewWrap: {
    borderRadius: 20,
    height: 220,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmptyState: {
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
  },
  coverEmptyTitle: {
    fontSize: 16,
  },
  coverEmptyHint: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  coverActions: {
    gap: 12,
  },
  actionRow: {
    gap: 10,
  },
  coverActionRow: {
    flexDirection: 'row',
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
  coverPrimaryAction: {
    flex: 1,
    minHeight: 48,
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
  coverSecondaryAction: {
    minWidth: 104,
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
