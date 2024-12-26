import { Request, Response } from "express";
import Joi from "joi";
import { prisma } from "../lib/prisma";

// Validation Schemas
const materialSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow("").optional(),
    costPrice: Joi.number()
        .precision(2)
        .min(0).required()
        .messages({
            'number.base': 'The value must be a valid number.',
            'number.positive': 'The number must be positive.',
            'number.precision': 'The number must have at most 2 decimal places.',
            'any.required': 'This field is required.',
          }),
    unitId: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({'any.required' : 'Please select unit', 'number.base' : 'Please select unit'}),
    openingStock: Joi.number()
        .precision(2)
        .min(0).required()
        .messages({
            'number.base': 'Opening stock must be a valid number.',
            'number.precision': 'The number must have at most 2 decimal places.',
            'any.required': 'This field is required.',
        })
        .min(0).required(),
    reorderPoint: Joi.number()
        .precision(2)
        .min(0)
        .default(0)
        .messages({
            'number.base': 'Reorder point must be a valid number.',
            'any.required': 'This field is required.',
          }),
    openingStockDate: Joi.date().default(() => new Date())
});

const updateMaterialSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow("").optional(),
    costPrice: Joi.number().integer().min(0),
    unitId: Joi.number().integer().min(1),
    openingStock: Joi.number().integer().min(0),
    reorderPoint: Joi.number().integer().min(0),
}).min(1);

// Add a new material
export async function addMaterial(req: Request, res: Response) {
    try {
        const { error, value } = materialSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }

        const { name, description, reorderPoint, openingStockDate, openingStock, costPrice, unitId } = value;

        // Step 1: Add raw material to the `RawMaterials` table
        const newMaterial = await prisma.rawMaterials.create({
            data: {
                name,
                description: description,
                reorder_point: reorderPoint,
                unit_id: unitId,
            },
        });

        // Step 2: Create a new transaction for the opening stock
        const newTransaction = await prisma.transaction.create({
            data: {
                transaction_type: "opening_stock",
                transaction_date: openingStockDate,
            },
        });

        // Step 3: Create a transaction item for the opening stock
        await prisma.transactionItems.create({
            data: {
                transaction_id: newTransaction.id,
                material_id: newMaterial.id,
                quantity: openingStock,
                cost: costPrice,
                remaining_quantity : openingStock,
            },
        });

        res.status(201).json({
            message: "Material added successfully",
            material: newMaterial,
        });
    } catch (err) {
        console.error("Error in addMaterial:", err);
        res.status(500).json({ message: "Server error" });
    }
}

// Get all materials
export async function getMaterials(req: Request, res: Response) {
    try {
        const materials = await prisma.rawMaterials.findMany({
            orderBy: { created_at: "desc" },
            include: {
                unit: { select: { name: true, symbol: true } },
                transactionItems: {
                    include: {
                        transactions: true,
                    },
                },
            },
        });

        const processedMaterials = materials.map((material) => {
            let totalOpeningStock = 0;
            let totalPurchases = 0;
            let totalSales = 0;
            let totalAdjustments = 0;
            let latestCostPrice = 0;

            material.transactionItems.forEach((transactionItem) => {
                const quantity = transactionItem.remaining_quantity || 0;
                const cost = transactionItem.cost || 0;
                switch (transactionItem.transactions?.transaction_type) {
                    case "opening_stock":
                        totalOpeningStock += Number(quantity);
                        break;
                    case "purchase":
                        totalPurchases += Number(quantity);
                        break;
                    case "sale":
                        totalSales += Number(quantity);
                        break;
                    case "adjustment":
                        totalAdjustments += Number(quantity);
                        break;
                }

                if (["opening_stock", "purchase"].includes(transactionItem.transactions?.transaction_type || 'opening_stock')) {
                    latestCostPrice = Number(cost);
                }
            });

            const currentStock =
                totalOpeningStock + totalPurchases - totalSales + totalAdjustments;

            return {
                id: material.id,
                name: material.name,
                unit: material.unit?.symbol,
                createdAt: material.created_at,
                updatedAt: material.updated_at,
                quantity: currentStock,
                cost: latestCostPrice,
                transaction_summary: {
                    total_opening_stock: totalOpeningStock,
                    total_purchases: totalPurchases,
                    total_sales: totalSales,
                    total_adjustments: totalAdjustments,
                },
            };
        });

        res.status(200).json(processedMaterials);
    } catch (err) {
        console.error("Error in getMaterials:", err);
        res.status(500).json({ message: "Server error" });
    }
}

// Update a material
export async function updateMaterial(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const idValidation = Joi.number().integer().positive().validate(parseInt(id));
        if (idValidation.error) {
            res.status(400).json({ message: "Invalid ID format" });
            return 
        }

        const { error, value } = updateMaterialSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }

        const material = await prisma.rawMaterials.update({
            where: { id: parseInt(id) },
            data: { ...value, updated_at: new Date() },
        });

        res.status(200).json({ message: "Material updated successfully", material });
    } catch (err) {
        console.error("Error in updateMaterial:", err);
        res.status(500).json({ message: "Server error" });
    }
}

// Delete a material
export async function deleteMaterial(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const idValidation = Joi.number().integer().positive().validate(parseInt(id));
        if (idValidation.error) {
            res.status(400).json({ message: "Invalid ID format" });
            return 
        }

        // Check if material exists before deletion
        const existingMaterial = await prisma.rawMaterials.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existingMaterial) {
            res.status(404).json({ message: "Material not found" });
            return 
        }

        await prisma.rawMaterials.delete({ where: { id: parseInt(id) } });

        res.status(200).json({ message: "Material deleted successfully" });
    } catch (err) {
        console.error("Error in deleteMaterial:", err);
        res.status(500).json({ message: "Server error" });
    }
}
