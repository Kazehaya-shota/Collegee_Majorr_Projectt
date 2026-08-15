'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type ProfileNameEditorProps = {
  initialName: string;
};

export function ProfileNameEditor({ initialName }: ProfileNameEditorProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const displayName = user?.fullName || user?.username || initialName;

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setMessage('Enter a name to save it.');
      return;
    }
    if (!user) {
      setMessage('Your account is still loading. Please try again.');
      return;
    }
    const [firstName, ...lastNameParts] = trimmedName.split(' ');
    setIsSaving(true);
    setMessage('');
    try {
      await user.update({ firstName, lastName: lastNameParts.join(' ') || null });
      setName(trimmedName);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('Profile name update failed', error);
      setMessage('We could not save your name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return <form className="profile-name-form" onSubmit={saveName}>
      <label htmlFor="profile-name">Your name</label>
      <div><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus /><button type="submit" disabled={!isLoaded || isSaving}>{isSaving ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => { setName(displayName); setMessage(''); setIsEditing(false); }} disabled={isSaving}>Cancel</button></div>
      {message && <small role="alert">{message}</small>}
    </form>;
  }

  return <div className="profile-name-row"><h1>{displayName}</h1><button type="button" onClick={() => { setName(displayName); setMessage(''); setIsEditing(true); }} aria-label="Edit your name" title="Edit your name">✎</button></div>;
}
