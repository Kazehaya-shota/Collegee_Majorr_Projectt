'use client';

import { useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

/* Clerk returns a remote, user-owned profile image URL. */
/* eslint-disable @next/next/no-img-element */

type ProfileAvatarUploadProps = {
  fallback: string;
  initialImageUrl?: string | null;
};

const PHOTO_SIZE = 400;

async function makeProfilePhoto(file: File) {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('This image could not be opened.'));
      image.src = sourceUrl;
    });
    const cropSize = Math.min(source.naturalWidth, source.naturalHeight);
    const cropX = (source.naturalWidth - cropSize) / 2;
    const cropY = (source.naturalHeight - cropSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.drawImage(source, cropX, cropY, cropSize, cropSize, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!imageBlob) throw new Error('Your browser could not prepare this image.');
    return new File([imageBlob], 'varen-profile.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function ProfileAvatarUpload({ fallback, initialImageUrl }: ProfileAvatarUploadProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('Click to change photo');
  const [isSaving, setIsSaving] = useState(false);
  const imageUrl = previewUrl ?? user?.imageUrl ?? initialImageUrl;

  async function updatePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      setMessage('Please choose an image file.');
      return;
    }
    if (selectedFile.size > 12 * 1024 * 1024) {
      setMessage('Choose an image smaller than 12 MB.');
      return;
    }
    if (!user) {
      setMessage('Your account is still loading. Please try again.');
      return;
    }

    setIsSaving(true);
    setMessage('Preparing your 400 × 400 photo…');
    try {
      const profilePhoto = await makeProfilePhoto(selectedFile);
      const nextPreview = URL.createObjectURL(profilePhoto);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextPreview;
      });
      setMessage('Saving your new photo…');
      await user.setProfileImage({ file: profilePhoto });
      setMessage('Profile photo updated');
      router.refresh();
    } catch (error) {
      console.error('Profile image update failed', error);
      setMessage(error instanceof Error ? error.message : 'We could not save that photo. Try another image.');
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="profile-photo-control">
    <div className="profile-avatar profile-avatar-upload">
      {imageUrl ? <img src={imageUrl} alt="" /> : fallback}
      <button className="profile-avatar-camera" type="button" onClick={() => inputRef.current?.click()} disabled={!isLoaded || isSaving} aria-label={isSaving ? message : 'Change profile photo'}>
        <span aria-hidden="true">{isSaving ? '…' : '📷'}</span>
      </button>
    </div>
    <input ref={inputRef} className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={updatePhoto} />
    <span className="profile-photo-status" aria-live="polite">{message}</span>
  </div>;
}
