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
exports.addPurchase = addPurchase;
exports.getPurchase = getPurchase;
exports.getPurchases = getPurchases;
exports.deletePurchase = deletePurchase;
exports.editPurchase = editPurchase;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const schema_1 = require("../configs/schema");
const addPurchaseSchema = joi_1.default.object({
    supplierId: schema_1.validateSchema.idField('Supplier'),
    purchaseDate: schema_1.validateSchema.dateField('Purchase date'),
    rawMaterials: schema_1.validateSchema.arrayField('Raw materials').items({
        materialId: schema_1.validateSchema.idField('Raw Material'),
        name: joi_1.default.string(),
        quantity: schema_1.validateSchema.quantity(),
        cost: schema_1.validateSchema.cost()
    }).min(1).required().messages({ 'array.min': 'Please select at least one raw material', 'any.required': 'Please select at least one raw material' })
});
const editPurchaseSchema = joi_1.default.object({
    purchaseId: schema_1.validateSchema.idField('Purchase'),
    supplierId: schema_1.validateSchema.idField('Supplier'),
    purchaseDate: schema_1.validateSchema.dateField('Purchase date'),
    rawMaterials: schema_1.validateSchema.arrayField('Raw materials').items({
        materialId: schema_1.validateSchema.idField('Raw Material'),
        name: joi_1.default.string(),
        quantity: schema_1.validateSchema.quantity(),
        cost: schema_1.validateSchema.cost()
    }).min(1).required().messages({ 'array.min': 'Please select at least one raw material', 'any.required': 'Please select at least one raw material' })
});
function addPurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = addPurchaseSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { rawMaterials, supplierId, purchaseDate } = value;
            //add a prisma transaction 
            const addPrismaTransaction = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                //Add a purchase transaction
                const addTransaction = yield tx.transaction.create({
                    data: {
                        supplier_id: supplierId,
                        transaction_date: purchaseDate,
                        transaction_type: 'purchase',
                    }
                });
                //Process transaction item data 
                const rawMaterialsToAdd = rawMaterials.map(rawMaterial => ({
                    material_id: rawMaterial.materialId,
                    cost: rawMaterial.cost,
                    transaction_id: addTransaction.id,
                    quantity: rawMaterial.quantity,
                    remaining_quantity: rawMaterial.quantity
                }));
                //Add transaction items 
                const addTransactionItmes = yield tx.transactionItems.createMany({
                    data: rawMaterialsToAdd
                });
            }));
            res.status(201).json({ message: 'success' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getPurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const { id } = req.params;
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid purchase ID' });
                return;
            }
            const purchase = yield prisma_1.prisma.transaction.findFirst({
                where: {
                    id: Number(id),
                    transaction_type: 'purchase'
                },
                select: {
                    id: true,
                    transaction_date: true,
                    created_at: true,
                    supplier: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            business_name: true,
                            supplier_type: true,
                            email: true,
                            phone: true,
                            address: true
                        }
                    },
                    transaction_items: {
                        select: {
                            id: true,
                            quantity: true,
                            remaining_quantity: true,
                            cost: true,
                            raw_material: {
                                select: {
                                    id: true,
                                    name: true,
                                    unit: {
                                        select: {
                                            name: true,
                                            symbol: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!purchase) {
                res.status(404).json({ message: 'Purchase not found' });
                return;
            }
            const processedPurchase = {
                id: purchase.id,
                date: purchase.transaction_date,
                createdAt: purchase.created_at,
                supplier: {
                    id: (_a = purchase.supplier) === null || _a === void 0 ? void 0 : _a.id,
                    name: ((_b = purchase.supplier) === null || _b === void 0 ? void 0 : _b.supplier_type) === 'business'
                        ? purchase.supplier.business_name
                        : `${(_c = purchase.supplier) === null || _c === void 0 ? void 0 : _c.first_name} ${(_d = purchase.supplier) === null || _d === void 0 ? void 0 : _d.last_name}`,
                    email: (_e = purchase.supplier) === null || _e === void 0 ? void 0 : _e.email,
                    phone: (_f = purchase.supplier) === null || _f === void 0 ? void 0 : _f.phone,
                    address: (_g = purchase.supplier) === null || _g === void 0 ? void 0 : _g.address
                },
                materials: purchase.transaction_items.map(item => {
                    var _a, _b, _c, _d;
                    return ({
                        id: item.id,
                        materialId: (_a = item.raw_material) === null || _a === void 0 ? void 0 : _a.id,
                        materialName: (_b = item.raw_material) === null || _b === void 0 ? void 0 : _b.name,
                        quantity: Number(item.quantity),
                        remainingQuantity: Number(item.remaining_quantity),
                        unitCost: Number(item.cost),
                        totalCost: Number(item.quantity) * Number(item.cost),
                        unit: (_d = (_c = item.raw_material) === null || _c === void 0 ? void 0 : _c.unit) === null || _d === void 0 ? void 0 : _d.symbol,
                        usedQuantity: Number(item.quantity) - Number(item.remaining_quantity)
                    });
                }),
                summary: {
                    totalCost: purchase.transaction_items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.cost)), 0),
                    totalItems: purchase.transaction_items.length,
                    totalQuantity: purchase.transaction_items.reduce((sum, item) => sum + Number(item.quantity), 0),
                    remainingQuantity: purchase.transaction_items.reduce((sum, item) => sum + Number(item.remaining_quantity), 0)
                }
            };
            res.status(200).json(processedPurchase);
        }
        catch (err) {
            console.error('Error in getPurchase:', err);
            res.status(500).json({ message: 'Failed to fetch purchase details' });
        }
    });
}
function getPurchases(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { cursor } = req.query;
            const fetchPurchases = yield prisma_1.prisma.transaction.findMany(Object.assign(Object.assign({ where: {
                    transaction_type: 'purchase',
                } }, (cursor && {
                cursor: {
                    id: Number(cursor),
                },
                skip: 1,
            })), { take: 10, select: {
                    id: true,
                    created_at: true,
                    transaction_date: true,
                    supplier: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            business_name: true,
                            supplier_type: true,
                        }
                    },
                    transaction_items: true,
                }, orderBy: {
                    created_at: 'desc'
                } }));
            const purchases = fetchPurchases.map(purchase => {
                var _a, _b;
                return ({
                    id: purchase.id,
                    supplier: {
                        id: purchase.supplier ? purchase.supplier.id : null,
                        name: purchase.supplier ? (purchase.supplier.supplier_type === 'business' ? purchase.supplier.business_name : `${(_a = purchase.supplier) === null || _a === void 0 ? void 0 : _a.first_name} ${(_b = purchase.supplier) === null || _b === void 0 ? void 0 : _b.last_name}`) : null
                    },
                    date: purchase.transaction_date,
                    materialCount: purchase.transaction_items.length,
                    totalCost: purchase.transaction_items.reduce((init, sum) => init + Number(sum.cost), 0)
                });
            });
            const page = {
                data: purchases,
                nextCursor: purchases[purchases.length - 1].id,
            };
            res.status(200).json(page);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
function deletePurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid purchase ID' });
                return;
            }
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // First check if purchase exists and is of type 'purchase'
                const purchase = yield tx.transaction.findFirst({
                    where: {
                        id: Number(id),
                        transaction_type: 'purchase'
                    },
                    include: {
                        transaction_items: {
                            where: {
                                remaining_quantity: {
                                    gt: 0
                                }
                            }
                        }
                    }
                });
                if (!purchase) {
                    throw new Error('Purchase not found');
                }
                // Check if any materials from this purchase have been used
                if (purchase.transaction_items.some(item => Number(item.quantity) !== Number(item.remaining_quantity))) {
                    throw new Error('Cannot delete purchase as some materials have already been used');
                }
                // Delete transaction items first
                yield tx.transactionItems.deleteMany({
                    where: {
                        transaction_id: Number(id)
                    }
                });
                // Delete the purchase transaction
                yield tx.transaction.delete({
                    where: {
                        id: Number(id)
                    }
                });
            }));
            res.status(200).json({ message: 'Purchase deleted successfully' });
        }
        catch (err) {
            console.error('Error in deletePurchase:', err);
            res.status(400).json({
                message: err instanceof Error ? err.message : 'Failed to delete purchase'
            });
        }
    });
}
function editPurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = editPurchaseSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { purchaseId, rawMaterials, supplierId, purchaseDate } = value;
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if purchase exists and is of type 'purchase'
                const existingPurchase = yield tx.transaction.findFirst({
                    where: {
                        id: purchaseId,
                        transaction_type: 'purchase'
                    },
                    include: {
                        transaction_items: {
                            select: {
                                quantity: true,
                                remaining_quantity: true
                            }
                        }
                    }
                });
                if (!existingPurchase) {
                    throw new Error('Purchase not found');
                }
                // Check if any materials have been used
                if (existingPurchase.transaction_items.some(item => Number(item.quantity) !== Number(item.remaining_quantity))) {
                    throw new Error('Cannot edit purchase as some materials have already been used');
                }
                // Update the main purchase transaction
                yield tx.transaction.update({
                    where: { id: purchaseId },
                    data: {
                        supplier_id: supplierId,
                        transaction_date: purchaseDate,
                    }
                });
                // Delete existing transaction items
                yield tx.transactionItems.deleteMany({
                    where: { transaction_id: purchaseId }
                });
                // Create new transaction items
                const rawMaterialsToAdd = rawMaterials.map((rawMaterial) => ({
                    material_id: rawMaterial.materialId,
                    cost: rawMaterial.cost,
                    transaction_id: purchaseId,
                    quantity: rawMaterial.quantity,
                    remaining_quantity: rawMaterial.quantity
                }));
                yield tx.transactionItems.createMany({
                    data: rawMaterialsToAdd
                });
            }));
            res.status(200).json({ message: 'Purchase updated successfully' });
        }
        catch (err) {
            console.error('Error in editPurchase:', err);
            res.status(400).json({
                message: err instanceof Error ? err.message : 'Failed to update purchase'
            });
        }
    });
}
