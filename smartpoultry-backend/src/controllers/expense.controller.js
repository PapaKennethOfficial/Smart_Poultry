const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");
const prisma = require("../config/prisma");

const expenseSchema = z.object({
  farmId: z.string().optional(), // optional — resolved from user if not provided
  amount: z.number().min(0, "Amount must be positive"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
});

exports.getExpenses = async (req, res, next) => {
  try {
    const { farmId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = farmId ? { farmId } : {};

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          loggedBy: { select: { id: true, name: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      })
    ]);

    res.json({
      data: expenses,
      meta: {
        total,
        page: Number(page),
        limit: take,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createExpense = async (req, res, next) => {
  try {
    const validatedData = expenseSchema.parse(req.body);

    // Auto-resolve farmId from the user's first farm if not provided
    let farmId = validatedData.farmId;
    if (!farmId) {
      const farm = await prisma.farm.findFirst({ where: { userId: req.user.id } });
      if (!farm) {
        return res.status(400).json({ error: "No farm found for this user. Please create a farm first." });
      }
      farmId = farm.id;
    }
    
    const expense = await prisma.expense.create({
      data: {
        farmId,
        userId: req.user.id,
        amount: validatedData.amount,
        category: validatedData.category,
        description: validatedData.description,
        date: validatedData.date,
      }
    });

    res.status(201).json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    next(error);
  }
};
