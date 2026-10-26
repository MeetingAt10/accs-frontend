import { queryOptions } from '@tanstack/react-query'

import { getDemoAccounts, getPage, getSession } from './api'

export const sessionQuery = () =>
  queryOptions({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
    staleTime: 30_000,
  })

export const demoAccountsQuery = () =>
  queryOptions({
    queryKey: ['demo-accounts'],
    queryFn: getDemoAccounts,
    staleTime: 60_000,
  })

export const pageQuery = (pageId: string, recordId?: string, filters = '') =>
  queryOptions({
    queryKey: ['page', pageId, recordId, filters],
    queryFn: () => getPage(pageId, recordId, filters),
    retry: false,
  })
