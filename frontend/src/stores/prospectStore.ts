import { create } from 'zustand';

interface Prospect {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  industry: string;
  location: string;
  score: number;
  verified: boolean;
  data_source: string;
  created_at: string;
}

interface ProspectState {
  prospects: Prospect[];
  selectedProspects: string[];
  filters: {
    search: string;
    industry: string;
    location: string;
    verified: boolean | null;
  };
  isLoading: boolean;
  
  // Actions
  setProspects: (prospects: Prospect[]) => void;
  addProspect: (prospect: Prospect) => void;
  updateProspect: (id: string, prospect: Partial<Prospect>) => void;
  removeProspect: (id: string) => void;
  setSelectedProspects: (ids: string[]) => void;
  toggleProspectSelection: (id: string) => void;
  setFilters: (filters: Partial<ProspectState['filters']>) => void;
  setLoading: (loading: boolean) => void;
  clearSelection: () => void;
}

export const useProspectStore = create<ProspectState>((set, get) => ({
  prospects: [],
  selectedProspects: [],
  filters: {
    search: '',
    industry: '',
    location: '',
    verified: null,
  },
  isLoading: false,
  
  setProspects: (prospects) => set({ prospects }),
  
  addProspect: (prospect) => 
    set((state) => ({ prospects: [...state.prospects, prospect] })),
  
  updateProspect: (id, updatedProspect) =>
    set((state) => ({
      prospects: state.prospects.map((prospect) =>
        prospect.id === id ? { ...prospect, ...updatedProspect } : prospect
      ),
    })),
  
  removeProspect: (id) =>
    set((state) => ({
      prospects: state.prospects.filter((prospect) => prospect.id !== id),
      selectedProspects: state.selectedProspects.filter((prospectId) => prospectId !== id),
    })),
  
  setSelectedProspects: (ids) => set({ selectedProspects: ids }),
  
  toggleProspectSelection: (id) =>
    set((state) => ({
      selectedProspects: state.selectedProspects.includes(id)
        ? state.selectedProspects.filter((prospectId) => prospectId !== id)
        : [...state.selectedProspects, id],
    })),
  
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  clearSelection: () => set({ selectedProspects: [] }),
}));