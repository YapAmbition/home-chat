// Both JavaScript string length and textarea maxLength use UTF-16 code units.
export const MAX_MESSAGE_LENGTH = 100_000;
export const MESSAGE_TOO_LONG = '消息太长，最多支持 100,000 个文本长度单位（普通汉字计 1，部分表情计 2），请拆分发送或作为文本文件上传';
