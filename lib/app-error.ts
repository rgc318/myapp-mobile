export type AppErrorKind =
  | 'validation'
  | 'permission'
  | 'authentication'
  | 'network'
  | 'unknown';

export type AppError = {
  kind: AppErrorKind;
  message: string;
};

function inferErrorKind(message: string): AppErrorKind {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('不能为空') ||
    normalized.includes('不存在') ||
    normalized.includes('invalid') ||
    normalized.includes('校验')
  ) {
    return 'validation';
  }

  if (
    normalized.includes('csrf') ||
    normalized.includes('无权限') ||
    normalized.includes('permission') ||
    normalized.includes('forbidden')
  ) {
    return 'permission';
  }

  if (
    normalized.includes('登录') ||
    normalized.includes('认证') ||
    normalized.includes('unauthorized') ||
    normalized.includes('authentication')
  ) {
    return 'authentication';
  }

  if (
    normalized.includes('网络') ||
    normalized.includes('连接') ||
    normalized.includes('cors')
  ) {
    return 'network';
  }

  return 'unknown';
}

export function normalizeAppError(error: unknown, fallback = '操作失败，请稍后重试。'): AppError {
  if (error instanceof Error) {
    const message = error.message?.trim() || fallback;
    return {
      kind: inferErrorKind(message),
      message,
    };
  }

  if (typeof error === 'string' && error.trim()) {
    return {
      kind: inferErrorKind(error),
      message: error.trim(),
    };
  }

  return {
    kind: 'unknown',
    message: fallback,
  };
}
