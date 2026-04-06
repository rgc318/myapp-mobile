import { callGatewayMethod } from '@/lib/api-client';

export type UploadedItemImage = {
  fileUrl: string;
  fileName: string | null;
  fileId: string | null;
  isPrivate: boolean;
  attachedToDoctype: string | null;
  attachedToName: string | null;
  storageProvider: string | null;
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
    fileUrl: typeof data.file_url === 'string' ? data.file_url : '',
    fileName: typeof data.file_name === 'string' ? data.file_name : null,
    fileId: typeof data.file_id === 'string' ? data.file_id : null,
    isPrivate: Boolean(data.is_private),
    attachedToDoctype: typeof data.attached_to_doctype === 'string' ? data.attached_to_doctype : null,
    attachedToName: typeof data.attached_to_name === 'string' ? data.attached_to_name : null,
    storageProvider: typeof data.storage_provider === 'string' ? data.storage_provider : null,
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
