"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMaterial = addMaterial;
exports.getMaterials = getMaterials;
exports.updateMaterial = updateMaterial;
exports.deleteMaterial = deleteMaterial;
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
// Validation Schemas
const materialSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().allow("").optional(),
    costPrice: joi_1.default.number().integer().min(0).required(),
    unitId: joi_1.default.number().integer().min(1).required(),
    openingStock: joi_1.default.number().integer().min(0).required(),
    reorderPoint: joi_1.default.number().integer().min(0).optional(),
    openingStockDate: joi_1.default.date().default(() => new Date())
});
const updateMaterialSchema = joi_1.default.object({
    name: joi_1.default.string(),
    description: joi_1.default.string().allow("").optional(),
    costPrice: joi_1.default.number().integer().min(0),
    unitId: joi_1.default.number().integer().min(1),
    openingStock: joi_1.default.number().integer().min(0),
    reorderPoint: joi_1.default.number().integer().min(0),
}).min(1);
// Add a new material
function addMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = materialSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { name, description, reorderPoint, openingStockDate, openingStock, costPrice, unitId } = value;
            // Step 1: Add raw material to the `RawMaterials` table
            const newMaterial = yield prisma_1.prisma.rawMaterials.create({
                data: {
                    name,
                    description: description || null,
                    reorder_point: reorderPoint || null,
                    unit_id: unitId,
                },
            });
            // Step 2: Create a new transaction for the opening stock
            const newTransaction = yield prisma_1.prisma.transaction.create({
                data: {
                    transaction_type: "opening_stock",
                    transaction_date: openingStockDate,
                },
            });
            // Step 3: Create a transaction item for the opening stock
            yield prisma_1.prisma.transactionItems.create({
                data: {
                    transaction_id: newTransaction.id,
                    material_id: newMaterial.id,
                    quantity: openingStock,
                    cost: costPrice,
                    remaining_quantity: openingStock,
                },
            });
            res.status(201).json({
                message: "Material added successfully",
                material: newMaterial,
            });
        }
        catch (err) {
            console.error("Error in addMaterial:", err);
            res.status(500).json({ message: "Server error" });
        }
    });
}
// Get all materials
function getMaterials(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const materials = yield prisma_1.prisma.rawMaterials.findMany({
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
                var _a;
                let totalOpeningStock = 0;
                let totalPurchases = 0;
                let totalSales = 0;
                let totalAdjustments = 0;
                let latestCostPrice = 0;
                material.transactionItems.forEach((transactionItem) => {
                    var _a, _b;
                    const quantity = transactionItem.remaining_quantity || 0;
                    const cost = transactionItem.cost || 0;
                    switch ((_a = transactionItem.transactions) === null || _a === void 0 ? void 0 : _a.transaction_type) {
                        case "opening_stock":
                            totalOpeningStock += quantity;
                            break;
                        case "purchase":
                            totalPurchases += quantity;
                            break;
                        case "sale":
                            totalSales += quantity;
                            break;
                        case "adjustment":
                            totalAdjustments += quantity;
                            break;
                    }
                    if (["opening_stock", "purchase"].includes(((_b = transactionItem.transactions) === null || _b === void 0 ? void 0 : _b.transaction_type) || 'opening_stock')) {
                        latestCostPrice = cost;
                    }
                });
                const currentStock = totalOpeningStock + totalPurchases - totalSales + totalAdjustments;
                return {
                    id: material.id,
                    name: material.name,
                    unit: (_a = material.unit) === null || _a === void 0 ? void 0 : _a.symbol,
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
        }
        catch (err) {
            console.error("Error in getMaterials:", err);
            res.status(500).json({ message: "Server error" });
        }
    });
}
// Update a material
function updateMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const idValidation = joi_1.default.number().integer().positive().validate(parseInt(id));
            if (idValidation.error) {
                res.status(400).json({ message: "Invalid ID format" });
                return;
            }
            const { error, value } = updateMaterialSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const material = yield prisma_1.prisma.rawMaterials.update({
                where: { id: parseInt(id) },
                data: Object.assign(Object.assign({}, value), { updated_at: new Date() }),
            });
            res.status(200).json({ message: "Material updated successfully", material });
        }
        catch (err) {
            console.error("Error in updateMaterial:", err);
            res.status(500).json({ message: "Server error" });
        }
    });
}
// Delete a material
function deleteMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const idValidation = joi_1.default.number().integer().positive().validate(parseInt(id));
            if (idValidation.error) {
                res.status(400).json({ message: "Invalid ID format" });
                return;
            }
            // Check if material exists before deletion
            const existingMaterial = yield prisma_1.prisma.rawMaterials.findUnique({
                where: { id: parseInt(id) },
            });
            if (!existingMaterial) {
                res.status(404).json({ message: "Material not found" });
                return;
            }
            yield prisma_1.prisma.rawMaterials.delete({ where: { id: parseInt(id) } });
            res.status(200).json({ message: "Material deleted successfully" });
        }
        catch (err) {
            console.error("Error in deleteMaterial:", err);
            res.status(500).json({ message: "Server error" });
        }
    });
}
