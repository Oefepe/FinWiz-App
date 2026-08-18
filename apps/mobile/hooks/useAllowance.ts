import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateAllowance } from '@finwiz/allowance-engine';
import { getAllowanceConfig, queryAllowanceTransactions } from '../lib/database';
import { currentYearMonth } from '../lib/transactionUtils';

export function useAllowance() {
  const month = currentYearMonth();
  return useQuery({
    queryKey: ['allowance', month],
    queryFn: async () => {
      const config = await getAllowanceConfig();
      const txs = await queryAllowanceTransactions(month);
      return calculateAllowance({ ...config, transactions: txs });
    },
  });
}

export function useInvalidateAllowance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['allowance'] });
}
