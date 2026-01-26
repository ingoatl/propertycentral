// Centralized Query Keys Factory for React Query
// Prevents key collisions and enables smart cache invalidation

export const queryKeys = {
  // Properties domain
  properties: {
    all: ['properties'] as const,
    list: () => [...queryKeys.properties.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.properties.all, 'detail', id] as const,
    byOwner: (ownerId: string) => [...queryKeys.properties.all, 'owner', ownerId] as const,
    active: () => [...queryKeys.properties.all, 'active'] as const,
  },

  // Communications domain
  communications: {
    all: ['communications'] as const,
    inbox: (userId?: string) => [...queryKeys.communications.all, 'inbox', userId] as const,
    thread: (contactId: string) => [...queryKeys.communications.all, 'thread', contactId] as const,
    unread: () => [...queryKeys.communications.all, 'unread'] as const,
    byProperty: (propertyId: string) => [...queryKeys.communications.all, 'property', propertyId] as const,
  },

  // Leads domain
  leads: {
    all: ['leads'] as const,
    list: () => [...queryKeys.leads.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.leads.all, 'detail', id] as const,
    byStatus: (status: string) => [...queryKeys.leads.all, 'status', status] as const,
  },

  // Owners domain
  owners: {
    all: ['owners'] as const,
    list: () => [...queryKeys.owners.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.owners.all, 'detail', id] as const,
    withProperties: () => [...queryKeys.owners.all, 'with-properties'] as const,
  },

  // Bookings domain
  bookings: {
    all: ['bookings'] as const,
    list: () => [...queryKeys.bookings.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.bookings.all, 'detail', id] as const,
    byProperty: (propertyId: string) => [...queryKeys.bookings.all, 'property', propertyId] as const,
    upcoming: () => [...queryKeys.bookings.all, 'upcoming'] as const,
  },

  // Tasks/Onboarding domain
  tasks: {
    all: ['tasks'] as const,
    byProject: (projectId: string) => [...queryKeys.tasks.all, 'project', projectId] as const,
    detail: (id: string) => [...queryKeys.tasks.all, 'detail', id] as const,
  },

  // Expenses domain
  expenses: {
    all: ['expenses'] as const,
    byProperty: (propertyId: string) => [...queryKeys.expenses.all, 'property', propertyId] as const,
    byMonth: (month: string) => [...queryKeys.expenses.all, 'month', month] as const,
  },

  // Work Orders domain
  workOrders: {
    all: ['work-orders'] as const,
    list: () => [...queryKeys.workOrders.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.workOrders.all, 'detail', id] as const,
    byProperty: (propertyId: string) => [...queryKeys.workOrders.all, 'property', propertyId] as const,
  },

  // User/Profile domain
  user: {
    profile: (userId: string) => ['user', 'profile', userId] as const,
    roles: (userId: string) => ['user', 'roles', userId] as const,
    preferences: (userId: string) => ['user', 'preferences', userId] as const,
  },

  // Static/Reference data
  static: {
    templates: () => ['static', 'templates'] as const,
    roles: () => ['static', 'roles'] as const,
    amenities: () => ['static', 'amenities'] as const,
  },
} as const;

// Query configuration presets for different data types
export const queryConfig = {
  // Real-time data - short stale time
  realtime: {
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  },

  // Standard data - moderate caching
  standard: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  },

  // Static data - aggressive caching
  static: {
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
  },

  // User-specific data
  user: {
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: true,
  },
} as const;
