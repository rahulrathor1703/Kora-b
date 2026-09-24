export function normalizeMailboxPassword(password: string): string {
  return password.trim().replace(/[\s-]/g, '');
}

export function normalizeAppPassword(password: string): string {
  return normalizeMailboxPassword(password).toLowerCase();
}
