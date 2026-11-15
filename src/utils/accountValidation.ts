export const USERNAME_REGEX = /^[a-z0-9._-]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const normalized = normalizeUsername(raw);
  if (normalized.length < 3 || normalized.length > 24) {
    return 'Username must be 3–24 characters.';
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return 'Use only letters, numbers, dots (.), underscores (_), or hyphens (-).';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) {
    return 'Password is too long (max 200 characters).';
  }
  return null;
}

export function mapAuthError(message: string): string {
  const msg = (message || '').trim();
  if (/already registered|user already exists/i.test(msg)) {
    return 'This email is already registered.';
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'Wrong username/email or password.';
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Please confirm your email address first.';
  }
  if (/rate limit|too many|429/i.test(msg)) {
    return 'Too many attempts. Please try again later.';
  }
  if (/password.*(short|least|characters)/i.test(msg)) {
    return 'Password must be at least 8 characters.';
  }
  if (/username_taken|duplicate key|profiles_username_key|profiles_pkey/i.test(msg)) {
    return 'This username is already taken.';
  }
  if (/invalid_username/i.test(msg)) {
    return 'Use 3–24 characters: letters, numbers, dots (.), underscores (_), or hyphens (-).';
  }
  if (/not_authenticated/i.test(msg)) {
    return 'Your session expired. Please log in again.';
  }
  if (/profile_not_found/i.test(msg)) {
    return 'Could not find your profile. Please log out and log in again.';
  }
  if (/new password should be different/i.test(msg)) {
    return 'Please choose a different password from your current one.';
  }
  if (/expired|invalid.*token|otp_expired/i.test(msg)) {
    return 'This reset link has expired. Please request a new one.';
  }
  if (/unable to validate email|invalid email/i.test(msg)) {
    return 'Please enter a valid email address.';
  }
  if (/failed to fetch|networkerror|network request failed/i.test(msg)) {
    return 'Network error. Please check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
