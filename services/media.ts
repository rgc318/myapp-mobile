import { callGatewayMethod } from '@/lib/api-client';
import { resolveMediaUrl } from '@/lib/media-url';

export type UploadedItemImage = {
  aspectRatio: number | null;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  fileId: string | null;
  isPrivate: boolean;
  attachedToDoctype: string | null;
  attachedToName: string | null;
  storageProvider: string | null;
  contentType: string | null;
  height: number | null;
  profile: string | null;
  quality: number | null;
  sourceFormat: string | null;
  sourceHeight: number | null;
  sourceWidth: number | null;
  width: number | null;
};

export type DeletedItemImage = {
  itemCode: string;
  previousFileUrl: string | null;
  deleted: boolean;
  reason: string | null;
};

export type UploadItemImagePayload = {
  filename: string;
  fileContentBase64: string;
  contentType?: string | null;
  itemCode?: string | null;
  isPrivate?: boolean;
};

function mapUploadedItemImage(data: Record<string, unknown>): UploadedItemImage {
  return {
    aspectRatio: typeof data.aspect_ratio === 'number' ? data.aspect_ratio : null,
    fileUrl: resolveMediaUrl(typeof data.file_url === 'string' ? data.file_url : ''),
    fileName: typeof data.file_name === 'string' ? data.file_name : null,
    fileSize: typeof data.file_size === 'number' ? data.file_size : null,
    fileId: typeof data.file_id === 'string' ? data.file_id : null,
    isPrivate: Boolean(data.is_private),
    attachedToDoctype: typeof data.attached_to_doctype === 'string' ? data.attached_to_doctype : null,
    attachedToName: typeof data.attached_to_name === 'string' ? data.attached_to_name : null,
    storageProvider: typeof data.storage_provider === 'string' ? data.storage_provider : null,
    contentType: typeof data.content_type === 'string' ? data.content_type : null,
    height: typeof data.height === 'number' ? data.height : null,
    profile: typeof data.profile === 'string' ? data.profile : null,
    quality: typeof data.quality === 'number' ? data.quality : null,
    sourceFormat: typeof data.source_format === 'string' ? data.source_format : null,
    sourceHeight: typeof data.source_height === 'number' ? data.source_height : null,
    sourceWidth: typeof data.source_width === 'number' ? data.source_width : null,
    width: typeof data.width === 'number' ? data.width : null,
  };
}

export async function uploadItemImage(payload: UploadItemImagePayload): Promise<UploadedItemImage> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.upload_item_image', {
    filename: payload.filename,
    file_content_base64: payload.fileContentBase64,
    content_type: payload.contentType,
    item_code: payload.itemCode,
    is_private: payload.isPrivate ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    throw new Error('商品图片上传失败');
  }

  return mapUploadedItemImage(data);
}

export async function replaceItemImage(payload: UploadItemImagePayload & { itemCode: string }): Promise<UploadedItemImage> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.replace_item_image', {
    item_code: payload.itemCode,
    filename: payload.filename,
    file_content_base64: payload.fileContentBase64,
    content_type: payload.contentType,
    is_private: payload.isPrivate ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    throw new Error('商品图片替换失败');
  }

  return mapUploadedItemImage(data);
}

export async function deleteItemImage(itemCode: string): Promise<DeletedItemImage> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.delete_item_image', {
    item_code: itemCode,
  });

  if (!data || typeof data !== 'object') {
    throw new Error('商品图片删除失败');
  }

  return {
    itemCode: typeof data.item_code === 'string' ? data.item_code : itemCode,
    previousFileUrl: typeof data.previous_file_url === 'string' ? data.previous_file_url : null,
    deleted: Boolean(data.deleted),
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}
