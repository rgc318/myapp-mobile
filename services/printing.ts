import { callGatewayMethod } from '@/lib/api-client';
import { loadStoredToken } from '@/lib/auth-storage';
import { getApiBaseUrl } from '@/lib/config';
import { buildFrappeHeaders } from '@/lib/frappe-http';

export type PrintTemplateOption = {
  key: string;
  label: string;
  printFormat: string | null;
  isDefault: boolean;
  source: string;
};

export type PrintPreviewData = {
  doctype: string;
  docname: string;
  title: string;
  template: PrintTemplateOption;
  availableTemplates: PrintTemplateOption[];
  output: 'html' | 'pdf';
  html: string;
  mimeType: string;
};

export type PrintFileData = {
  doctype: string;
  docname: string;
  title: string;
  template: PrintTemplateOption;
  availableTemplates: PrintTemplateOption[];
  output: 'pdf';
  filename: string;
  mimeType: string;
  fileUrl: string | null;
  isPrivate: boolean;
  status: string;
  fileSize: number;
};

function mapTemplateOption(value: unknown): PrintTemplateOption | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const key = typeof row.key === 'string' ? row.key : '';
  if (!key) {
    return null;
  }

  return {
    key,
    label: typeof row.label === 'string' ? row.label : key,
    printFormat: typeof row.print_format === 'string' ? row.print_format : null,
    isDefault: Boolean(row.is_default),
    source: typeof row.source === 'string' ? row.source : 'unknown',
  };
}

function mapTemplateList(value: unknown) {
  return Array.isArray(value) ? value.map(mapTemplateOption).filter((item): item is PrintTemplateOption => Boolean(item)) : [];
}

export async function fetchPrintPreview(params: {
  doctype: string;
  docname: string;
  template?: string | null;
  output?: 'html' | 'pdf';
}): Promise<PrintPreviewData> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.get_print_preview_v1', {
    doctype: params.doctype,
    docname: params.docname,
    template: params.template ?? undefined,
    output: params.output ?? 'html',
  });

  const template = mapTemplateOption(data.template) ?? {
    key: 'unknown',
    label: '未命名模板',
    printFormat: null,
    isDefault: false,
    source: 'unknown',
  };

  return {
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    docname: typeof data.docname === 'string' ? data.docname : params.docname,
    title: typeof data.title === 'string' ? data.title : `${params.doctype} ${params.docname}`,
    template,
    availableTemplates: mapTemplateList(data.available_templates),
    output: data.output === 'pdf' ? 'pdf' : 'html',
    html: typeof data.html === 'string' ? data.html : '',
    mimeType: typeof data.mime_type === 'string' ? data.mime_type : 'text/html',
  };
}

export async function fetchPrintFile(params: {
  doctype: string;
  docname: string;
  template?: string | null;
  filename?: string | null;
}): Promise<PrintFileData> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.get_print_file_v1', {
    doctype: params.doctype,
    docname: params.docname,
    template: params.template ?? undefined,
    filename: params.filename ?? undefined,
  });

  const template = mapTemplateOption(data.template) ?? {
    key: 'unknown',
    label: '未命名模板',
    printFormat: null,
    isDefault: false,
    source: 'unknown',
  };

  return {
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    docname: typeof data.docname === 'string' ? data.docname : params.docname,
    title: typeof data.title === 'string' ? data.title : `${params.doctype} ${params.docname}`,
    template,
    availableTemplates: mapTemplateList(data.available_templates),
    output: 'pdf',
    filename: typeof data.filename === 'string' ? data.filename : `${params.docname}.pdf`,
    mimeType: typeof data.mime_type === 'string' ? data.mime_type : 'application/pdf',
    fileUrl: typeof data.file_url === 'string' ? data.file_url : null,
    isPrivate: Boolean(data.is_private),
    status: typeof data.status === 'string' ? data.status : 'unknown',
    fileSize: typeof data.file_size === 'number' ? data.file_size : 0,
  };
}

export async function downloadPrintFile(params: {
  doctype: string;
  docname: string;
  template?: string | null;
  filename?: string | null;
}): Promise<Uint8Array> {
  const authToken = loadStoredToken();
  const response = await fetch(`${getApiBaseUrl()}/api/method/myapp.api.gateway.download_print_file_v1`, {
    method: 'POST',
    headers: buildFrappeHeaders({
      authToken,
      contentType: 'application/json',
    }),
    credentials: 'include',
    body: JSON.stringify({
      doctype: params.doctype,
      docname: params.docname,
      template: params.template ?? undefined,
      filename: params.filename ?? undefined,
    }),
  });

  if (!response.ok) {
    throw new Error('下载打印文件失败。');
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
