/**
 * OFX Bank Statement Parser
 * 
 * Parses OFX (Open Financial Exchange) bank statements
 * Supports OFX 1.x and 2.x formats
 */

import Decimal from 'decimal.js';

export interface ParsedOFXTransaction {
  date: Date;
  amount: Decimal;
  description: string;
  payee?: string;
  memo?: string;
  reference?: string;
  balance?: Decimal;
  type?: string;
  fitId?: string; // Financial Institution Transaction ID
}

export interface OFXParseResult {
  transactions: ParsedOFXTransaction[];
  errors: Array<{
    message: string;
    line?: number;
  }>;
  metadata: {
    accountNumber?: string;
    accountType?: string;
    bankId?: string;
    statementDate?: Date;
    startDate?: Date;
    endDate?: Date;
    currency?: string;
  };
}

/**
 * Parse OFX bank statement
 */
export function parseOFXStatement(ofxContent: string): OFXParseResult {
  const transactions: ParsedOFXTransaction[] = [];
  const errors: OFXParseResult['errors'] = [];
  const metadata: OFXParseResult['metadata'] = {};

  try {
    // OFX files can be SGML or XML format
    // Check if it's XML format (OFX 2.x)
    if (ofxContent.trim().startsWith('<?xml') || ofxContent.includes('<OFX>')) {
      return parseOFXXML(ofxContent);
    } else {
      // SGML format (OFX 1.x)
      return parseOFXSGML(ofxContent);
    }
  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : 'Failed to parse OFX file',
    });
    return { transactions, errors, metadata };
  }
}

/**
 * Parse OFX XML format (OFX 2.x)
 */
function parseOFXXML(content: string): OFXParseResult {
  const transactions: ParsedOFXTransaction[] = [];
  const errors: OFXParseResult['errors'] = [];
  const metadata: OFXParseResult['metadata'] = {};

  try {
    // Simple XML parsing (for production, use a proper XML parser)
    // Extract STMTTRN (statement transactions)
    const stmttrnRegex = /<STMTTRN>(.*?)<\/STMTTRN>/gs;
    const matches = content.matchAll(stmttrnRegex);

    for (const match of matches) {
      const transactionXml = match[1];

      try {
        const dateStr = extractXMLTag(transactionXml, 'DTPOSTED') || extractXMLTag(transactionXml, 'DTUSER');
        const amountStr = extractXMLTag(transactionXml, 'TRNAMT');
        const name = extractXMLTag(transactionXml, 'NAME') || extractXMLTag(transactionXml, 'MEMO');
        const memo = extractXMLTag(transactionXml, 'MEMO');
        const fitId = extractXMLTag(transactionXml, 'FITID');
        const type = extractXMLTag(transactionXml, 'TRNTYPE');

        if (!dateStr || !amountStr || !name) {
          errors.push({
            message: 'Missing required fields in transaction',
          });
          continue;
        }

        const date = parseOFXDate(dateStr);
        if (!date) {
          errors.push({
            message: `Invalid date format: ${dateStr}`,
          });
          continue;
        }

        const amount = new Decimal(amountStr);

        transactions.push({
          date,
          amount,
          description: name,
          memo: memo || undefined,
          reference: fitId || undefined,
          type: type || undefined,
          fitId: fitId || undefined,
        });
      } catch (error) {
        errors.push({
          message: error instanceof Error ? error.message : 'Failed to parse transaction',
        });
      }
    }

    // Extract metadata
    const bankId = extractXMLTag(content, 'BANKID');
    const accountNumber = extractXMLTag(content, 'ACCTID');
    const accountType = extractXMLTag(content, 'ACCTTYPE');
    const currency = extractXMLTag(content, 'CURDEF');
    const statementDate = extractXMLTag(content, 'DTASOF');
    const startDate = extractXMLTag(content, 'DTSTART');
    const endDate = extractXMLTag(content, 'DTEND');

    if (bankId) metadata.bankId = bankId;
    if (accountNumber) metadata.accountNumber = accountNumber;
    if (accountType) metadata.accountType = accountType;
    if (currency) metadata.currency = currency;
    if (statementDate) metadata.statementDate = parseOFXDate(statementDate);
    if (startDate) metadata.startDate = parseOFXDate(startDate);
    if (endDate) metadata.endDate = parseOFXDate(endDate);
  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : 'Failed to parse OFX XML',
    });
  }

  return { transactions, errors, metadata };
}

