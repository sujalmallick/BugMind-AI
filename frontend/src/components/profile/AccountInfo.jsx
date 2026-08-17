import { useState, useRef } from "react";
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
  const fileRef = useRef(null);

  const avatarUrl = getAvatarUrl(profile?.avatar_url);

  const initials = (profile?.name || profile?.email || "?")
    .charAt(0)
    .toUpperCase();

  // Deterministic hue from user id so initials circle is always the same colour
  const hue = ((profile?.id ?? 0) * 53) % 360;
  const initialsStyle = { background: `hsl(${hue},55%,48%)` };

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
    <section className="signal-card p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-ink mb-1">Account</h2>
      <p className="text-sm text-muted mb-6">
        Your name is visible across the product. Email cannot be changed.
      </p>

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Your avatar"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-hairline"
            />
          ) : (
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ring-2 ring-hairline"
              style={initialsStyle}
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
            className="btn-secondary flex items-center gap-2 text-sm"
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Email address
          </label>
          {/* Email is read-only — no edit affordance in this phase */}
          <div className="w-full rounded-lg border border-hairline bg-paper px-3 py-2.5 text-sm text-muted select-none cursor-not-allowed">
            {profile?.email}
          </div>
          <p className="mt-1 text-[11px] text-muted">Email cannot be changed.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Job Title
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            maxLength={100}
            placeholder="e.g. Senior Software Engineer"
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            placeholder="e.g. San Francisco, CA"
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="A little bit about yourself..."
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 resize-none"
          />
        </div>

        <div>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </form>
    </section>
  );
}
