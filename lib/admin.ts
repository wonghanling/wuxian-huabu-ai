// 管理员邮箱列表，所有管理员权限判断都从这里读取
export const ADMIN_EMAILS = [
  '1825221780@qq.com',
  '3866855423@qq.com',
  '1796370017@qq.com',
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}
