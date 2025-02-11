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
exports.getMaterial = getMaterial;
exports.updateMaterial = updateMaterial;
exports.deleteMaterial = deleteMaterial;
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
// Validation Schemas
const materialSchema = joi_1.default.object({
    name: joi_1.default.string().required().messages({
        'string.empty': 'Cost name is required',
        'any.required': 'Cost name is required'
    }),
    description: joi_1.default.string().allow("").optional(),
    costPrice: joi_1.default.number()
        .precision(2)
        .min(0).required()
        .messages({
        'number.base': 'The value must be a valid number.',
        'number.positive': 'The number must be positive.',
        'number.precision': 'The number must have at most 2 decimal places.',
        'any.required': 'This field is required.',
    }),
    unitId: joi_1.default.number()
        .integer()
        .min(1)
        .required()
        .messages({ 'any.required': 'Please select unit', 'number.base': 'Please select unit' }),
    openingStock: joi_1.default.number()
        .precision(2)
        .min(0).required()
        .messages({
        'number.base': 'Opening stock must be a valid number.',
        'number.precision': 'The number must have at most 2 decimal places.',
        'any.required': 'This field is required.',
    })
        .min(0).required(),
    reorderPoint: joi_1.default.number()
        .precision(2)
        .min(0)
        .default(0)
        .messages({
        'number.base': 'Reorder point must be a valid number.',
        'any.required': 'This field is required.',
    }),
    openingStockDate: joi_1.default.date().default(() => new Date())
});
const updateMaterialSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    description: joi_1.default.string().allow("").optional(),
    unitName: joi_1.default.string().allow("").optional(),
    costPrice: joi_1.default.number()
        .precision(2)
        .min(0)
        .messages({
        'number.base': 'The value must be a valid number.',
        'number.positive': 'The number must be positive.',
        'number.precision': 'The number must have at most 2 decimal places.',
    }).optional(),
    unitId: joi_1.default.number()
        .integer()
        .min(1)
        .messages({ 'number.base': 'Please select unit' })
        .optional(),
    openingStock: joi_1.default.number()
        .precision(2)
        .min(0)
        .messages({
        'number.base': 'Opening stock must be a valid number.',
        'number.precision': 'The number must have at most 2 decimal places.',
    }).optional(),
    reorderPoint: joi_1.default.number()
        .precision(2)
        .min(0)
        .messages({
        'number.base': 'Reorder point must be a valid number.',
    }).optional(),
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
                    description: description,
                    reorder_point: reorderPoint,
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
                    if (["opening_stock", "purchase"].includes(((_b = transactionItem.transactions) === null || _b === void 0 ? void 0 : _b.transaction_type) || 'opening_stock')) {
                        latestCostPrice = Number(cost);
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
function getMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const { id } = req.params;
            const idValidation = joi_1.default.number().integer().positive().validate(parseInt(id));
            if (idValidation.error) {
                res.status(400).json({ message: "Invalid ID format" });
                return;
            }
            const fetchMaterials = yield prisma_1.prisma.rawMaterials.findFirst({
                where: {
                    id: parseInt(id)
                },
                select: {
                    name: true,
                    description: true,
                    reorder_point: true,
                    unit: {
                        select: {
                            name: true,
                            id: true,
                        }
                    },
                    transactionItems: {
                        where: {
                            transactions: {
                                transaction_type: 'opening_stock',
                            }
                        },
                        select: {
                            quantity: true,
                            cost: true,
                        }
                    }
                }
            });
            if (!fetchMaterials) {
                res.status(404).json({ message: 'Raw material not found' });
                return;
            }
            const response = {
                name: fetchMaterials.name,
                description: fetchMaterials.description,
                reorderPoint: fetchMaterials.reorder_point,
                unitId: (_a = fetchMaterials.unit) === null || _a === void 0 ? void 0 : _a.id,
                unitName: (_b = fetchMaterials.unit) === null || _b === void 0 ? void 0 : _b.name,
                openingStock: fetchMaterials.transactionItems[0].quantity,
                costPrice: fetchMaterials.transactionItems[0].cost,
            };
            res.status(200).json(response);
        }
        catch (err) {
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
            const { name, description, unitName, costPrice, unitId, openingStock, reorderPoint } = value;
            // Update the material
            const updatedMaterial = yield prisma_1.prisma.rawMaterials.update({
                where: { id: parseInt(id) },
                data: {
                    name,
                    description,
                    reorder_point: reorderPoint,
                    unit_id: unitId,
                    updated_at: new Date()
                }
            });
            // Update the transaction item if openingStock or costPrice is provided
            if (openingStock !== undefined || costPrice !== undefined) {
                const transactionItem = yield prisma_1.prisma.transactionItems.findFirst({
                    where: {
                        material_id: parseInt(id),
                        transactions: {
                            transaction_type: 'opening_stock'
                        }
                    }
                });
                if (transactionItem) {
                    yield prisma_1.prisma.transactionItems.update({
                        where: { id: transactionItem.id },
                        data: {
                            quantity: openingStock !== undefined ? openingStock : transactionItem.quantity,
                            remaining_quantity: openingStock !== undefined ? openingStock : transactionItem.quantity,
                            cost: costPrice !== undefined ? costPrice : transactionItem.cost
                        }
                    });
                }
            }
            res.status(200).json({ message: "Material updated successfully", material: updatedMaterial });
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
