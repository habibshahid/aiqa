// services/creditService.js - Fixed for MySQL LIMIT and OFFSET issues
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

/**
 * Service to manage credit balance and transactions
 */
const creditService = {
  /**
   * Get current credit balance and threshold
   * @returns {Promise<Object>} Object containing balance information
   */
  getCreditBalance: async () => {
    try {
      const [rows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      
      if (rows.length === 0) {
        // If no credit record exists, create one
        await db.query(`INSERT INTO ${tablePrefix}aiqa_credits (current_balance, low_balance_threshold) VALUES (0.00, 20)`);
        return { current_balance: 0.00, low_balance_threshold: 20, is_low: true };
      }
      
      const credit = rows[0];
      
      // Calculate if balance is low
      const isLow = credit.current_balance <= 0 || 
                    (credit.current_balance / (await creditService.getTotalAddedCredits())) * 100 <= credit.low_balance_threshold;
      
      return {
        id: credit.id,
        current_balance: credit.current_balance,
        low_balance_threshold: credit.low_balance_threshold,
        is_low: isLow,
        last_updated: credit.last_updated
      };
    } catch (error) {
      console.error('Error getting credit balance:', error);
      throw error;
    }
  },
  
  /**
   * Add credits to the balance
   * @param {number} amount - Amount to add
   * @param {string} description - Reason for adding credits
   * @returns {Promise<Object>} Updated balance information
   */
  addCredits: async (amount, description) => {
    try {
      // We need to perform this as a transaction but without getConnection
      // First get current balance
      const [rows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      
      let newBalance;
      
      if (rows.length === 0) {
        // If no credit record exists, create one
        await db.query(`INSERT INTO ${tablePrefix}aiqa_credits (current_balance, low_balance_threshold) VALUES (?, 20)`, [amount]);
        newBalance = amount;
      } else {
        const credit = rows[0];
        newBalance = parseFloat(credit.current_balance) + parseFloat(amount);
        
        // Update balance
        await db.query(`UPDATE ${tablePrefix}aiqa_credits SET current_balance = ? WHERE id = ?`, [newBalance, credit.id]);
      }
      
      // Record the transaction
      await db.query(
        `INSERT INTO ${tablePrefix}aiqa_credit_transactions (amount, transaction_type, description, balance_after) VALUES (?, ?, ?, ?)`,
        [amount, 'addition', description, newBalance]
      );
      
      // Get updated threshold
      const [updatedRows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      const updatedCredit = updatedRows[0];
      
      // Calculate if balance is low
      const totalAdded = await creditService.getTotalAddedCredits();
      const isLow = newBalance <= 0 || (totalAdded > 0 && (newBalance / totalAdded) * 100 <= updatedCredit.low_balance_threshold);
      
      return {
        current_balance: newBalance,
        low_balance_threshold: updatedCredit.low_balance_threshold,
        amount_added: amount,
        is_low: isLow
      };
    } catch (error) {
      console.error('Error adding credits:', error);
      throw error;
    }
  },
  
  /**
   * Deduct credits for an evaluation
   * @param {number} amount - Amount to deduct
   * @param {string} evaluationId - ID of the evaluation
   * @param {string} description - Description of the deduction
   * @returns {Promise<Object>} Updated balance information
   */
  deductCredits: async (amount, evaluationId, description) => {
    try {
      // Get current balance
      const [rows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      
      let newBalance;
      
      if (rows.length === 0) {
        // If no credit record exists, create one with negative balance
        await db.query(`INSERT INTO ${tablePrefix}aiqa_credits (current_balance, low_balance_threshold) VALUES (?, 20)`, [-amount]);
        newBalance = -amount;
      } else {
        const credit = rows[0];
        newBalance = parseFloat(credit.current_balance) - parseFloat(amount);
        
        // Update balance
        await db.query(`UPDATE ${tablePrefix}aiqa_credits SET current_balance = ? WHERE id = ?`, [newBalance, credit.id]);
      }
      
      // Record the transaction
      await db.query(
        `INSERT INTO ${tablePrefix}aiqa_credit_transactions (amount, transaction_type, evaluation_id, description, balance_after) VALUES (?, ?, ?, ?, ?)`,
        [amount, 'deduction', evaluationId, description, newBalance]
      );
      
      // Get updated threshold
      const [updatedRows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      const updatedCredit = updatedRows[0];
      
      // Calculate if balance is low
      const totalAdded = await creditService.getTotalAddedCredits();
      const isLow = newBalance <= 0 || (totalAdded > 0 && (newBalance / totalAdded) * 100 <= updatedCredit.low_balance_threshold);
      
      return {
        current_balance: newBalance,
        low_balance_threshold: updatedCredit.low_balance_threshold,
        amount_deducted: amount,
        is_low: isLow
      };
    } catch (error) {
      console.error('Error deducting credits:', error);
      throw error;
    }
  },
  
  /**
   * Update the low balance threshold percentage
   * @param {number} threshold - New threshold percentage (0-100)
   * @returns {Promise<Object>} Updated credit information
   */
  updateLowBalanceThreshold: async (threshold) => {
    try {
      // Validate threshold
      if (threshold < 0 || threshold > 100) {
        throw new Error('Threshold must be between 0 and 100');
      }
      
      // Get credit record
      const [rows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      
      if (rows.length === 0) {
        // If no credit record exists, create one
        await db.query(`INSERT INTO ${tablePrefix}aiqa_credits (current_balance, low_balance_threshold) VALUES (0.00, ?)`, [threshold]);
        return { current_balance: 0.00, low_balance_threshold: threshold, is_low: true };
      }
      
      const credit = rows[0];
      
      // Update threshold
      await db.query(`UPDATE ${tablePrefix}aiqa_credits SET low_balance_threshold = ? WHERE id = ?`, [threshold, credit.id]);
      
      // Calculate if balance is low with new threshold
      const isLow = credit.current_balance <= 0 || 
                   (credit.current_balance / (await creditService.getTotalAddedCredits())) * 100 <= threshold;
      
      return {
        current_balance: credit.current_balance,
        low_balance_threshold: threshold,
        is_low: isLow
      };
    } catch (error) {
      console.error('Error updating low balance threshold:', error);
      throw error;
    }
  },
  
  /**
   * Get transaction history
   * @param {number} limit - Maximum number of transactions to return
   * @param {number} offset - Number of transactions to skip
   * @returns {Promise<Object>} Transaction history with pagination info
   */
  getTransactionHistory: async (limit = 10, offset = 0) => {
    try {
      // Convert limit and offset to integers
      const limitInt = parseInt(limit);
      const offsetInt = parseInt(offset);
      
      // FIXED: Don't use placeholders for LIMIT and OFFSET
      // Instead, sanitize and insert the values directly into the query
      // This is safe since we're converting to integers first
      const [transactions] = await db.query(
        `SELECT * FROM ${tablePrefix}aiqa_credit_transactions ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`
      );
      
      // Get total count
      const [countResult] = await db.query(`SELECT COUNT(*) as total FROM ${tablePrefix}aiqa_credit_transactions`);
      const totalCount = countResult[0].total;
      
      return {
        transactions,
        pagination: {
          total: totalCount,
          page: Math.floor(offsetInt / limitInt) + 1,
          limit: limitInt,
          pages: Math.ceil(totalCount / limitInt)
        }
      };
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  },
  
  /**
   * Get total added credits (sum of all additions)
   * @returns {Promise<number>} Total amount of credits ever added
   */
  getTotalAddedCredits: async () => {
    try {
      const [rows] = await db.query(
        `SELECT SUM(amount) as total FROM ${tablePrefix}aiqa_credit_transactions WHERE transaction_type = ?`,
        ['addition']
      );
      
      return rows[0].total || 0;
    } catch (error) {
      console.error('Error getting total added credits:', error);
      return 0;
    }
  },
  
  /**
   * Get credit usage stats
   * @returns {Promise<Object>} Credit usage statistics
   */
  getCreditUsageStats: async () => {
    try {
      // Get current balance
      const [creditRows] = await db.query(`SELECT * FROM ${tablePrefix}aiqa_credits LIMIT 1`);
      
      if (creditRows.length === 0) {
        return {
          total_added: 0,
          total_used: 0,
          current_balance: 0,
          usage_percent: 0
        };
      }
      
      const currentBalance = creditRows[0].current_balance;
      
      // Get total additions
      const [additionRows] = await db.query(
        `SELECT SUM(amount) as total FROM ${tablePrefix}aiqa_credit_transactions WHERE transaction_type = ?`,
        ['addition']
      );
      const totalAdded = additionRows[0].total || 0;
      
      // Get total deductions
      const [deductionRows] = await db.query(
        `SELECT SUM(amount) as total FROM ${tablePrefix}aiqa_credit_transactions WHERE transaction_type = ?`,
        ['deduction']
      );
      const totalUsed = deductionRows[0].total || 0;
      
      // Calculate usage percentage
      const usagePercent = totalAdded > 0 ? (totalUsed / totalAdded) * 100 : 0;
      
      return {
        total_added: totalAdded,
        total_used: totalUsed,
        current_balance: currentBalance,
        usage_percent: usagePercent
      };
    } catch (error) {
      console.error('Error getting credit usage stats:', error);
      throw error;
    }
  }
};

module.exports = creditService;