const mongoose = require('mongoose');
const { ApiError } = require('./errors');
const Transaction = require('./models/transaction');
const { publishExpenseCreated } = require('./publisher');

function moneyToDecimal(amount) {
  // Store money as Decimal128 so database totals do not accumulate float errors.
  return mongoose.Types.Decimal128.fromString((Math.round(amount * 100) / 100).toFixed(2));
}

function serializeTransaction(transaction) {
  const row = typeof transaction.toObject === 'function'
    ? transaction.toObject()
    : transaction;

  return {
    id: row._id.toString(),
    userId: row.userId.toString(),
    amount: Number(row.amount.toString()),
    type: row.type,
    category: row.category,
    date: row.date.toISOString().slice(0, 10),
    ...(row.note === undefined ? {} : { note: row.note }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function monthRange(month) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

function decimalToNumber(value) {
  return value ? Number(value.toString()) : 0;
}

async function createTransaction(userId, input, requestLogger) {
  const transaction = await Transaction.create({
    userId,
    amount: moneyToDecimal(input.amount),
    type: input.type,
    category: input.category,
    date: new Date(`${input.date}T00:00:00.000Z`),
    ...(input.note === undefined ? {} : { note: input.note }),
  });

  const result = serializeTransaction(transaction);
  if (input.type === 'expense') {
    await publishExpenseCreated({
      userId: result.userId,
      transactionId: result.id,
      amount: result.amount,
      category: result.category,
      date: result.date,
    }, requestLogger);
  }

  return result;
}

async function listTransactions(userId, filters) {
  const query = { userId };
  if (filters.type) query.type = filters.type;
  if (filters.category) query.category = filters.category;
  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    query.date = { $gte: start, $lt: end };
  }

  const skip = (filters.page - 1) * filters.limit;
  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ date: -1, _id: -1 })
      .skip(skip)
      .limit(filters.limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    transactions: transactions.map(serializeTransaction),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

async function updateTransaction(userId, id, input) {
  const update = { ...input };
  if (update.amount !== undefined) update.amount = moneyToDecimal(update.amount);
  if (update.date !== undefined) {
    update.date = new Date(`${update.date}T00:00:00.000Z`);
  }

  const transaction = await Transaction.findOneAndUpdate(
    { _id: id, userId },
    { $set: update },
    { new: true, runValidators: true },
  );

  if (!transaction) {
    throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Transaction was not found');
  }

  return serializeTransaction(transaction);
}

async function deleteTransaction(userId, id) {
  const transaction = await Transaction.findOneAndDelete({ _id: id, userId });
  if (!transaction) {
    throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Transaction was not found');
  }
}

async function summarizeTransactions(userId, month) {
  const { start, end } = monthRange(month);
  const [result] = await Transaction.aggregate([
    { $match: { userId, date: { $gte: start, $lt: end } } },
    {
      $facet: {
        totals: [
          { $group: { _id: '$type', total: { $sum: '$amount' } } },
        ],
        categories: [
          {
            $group: {
              _id: { category: '$category', type: '$type' },
              total: { $sum: '$amount' },
            },
          },
          { $sort: { '_id.category': 1 } },
        ],
      },
    },
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const row of result.totals) {
    if (row._id === 'income') totalIncome = decimalToNumber(row.total);
    if (row._id === 'expense') totalExpense = decimalToNumber(row.total);
  }

  const categoryMap = new Map();
  for (const row of result.categories) {
    const category = row._id.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { category, income: 0, expense: 0 });
    }
    categoryMap.get(category)[row._id.type] = decimalToNumber(row.total);
  }

  return {
    month,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categories: [...categoryMap.values()],
  };
}

module.exports = {
  createTransaction,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  summarizeTransactions,
};
