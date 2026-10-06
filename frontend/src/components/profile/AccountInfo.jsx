import { useState, useRef, useEffect } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { patchProfile, uploadAvatar } from "../../auth/profileService";
import { useAuth } from "../../auth/AuthContext";
import { getAvatarUrl } from "../../utils/avatarUrl";

/**
 * AccountInfo — avatar, editable name, read-only email.
 *
 * Props:
 *   profile  { name, email, avatar_url }
 *   onSaved  (updatedProfile) => void
 *   showToast (msg) => void
 */
export default function AccountInfo({ profile, onSaved, showToast }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef(null);

  const avatarUrl = getAvatarUrl(profile?.avatar_url);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const initials = (profile?.name || profile?.email || "?")
    .charAt(0)
    .toUpperCase();


  // ── Name save ────────────────────────────────────────────────────
  async function handleSaveName(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await patchProfile({ 
        name: name.trim(),
        job_title: jobTitle.trim(),
        location: location.trim(),
        bio: bio.trim()
      });
      onSaved(updated);
      await refreshUser(); // Update global user state (navbars)
      showToast("Name updated successfully.");
    } catch {
      showToast("Failed to update name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Avatar upload ─────────────────────────────────────────────────
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      const result = await uploadAvatar(file);
      onSaved({ ...profile, avatar_url: result.avatar_url });
      await refreshUser(); // Update global user state (navbars)
      showToast("Avatar updated.");
    } catch (err) {
      const msg = err?.response?.data?.detail ?? "Avatar upload failed.";
      showToast(msg);
    } finally {
      setAvatarLoading(false);
      e.target.value = "";
    }
  }

  // ── Avatar remove ─────────────────────────────────────────────────
  async function handleRemoveAvatar() {
    setAvatarLoading(true);
    try {
      // avatar: null tells PATCH /api/me to clear the field
      const updated = await patchProfile({ avatar: null });
      onSaved({ ...profile, avatar_url: null });
      await refreshUser(); // Update global user state (navbars)
      showToast("Avatar removed.");
    } catch {
      showToast("Failed to remove avatar.");
    } finally {
      setAvatarLoading(false);
    }
  }

  return (
    <section className="signal-card p-5 sm:p-7">
      <h2 className="text-lg font-semibold text-ink mb-1">Account</h2>
      <p className="text-sm text-muted mb-6">
        Your name is visible across the product. Email cannot be changed.
      </p>

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative">
          {avatarUrl && !imgError ? (
            <img
              src={avatarUrl}
              alt="Your avatar"
              onError={() => setImgError(true)}
              className="h-20 w-20 rounded-full object-cover ring-4 ring-surface shadow-[var(--shadow-card)]"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-signal-soft text-2xl font-semibold text-signal ring-4 ring-surface shadow-[var(--shadow-card)]"
            >
              {initials}
            </div>
          )}

          {avatarLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 size={20} className="animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-secondary"
            disabled={avatarLoading}
          >
            <Camera size={14} />
            Upload photo
          </button>

          {profile?.avatar_url && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="flex items-center gap-1 text-xs text-muted hover:text-flagged transition-colors"
              disabled={avatarLoading}
            >
              <X size={12} />
              Remove
            </button>
          )}
          <p className="text-[11px] text-muted">
            JPG, PNG, or WebP · Max 2 MB
          </p>
        </div>
      </div>

      {/* Name form */}
      <form onSubmit={handleSaveName} className="flex flex-col gap-4 max-w-sm">
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            className="field"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            Email address
          </label>
          {/* Email is read-only — no edit affordance in this phase */}
          <div className="field !bg-paper text-muted select-none cursor-not-allowed">
            {profile?.email}
          </div>
          <p className="mt-1 text-[11px] text-muted">Email cannot be changed.</p>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            Job title
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            maxLength={100}
            placeholder="e.g. Senior Software Engineer"
            className="field"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            placeholder="e.g. San Francisco, CA"
            className="field"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="A little bit about yourself..."
            className="field"
          />
        </div>

        <div>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 size={14} className="spin" /> : null}
            Save changes
          </button>
        </div>
      </form>
    </section>
  );
}
