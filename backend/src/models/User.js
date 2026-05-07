function normalizePhone(value) {
  return (value || "").toString().trim();
}

export function isSuperAdminPhone(phone) {
  const superAdminPhone = normalizePhone(process.env.SUPER_ADMIN);
  if (!superAdminPhone) return false;
  return normalizePhone(phone) === superAdminPhone;
}

export function computeIsAdmin(userDoc) {
  if (!userDoc) return false;
  if (Boolean(userDoc.is_admin)) return true;
  const phone = userDoc.phone || userDoc.mobile || "";
  return isSuperAdminPhone(phone);
}

export function publicUserPayload(userDoc, { settings = null } = {}) {
  if (!userDoc) return null;

  return {
    id: userDoc.id,
    name: userDoc.name,
    email: userDoc.email,
    mobile: userDoc.mobile,
    phone: userDoc.phone || userDoc.mobile || null,
    avatar_url: userDoc.avatar_url,
    about_bio: userDoc.about_bio || "",
    status: userDoc.status,
    last_seen: userDoc.last_seen,
    is_verified: Boolean(userDoc.is_verified),
    auth_provider: userDoc.auth_provider || "local",
    generated_password: userDoc.generated_password_plain || null,
    settings,
    isAdmin: computeIsAdmin(userDoc),
    publicKey: userDoc.public_key || null
  };
}

