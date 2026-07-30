const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");
const prisma = require("../config/prisma"); // Adjust if they export initialized client from there

// Validation schema for creating/updating a log entry
const logEntrySchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  mortality: z.number().int().min(0).default(0),
  eggsCount: z.number().int().min(0, "Egg count must be a positive number"),
  dailyEggPurchases: z.number().int().min(0).default(0),
  weeklyEggPurchases: z.number().int().min(0).default(0),
  birdsBought: z.number().int().min(0).default(0),
  feedConsumption: z.number().min(0, "Feed amount must be a positive number"),
  waterConsumption: z.number().min(0).default(0),
  avgWeight: z.number().optional().nullable(),
  temperature: z.number().optional().nullable(),
  humidity: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  expenses: z.number().min(0).default(0), // Frontend passes expenses
  sales: z.number().min(0).default(0),    // Frontend passes sales
});

exports.getLogbook = async (req, res) => {
  try {
    const { search, batch, page = 1, limit = 20 } = req.query;
    
    // Build where clause
    const where = {
      deletedAt: null,
    };

    if (batch && batch !== "all") {
      where.batch = {
        breed: {
          contains: batch,
          mode: "insensitive"
        }
      };
    }

    if (search) {
      where.OR = [
        { notes: { contains: search, mode: "insensitive" } },
        { batch: { breed: { contains: search, mode: "insensitive" } } },
        { batch: { batchNumber: { contains: search, mode: "insensitive" } } }
      ];
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Get total count
    const totalCount = await prisma.logEntry.count({ where });

    // Get entries
    const entries = await prisma.logEntry.findMany({
      where,
      include: {
        batch: true,
        loggedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: {
        date: 'desc'
      },
      skip,
      take,
    });

    res.json({
      data: entries,
      meta: {
        total: totalCount,
        page: Number(page),
        limit: take,
        totalPages: Math.ceil(totalCount / take)
      }
    });

  } catch (error) {
    console.error("Error fetching logbook:", error);
    res.status(500).json({ error: "Failed to fetch log entries" });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        batchNumber: true,
        breed: true,
        currentCount: true,
      },
      orderBy: { batchNumber: "asc" },
    });
    res.json(batches);
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
};

exports.createLogEntry = async (req, res) => {
  try {
    const validatedData = logEntrySchema.parse(req.body);
    
    // Append user expenses and sales to notes or handle them if schema doesn't have it directly.
    // The current schema doesn't have expenses and sales, so let's format it in notes.
    const combinedNotes = `Expenses (GHS): ${validatedData.expenses || 0} | Sales (GHS): ${validatedData.sales || 0} ${validatedData.notes ? '| ' + validatedData.notes : ''}`;

    const newEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.logEntry.create({
        data: {
          batchId: validatedData.batchId,
          userId: req.user.id,
          date: validatedData.date,
          mortality: validatedData.mortality,
          eggsCount: validatedData.eggsCount,
          dailyEggPurchases: validatedData.dailyEggPurchases,
          weeklyEggPurchases: validatedData.weeklyEggPurchases,
          birdsBought: validatedData.birdsBought,
          feedConsumption: validatedData.feedConsumption,
          waterConsumption: validatedData.waterConsumption,
          avgWeight: validatedData.avgWeight,
          temperature: validatedData.temperature,
          humidity: validatedData.humidity,
          notes: combinedNotes,
        },
        include: {
          batch: true
        }
      });

      // Update currentCount in Batch
      const countChange = validatedData.birdsBought - validatedData.mortality;
      if (countChange !== 0) {
        await tx.batch.update({
          where: { id: validatedData.batchId },
          data: {
            currentCount: {
              increment: countChange
            }
          }
        });
      }

      return entry;
    });

    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating log entry:", error);
    res.status(500).json({ error: "Failed to create log entry" });
  }
};

exports.updateLogEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = logEntrySchema.partial().parse(req.body);

    const updatedEntry = await prisma.logEntry.update({
      where: { id },
      data: validatedData,
    });

    res.json(updatedEntry);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Log entry not found" });
    }
    console.error("Error updating log entry:", error);
    res.status(500).json({ error: "Failed to update log entry" });
  }
};

exports.deleteLogEntry = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete
    await prisma.logEntry.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    res.json({ message: "Log entry deleted successfully" });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Log entry not found" });
    }
    console.error("Error deleting log entry:", error);
    res.status(500).json({ error: "Failed to delete log entry" });
  }
};
