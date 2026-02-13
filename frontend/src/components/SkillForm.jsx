import { useEffect, useState } from 'react';

export default function SkillForm({
  initialTitle = '',
  initialDescription = '',
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isSubmitting = false,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => setTitle(initialTitle), [initialTitle]);
  useEffect(() => setDescription(initialDescription), [initialDescription]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.({ title, description });
      }}
      style={{ display: 'grid', gap: 10 }}
    >
      <div>
        <div className="muted" style={{ marginBottom: 6 }}>Title</div>
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 6 }}>Description</div>
        <textarea
          className="input"
          placeholder="Description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button" type="submit" disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