/**
 * Parse OFX SGML format (OFX 1.x)
 */
function parseOFXSGML(content: string): OFXParseResult {
  const transactions: ParsedOFXTransaction[] = [];
  const errors: OFXParseResult['errors'] = [];
  const metadata: OFXParseResult['metadata'] = {};

  try {
    // Remove OFX headers and get to the statement section
    const stmttrnRegex = /<STMTTRN>(.*?)<\/STMTTRN>/gs;
    const matches = content.matchAll(stmttrnRegex);

    for (const match of matches) {
      const transactionBlock = match[1];

      try {
        const dateStr = extractSGMLTag(transactionBlock, 'DTPOSTED') || extractSGMLTag(transactionBlock, 'DTUSER');
        const amountStr = extractSGMLTag(transactionBlock, 'TRNAMT');
        const name = extractSGMLTag(transactionBlock, 'NAME') || extractSGMLTag(transactionBlock, 'MEMO');
        const memo = extractSGMLTag(transactionBlock, 'MEMO');
        const fitId = extractSGMLTag(transactionBlock, 'FITID');
        const type = extractSGMLTag(transactionBlock, 'TRNTYPE');

        if (!dateStr || !amountStr || !name) {
          errors.push({
            message: 'Missing required fields in transaction',
          });
          continue;
        }

        const date = parseOFXDate(dateStr);
        if (!date) {
          errors.push({
            message: `Invalid date format: ${dateStr}`,
          });
          continue;
        }

        const amount = new Decimal(amountStr);

        transactions.push({
          date,
          amount,
          description: name,
          memo: memo || undefined,
          reference: fitId || undefined,
          type: type || undefined,
          fitId: fitId || undefined,
        });
      } catch (error) {
        errors.push({
          message: error instanceof Error ? error.message : 'Failed to parse transaction',
        });
      }
    }

    // Extract metadata
    const bankId = extractSGMLTag(content, 'BANKID');
    const accountNumber = extractSGMLTag(content, 'ACCTID');
    const accountType = extractSGMLTag(content, 'ACCTTYPE');
    const currency = extractSGMLTag(content, 'CURDEF');
    const statementDate = extractSGMLTag(content, 'DTASOF');
    const startDate = extractSGMLTag(content, 'DTSTART');
    const endDate = extractSGMLTag(content, 'DTEND');

    if (bankId) metadata.bankId = bankId;
    if (accountNumber) metadata.accountNumber = accountNumber;
    if (accountType) metadata.accountType = accountType;
    if (currency) metadata.currency = currency;
    if (statementDate) metadata.statementDate = parseOFXDate(statementDate);
    if (startDate) metadata.startDate = parseOFXDate(startDate);
    if (endDate) metadata.endDate = parseOFXDate(endDate);
  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : 'Failed to parse OFX SGML',
    });
  }

  return { transactions, errors, metadata };
}

/**
 * Extract XML tag value
 */
function extractXMLTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract SGML tag value
 */
function extractSGMLTag(sgml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([^<]*)`, 'i');
  const match = sgml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse OFX date format (YYYYMMDDHHMMSS or YYYYMMDD)
 */
function parseOFXDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length < 8) return null;

  try {
    // OFX dates can be YYYYMMDDHHMMSS or YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8), 10);

    let hour = 0;
    let minute = 0;
    let second = 0;

    if (dateStr.length >= 14) {
      hour = parseInt(dateStr.substring(8, 10), 10);
      minute = parseInt(dateStr.substring(10, 12), 10);
      second = parseInt(dateStr.substring(12, 14), 10);
    }

    const date = new Date(year, month, day, hour, minute, second);
    
    // Validate date
    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  } catch {
    return null;
  }
}




