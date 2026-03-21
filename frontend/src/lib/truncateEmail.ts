export function truncateEmail(email: string | null | undefined, max = 22): string {
  if (!email) return "";
  return email.length <= max ? email : `${email.slice(0, max - 1)}…`;
}
