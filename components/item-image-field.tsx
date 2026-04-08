import * as React from 'react';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { Image as CropPickerImage, ImageCropPicker as CropPickerModule } from 'react-native-image-crop-picker';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { deleteItemImage, replaceItemImage, uploadItemImage } from '@/services/media';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.78;
const PRODUCT_IMAGE_SIZE = 1600;

type PreparedUploadImage = {
  base64: string;
  mimeType: string;
  fileName: string;
  fileSize: number | null;
  cleanupPath?: string | null;
};

async function getNativeCropPicker(): Promise<CropPickerModule> {
  const runtimeModule = await import('react-native-image-crop-picker');
  return (runtimeModule.default ?? runtimeModule) as CropPickerModule;
}

function isPickerCancelled(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'E_PICKER_CANCELLED',
  );
}

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

async function compressPickedImage(asset: ImagePicker.ImagePickerAsset): Promise<PreparedUploadImage> {
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

async function processNativeCroppedImage(image: CropPickerImage): Promise<PreparedUploadImage> {
  if (!image.data) {
    throw new Error('未读取到裁切后的图片数据，请重试。');
  }

  return {
    base64: image.data,
    mimeType: image.mime || 'image/jpeg',
    fileName: ensureFilename(image.filename, image.mime).replace(/\.[^.]+$/, '.jpg'),
    fileSize: typeof image.size === 'number' ? image.size : null,
    cleanupPath: image.path,
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
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const dangerColor = useThemeColor({}, 'danger');
  const textMuted = useThemeColor({}, 'icon');
  return <InnerItemImageField borderColor={borderColor} dangerColor={dangerColor} disabled={disabled} itemCode={itemCode} onChange={onChange} showError={showError} showSuccess={showSuccess} surface={surface} surfaceMuted={surfaceMuted} textMuted={textMuted} tintColor={tintColor} value={value} variant={variant} />;
}

function InnerItemImageField({
  value,
  onChange,
  itemCode,
  disabled,
  surface,
  surfaceMuted,
  borderColor,
  tintColor,
  dangerColor,
  textMuted,
  showError,
  showSuccess,
  variant,
}: {
  value: string;
  onChange: (value: string) => void;
  itemCode?: string | null;
  disabled: boolean;
  surface: string;
  surfaceMuted: string;
  borderColor: string;
  tintColor: string;
  dangerColor: string;
  textMuted: string;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  variant: 'default' | 'cover';
}) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showActionSheet, setShowActionSheet] = React.useState(false);
  const isCover = variant === 'cover';

  const closeActionSheet = React.useCallback(() => {
    setShowActionSheet(false);
  }, []);

  const uploadAsset = React.useCallback(
    async (processed: PreparedUploadImage) => {
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
        if (processed.cleanupPath && Platform.OS !== 'web') {
          try {
            const cropPicker = await getNativeCropPicker();
            await cropPicker.cleanSingle(processed.cleanupPath);
          } catch {
            // Ignore temp file cleanup errors from the cropper cache.
          }
        }
      }
    },
    [itemCode, onChange, showSuccess],
  );

  const handlePickImage = async () => {
    if (disabled || isUploading || isDeleting) {
      return;
    }

    try {
      closeActionSheet();
      if (Platform.OS === 'web') {
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

        await uploadAsset(await compressPickedImage(result.assets[0]));
        return;
      }

      const cropPicker = await getNativeCropPicker();
      const picked = await cropPicker.openPicker({
        cropping: true,
        mediaType: 'photo',
        width: PRODUCT_IMAGE_SIZE,
        height: PRODUCT_IMAGE_SIZE,
        includeBase64: true,
        forceJpg: true,
        compressImageMaxWidth: PRODUCT_IMAGE_SIZE,
        compressImageMaxHeight: PRODUCT_IMAGE_SIZE,
        compressImageQuality: COMPRESS_QUALITY,
        cropperToolbarTitle: '裁切商品图片',
        cropperToolbarColor: '#FFFFFF',
        cropperToolbarWidgetColor: '#2563EB',
        cropperStatusBarLight: true,
        cropperNavigationBarLight: true,
        avoidEmptySpaceAroundImage: true,
        showCropGuidelines: true,
        showCropFrame: true,
      });
      await uploadAsset(await processNativeCroppedImage(picked));
    } catch (error) {
      if (isPickerCancelled(error)) {
        return;
      }
      showError(error instanceof Error ? error.message : '商品图片上传失败');
    }
  };

  const handleTakePhoto = async () => {
    if (disabled || isUploading || isDeleting) {
      return;
    }

    try {
      closeActionSheet();
      if (Platform.OS === 'web') {
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

        await uploadAsset(await compressPickedImage(result.assets[0]));
        return;
      }

      const cropPicker = await getNativeCropPicker();
      const captured = await cropPicker.openCamera({
        cropping: true,
        mediaType: 'photo',
        width: PRODUCT_IMAGE_SIZE,
        height: PRODUCT_IMAGE_SIZE,
        includeBase64: true,
        forceJpg: true,
        compressImageMaxWidth: PRODUCT_IMAGE_SIZE,
        compressImageMaxHeight: PRODUCT_IMAGE_SIZE,
        compressImageQuality: COMPRESS_QUALITY,
        cropperToolbarTitle: '裁切商品图片',
        cropperToolbarColor: '#FFFFFF',
        cropperToolbarWidgetColor: '#2563EB',
        cropperStatusBarLight: true,
        cropperNavigationBarLight: true,
        avoidEmptySpaceAroundImage: true,
        showCropGuidelines: true,
        showCropFrame: true,
      });
      await uploadAsset(await processNativeCroppedImage(captured));
    } catch (error) {
      if (isPickerCancelled(error)) {
        return;
      }
      showError(error instanceof Error ? error.message : '商品图片拍照上传失败');
    }
  };

  const handleClearImage = async () => {
    if (!value || disabled || isUploading || isDeleting) {
      return;
    }

    if (!itemCode) {
      closeActionSheet();
      onChange('');
      return;
    }

    try {
      closeActionSheet();
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
          <Pressable
            disabled={disabled || isUploading || isDeleting}
            onPress={() => setShowActionSheet(true)}
            style={[
              styles.primaryAction,
              isCover ? styles.coverPrimaryAction : null,
              { backgroundColor: tintColor, opacity: disabled || isUploading || isDeleting ? 0.6 : 1 },
            ]}>
            {isUploading ? <ActivityIndicator color="#fff" size="small" /> : null}
            <ThemedText style={styles.primaryActionText} type="defaultSemiBold">
              {isUploading ? '上传中…' : value ? '更换图片' : '上传图片'}
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.hint, { color: textMuted }]}>
            点击后可选择相册或相机，建议单张控制在 5MB 以内。
          </ThemedText>
          {value ? (
            <ThemedText numberOfLines={2} style={[styles.urlText, { color: textMuted }]}>
              {value}
            </ThemedText>
            ) : null}
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={closeActionSheet} transparent visible={showActionSheet}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={closeActionSheet} style={styles.sheetDismissArea} />
          <View style={[styles.sheetCard, { backgroundColor: surface, borderColor }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle} type="defaultSemiBold">
                {value ? '更换商品图片' : '上传商品图片'}
              </ThemedText>
              <ThemedText style={[styles.sheetHint, { color: textMuted }]}>
                选择图片来源，再继续上传。
              </ThemedText>
            </View>

            <View style={styles.sheetActionList}>
              <Pressable onPress={() => void handlePickImage()} style={[styles.sheetActionButton, { backgroundColor: surfaceMuted }]}>
                <View style={[styles.sheetActionIconWrap, { backgroundColor: `${tintColor}12` }]}>
                  <IconSymbol color={tintColor} name="photo" size={18} />
                </View>
                <View style={styles.sheetActionCopy}>
                  <ThemedText style={styles.sheetActionTitle} type="defaultSemiBold">
                    从相册选择
                  </ThemedText>
                  <ThemedText style={[styles.sheetActionHint, { color: textMuted }]}>从已保存的照片中选择一张商品图</ThemedText>
                </View>
              </Pressable>
              <Pressable onPress={() => void handleTakePhoto()} style={[styles.sheetActionButton, { backgroundColor: surfaceMuted }]}>
                <View style={[styles.sheetActionIconWrap, { backgroundColor: `${tintColor}12` }]}>
                  <IconSymbol color={tintColor} name="barcode.viewfinder" size={18} />
                </View>
                <View style={styles.sheetActionCopy}>
                  <ThemedText style={styles.sheetActionTitle} type="defaultSemiBold">
                    拍照上传
                  </ThemedText>
                  <ThemedText style={[styles.sheetActionHint, { color: textMuted }]}>直接调用系统相机拍摄新的商品图片</ThemedText>
                </View>
              </Pressable>
            </View>

            {value ? (
              <Pressable onPress={() => void handleClearImage()} style={[styles.dangerActionButton, { backgroundColor: 'rgba(220,38,38,0.08)' }]}>
                <View style={[styles.sheetActionIconWrap, { backgroundColor: 'rgba(220,38,38,0.14)' }]}>
                  <IconSymbol color={dangerColor} name="xmark.circle.fill" size={18} />
                </View>
                <View style={styles.sheetActionCopy}>
                  <ThemedText style={[styles.sheetActionTitle, { color: dangerColor }]} type="defaultSemiBold">
                    {itemCode ? '删除图片' : '清空地址'}
                  </ThemedText>
                  <ThemedText style={[styles.sheetActionHint, { color: textMuted }]}>移除当前商品图片并恢复为空状态</ThemedText>
                </View>
              </Pressable>
            ) : null}

            <Pressable onPress={closeActionSheet} style={[styles.sheetCancelButton, { backgroundColor: surfaceMuted }]}>
              <ThemedText type="defaultSemiBold">取消</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    minHeight: 48,
  },
  primaryActionText: {
    color: '#fff',
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
  sheetBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(148,163,184,0.5)',
    borderRadius: 999,
    height: 5,
    width: 52,
  },
  sheetHeader: {
    gap: 4,
  },
  sheetTitle: {
    fontSize: 18,
  },
  sheetHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  sheetActionList: {
    gap: 10,
  },
  sheetActionButton: {
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetActionIconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sheetActionCopy: {
    flex: 1,
    gap: 2,
  },
  sheetActionTitle: {
    fontSize: 15,
  },
  sheetActionHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  dangerActionButton: {
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetCancelButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
