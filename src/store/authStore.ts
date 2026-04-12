import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FamilyUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'parent' | 'child' | null;
  ageTier?: string;
}

interface AuthStore {
  user: FamilyUser | null;
  loading: boolean;
  setUser: (user: FamilyUser | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'certainid-family-auth',
      partialize: (state) =>
        state.user
          ? {
              user: {
                uid: state.user.uid,
                email: state.user.email,
                displayName: state.user.displayName,
                role: state.user.role,
                ageTier: state.user.ageTier,
              },
            }
          : { user: null },
    }
  )
);
