const express = require("express")
const { z } = require("zod")
const router = express.Router()
const prisma = require("../config/prisma")
const { requireAuth, requireRole } = require("../middleware/auth")

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().trim().optional().nullable(),
  price: z.coerce.number().positive("Price must be positive"),
  unit: z.string().trim().min(1, "Unit is required").default("kg"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
  category: z.string().trim().min(1, "Category is required").default("General"),
  imageUrl: z.string().trim().optional().nullable(),
})

const productPatchSchema = productSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required",
})

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
    return null
  }
  return parsed.data
}

// Public: get all active products visible in the marketplace.
router.get("/", async (req, res, next) => {
  try {
    const { category, search } = req.query
    const where = { isActive: true }
    if (category && category !== 'All') {
      where.category = category
    }
    if (search && search.trim() !== '') {
      where.name = { contains: search, mode: 'insensitive' }
    }
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
    })
    res.status(200).json({ products })
  } catch (error) {
    next(error)
  }
})

// Customer: get wishlist
router.get("/wishlist", requireAuth, async (req, res, next) => {
  try {
    const wishlists = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: { product: true },
    })
    const products = wishlists.map(w => w.product).filter(p => p.isActive)
    res.status(200).json({ products })
  } catch (error) {
    next(error)
  }
})

// Customer: toggle wishlist
router.post("/:id/wishlist", requireAuth, async (req, res, next) => {
  try {
    const productId = req.params.id
    const userId = req.user.id
    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    })
    
    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } })
      res.status(200).json({ message: "Removed from wishlist", wishlisted: false })
    } else {
      await prisma.wishlist.create({ data: { userId, productId } })
      res.status(201).json({ message: "Added to wishlist", wishlisted: true })
    }
  } catch (error) {
    next(error)
  }
})

// Manager/Admin: get ALL products including inactive/out-of-stock.
router.get("/all", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    })
    res.status(200).json({ products })
  } catch (error) {
    next(error)
  }
})

router.post("/", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const data = parseBody(productSchema, req, res)
    if (!data) return

    const product = await prisma.product.create({ data })
    res.status(201).json({ message: "Product created", product })
  } catch (error) {
    next(error)
  }
})

router.patch("/:id", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const data = parseBody(productPatchSchema, req, res)
    if (!data) return

    // Auto-relist the product if stock is being replenished above zero
    const updateData = { ...data }
    if (data.stock !== undefined && data.stock > 0) {
      updateData.isActive = true
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
    })
    res.status(200).json({ message: "Product updated", product })
  } catch (error) {
    next(error)
  }
})

router.delete("/:id", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.status(200).json({ message: "Product deleted" })
  } catch (error) {
    next(error)
  }
})

module.exports = router
