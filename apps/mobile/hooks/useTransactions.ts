import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryTransactions } from '../lib/database';
import { currentYearMonth } from '../lib/transactionUtils';

export function useTransactions(month?: string) {
  const m = month ?? currentYearMonth();
  return useQuery({
    queryKey: ['transactions', m],
    queryFn: () => queryTransactions(m),
  });
}

export function useInvalidateTransactions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['transactions'] });
}
