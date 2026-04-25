/**
 * Bank Transaction Matching Logic
 * 
 * Matches bank transactions to ledger transactions using:
 * - Amount matching (with tolerance)
 * - Date matching (with tolerance)
 * - Payee/memo matching
 * - Reference matching
 */

import { Prisma } from '@prisma/client';
type Decimal = Prisma.Decimal;

export interface BankTransaction {
  id: string;
  date: Date;
  amount: Decimal;
  description: string;
  payee?: string;
  memo?: string;
  reference?: string;
}

export interface LedgerTransaction {
  id: string;
  date: Date;
  debit: Decimal;
  credit: Decimal;
  description: string;
  reference?: string;
  accountId: string;
}

export interface MatchRule {
  amountTolerance?: number; // Percentage tolerance (e.g., 0.01 = 1%)
  dateToleranceDays?: number; // Days before/after
  requirePayeeMatch?: boolean;
  requireMemoMatch?: boolean;
  requireReferenceMatch?: boolean;
}

export interface MatchResult {
  transaction: LedgerTransaction;
  score: number; // 0-100 confidence score
  matchType: 'exact' | 'amount' | 'date' | 'reference' | 'partial';
  reasons: string[];
}

export interface MatchSuggestion {
  bankTransaction: BankTransaction;
  matches: MatchResult[];
  bestMatch?: MatchResult;
}

/**
 * Match bank transaction to ledger transactions
 */
export function matchBankTransaction(
  bankTx: BankTransaction,
  ledgerTxs: LedgerTransaction[],
  rules: MatchRule = {}
): MatchResult[] {
  const {
    amountTolerance = 0.01, // 1% default
    dateToleranceDays = 7, // 7 days default
    requirePayeeMatch = false,
    requireMemoMatch = false,
    requireReferenceMatch = false,
  } = rules;

  const matches: MatchResult[] = [];
  const bankAmount = bankTx.amount.abs();
  const isDebit = bankTx.amount.lessThan(0); // Negative = debit (withdrawal)

  for (const ledgerTx of ledgerTxs) {
    const ledgerAmount = isDebit ? ledgerTx.debit : ledgerTx.credit;
    
    // Skip if amount is zero
    if (ledgerAmount.equals(0)) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];
    let matchType: MatchResult['matchType'] = 'partial';

    // Amount matching (weight: 40 points)
    const amountDiff = bankAmount.minus(ledgerAmount).abs();
    const amountPercentDiff = amountDiff.dividedBy(bankAmount).toNumber();
    
    if (amountDiff.equals(0)) {
      score += 40;
      reasons.push('Exact amount match');
      matchType = 'exact';
    } else if (amountPercentDiff <= amountTolerance) {
      score += 30;
      reasons.push(`Amount within ${(amountTolerance * 100).toFixed(1)}% tolerance`);
      matchType = 'amount';
    } else {
      // Partial match (less weight)
      const partialMatch = bankAmount.greaterThan(ledgerAmount) 
        ? ledgerAmount.dividedBy(bankAmount).toNumber()
        : bankAmount.dividedBy(ledgerAmount).toNumber();
      
      if (partialMatch >= 0.5) {
        score += 20 * partialMatch;
        reasons.push(`Partial amount match (${(partialMatch * 100).toFixed(1)}%)`);
        matchType = 'partial';
      } else {
        continue; // Amount too different, skip
      }
    }

    // Date matching (weight: 30 points)
    const dateDiff = Math.abs(
      (bankTx.date.getTime() - ledgerTx.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (dateDiff === 0) {
      score += 30;
      reasons.push('Exact date match');
    } else if (dateDiff <= dateToleranceDays) {
      score += 25 * (1 - dateDiff / dateToleranceDays);
      reasons.push(`Date within ${dateDiff} days`);
    } else {
      // Date too far, reduce score
      score *= 0.5;
      reasons.push(`Date ${dateDiff} days apart (outside tolerance)`);
    }

    // Reference matching (weight: 20 points)
    if (bankTx.reference && ledgerTx.reference) {
      if (bankTx.reference === ledgerTx.reference) {
        score += 20;
        reasons.push('Exact reference match');
        matchType = 'reference';
      } else if (
        bankTx.reference.includes(ledgerTx.reference) ||
        ledgerTx.reference.includes(bankTx.reference)
      ) {
        score += 10;
        reasons.push('Partial reference match');
      }
    }

    // Payee matching (weight: 5 points)
    if (bankTx.payee && ledgerTx.description) {
      const payeeLower = bankTx.payee.toLowerCase();
      const descLower = ledgerTx.description.toLowerCase();
      
      if (descLower.includes(payeeLower) || payeeLower.includes(descLower)) {
        score += 5;
        reasons.push('Payee/description match');
      }
    } else if (requirePayeeMatch && !bankTx.payee) {
      continue; // Required but missing
    }

    // Memo matching (weight: 5 points)
    if (bankTx.memo && ledgerTx.description) {
      const memoLower = bankTx.memo.toLowerCase();
      const descLower = ledgerTx.description.toLowerCase();
      
      if (descLower.includes(memoLower) || memoLower.includes(descLower)) {
        score += 5;
        reasons.push('Memo/description match');
      }
    } else if (requireMemoMatch && !bankTx.memo) {
      continue; // Required but missing
    }

    // Reference requirement check
    if (requireReferenceMatch && (!bankTx.reference || !ledgerTx.reference)) {
      continue; // Required but missing
    }

    // Only include matches with score > 0
    if (score > 0) {
      matches.push({
        transaction: ledgerTx,
        score: Math.min(100, score), // Cap at 100
        matchType,
        reasons,
      });
    }
  }

  // Sort by score (highest first)
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Suggest matches for multiple bank transactions
 */
export function suggestMatches(
  bankTransactions: BankTransaction[],
  ledgerTransactions: LedgerTransaction[],
  rules: MatchRule = {}
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];

  for (const bankTx of bankTransactions) {
    const matches = matchBankTransaction(bankTx, ledgerTransactions, rules);
    
    suggestions.push({
      bankTransaction: bankTx,
      matches,
      bestMatch: matches.length > 0 ? matches[0] : undefined,
    });
  }

  return suggestions;
}

/**
 * Calculate reconciliation balance
 */
export function calculateReconciledBalance(
  openingBalance: Decimal,
  transactions: Array<{ amount: Decimal; reconciled: boolean }>
): Decimal {
  let balance = openingBalance;

  for (const tx of transactions) {
    if (tx.reconciled) {
      balance = balance.plus(tx.amount);
    }
  }

  return balance;
}




