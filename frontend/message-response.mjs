const uploadErrors = {
  413: '上传请求超过服务器或反向代理的大小限制',
  502: '网关未能连接到聊天室后端',
  503: '聊天室服务暂时不可用',
  504: '网关等待聊天室后端响应超时，请先查看消息是否已经送达'
};

export async function checkMessageResponse(response) {
  let result;
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'application/json') {
    try {
      result = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  if (!response.ok) {
    const detail = typeof result?.error === 'string' && result.error;
    throw new Error((detail || uploadErrors[response.status] || '发送失败') + '（HTTP ' + response.status + '）');
  }
  if (!Number.isSafeInteger(result?.id) || result.id <= 0) {
    throw new Error('未收到聊天室的发送回执（HTTP ' + response.status + '），请先查看消息是否已经送达');
  }
}
