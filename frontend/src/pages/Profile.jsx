import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  name: z.string().min(2, 'Name is too short').max(60, 'Name is too long'),
  email: z.string().email('Enter a valid email'),
});

export default function Profile() {
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  useEffect(() => {
    reset({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user, reset]);

  async function onSubmit() {
    toast('Profile update API not added yet');
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Profile</h2>
      <div className="muted" style={{ marginBottom: 12 }}>
        View your account details. (Editing requires a backend endpoint.)
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 10 }}>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Name</div>
          <input className="input" placeholder="Your name" {...register('name')} />
          {errors.name ? <div style={{ color: 'var(--danger)', marginTop: 6 }}>{errors.name.message}</div> : null}
        </div>

        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Email</div>
          <input className="input" placeholder="you@example.com" {...register('email')} />
          {errors.email ? <div style={{ color: 'var(--danger)', marginTop: 6 }}>{errors.email.message}</div> : null}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="button" type="submit" disabled={isSubmitting}>Save changes</button>
          <div className="muted" style={{ fontSize: 12 }}>Coming soon</div>
        </div>
      </form>
    </div>
  );
}
