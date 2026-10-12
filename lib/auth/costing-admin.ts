export function isCostingAdmin(email: string | undefined): boolean {
  const allowed = (process.env.COSTING_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && allowed.includes(email.trim().toLowerCase()));
}
