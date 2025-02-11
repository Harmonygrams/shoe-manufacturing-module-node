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
exports.addBillOfMaterial = addBillOfMaterial;
exports.getBillsOfMaterial = getBillsOfMaterial;
exports.getBillOfMaterial = getBillOfMaterial;
exports.deleteBillOfMaterial = deleteBillOfMaterial;
exports.editBillOfMaterial = editBillOfMaterial;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const addBillOfMaterialSchema = joi_1.default.object({
    productId: joi_1.default.number().messages({
        'number.base': "Please select a product",
        'any.required': 'Please select a product'
    }),
    quantity: joi_1.default.number().min(1),
    bomDate: joi_1.default.date().default(new Date()),
    bomList: joi_1.default.array().min(1).required().items({
        materialId: joi_1.default.number().required().messages({
            'number.base': "Please select a material",
            'any.required': 'Please select a material'
        }),
        quantity: joi_1.default.number().min(0).required().messages({
            'number.base': "Quantity is required",
            'any.required': 'Quantity is required',
            'number.min': 'Quantity must be equal or more than 0'
        }),
    }).messages({ 'array.base': 'Please select at least one raw material', 'array.min': 'Please select at least one raw material' }),
});
const EditBillOfMaterialSchema = joi_1.default.object({
    bomId: joi_1.default.number().required().messages({
        'number.base': "Bom not specified",
        'any.required': 'Bom not specified'
    }),
    productId: joi_1.default.number().required().messages({
        'number.base': "Please select a product",
        'any.required': 'Please select a product'
    }),
    quantity: joi_1.default.number().min(1),
    bomDate: joi_1.default.date().default(new Date()),
    bomList: joi_1.default.array().min(1).required().items({
        materialId: joi_1.default.number().required().messages({
            'number.base': "Please select a material",
            'any.required': 'Please select a material'
        }),
        quantity: joi_1.default.number().min(0).required().messages({
            'number.base': "Quantity is required",
            'any.required': 'Quantity is required',
            'number.min': 'Quantity must be equal or more than 0'
        }),
    }).messages({ 'array.base': 'Please select at least one raw material', 'array.min': 'Please select at least one raw material' }),
});
function addBillOfMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate request body
            const { error, value } = addBillOfMaterialSchema.validate(req.body);
            if (error) {
                console.log(error);
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { productId, quantity, bomList, bomDate } = value;
            //Initiate a prisma transaction to add the bill of material 
            const transaction = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const addBillOfMaterialToDb = yield tx.billOfMaterials.create({
                    data: {
                        product_id: productId,
                        quantity: 1,
                        bom_date: bomDate,
                    }
                });
                const bomListItems = bomList.map((bom) => ({
                    bom_id: addBillOfMaterialToDb.id,
                    material_id: bom.materialId,
                    quantity: bom.quantity,
                }));
                yield tx.billOfMaterialsList.createMany({
                    data: bomListItems
                });
                return { addBillOfMaterialToDb };
            }));
            res.status(201).json({ message: "Bom added successfully" });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: "server error occurred" });
        }
    });
}
function getBillsOfMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fetchBillOfMaterials = yield prisma_1.prisma.billOfMaterials.findMany({
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    bom_list: {
                        select: {
                            material_id: true,
                            material: {
                                select: {
                                    name: true,
                                    unit: {
                                        select: {
                                            name: true
                                        }
                                    },
                                    transactionItems: {
                                        select: {
                                            cost: true,
                                            quantity: true,
                                            remaining_quantity: true,
                                            transactions: true,
                                        },
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const bomItems = fetchBillOfMaterials.map(bomItem => {
                let lastCostPriceTransaction = 0;
                const bomList = bomItem.bom_list.map(bomListItem => {
                    var _a;
                    // Get the most recent cost price from purchase or opening stock
                    const lastTransactionWithCost = bomListItem.material.transactionItems.find(trans => { var _a, _b, _c; return (((_a = trans.transactions) === null || _a === void 0 ? void 0 : _a.transaction_type) === "purchase" || ((_b = trans.transactions) === null || _b === void 0 ? void 0 : _b.transaction_type) === "opening_stock" || ((_c = trans.transactions) === null || _c === void 0 ? void 0 : _c.transaction_type) === "adjustment") && trans.cost; });
                    lastCostPriceTransaction = Number(lastTransactionWithCost === null || lastTransactionWithCost === void 0 ? void 0 : lastTransactionWithCost.cost) || 0;
                    return {
                        quantity: bomListItem.material.transactionItems.reduce((initial, accum) => initial + Number(accum.remaining_quantity), 0),
                        materialName: bomListItem.material.name,
                        unit: (_a = bomListItem.material.unit) === null || _a === void 0 ? void 0 : _a.name,
                        cost: lastCostPriceTransaction
                    };
                });
                // Calculate total cost
                const totalCost = bomList.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
                return {
                    id: bomItem.id,
                    productName: bomItem.product.name,
                    productId: bomItem.product.id,
                    bomDate: bomItem.bom_date,
                    bomList,
                    totalCost, // Added total cost
                };
            });
            res.status(200).json({ bomItems });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function getBillOfMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Validate ID is a number
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid ID format' });
                return;
            }
            const fetchBillOfMaterial = yield prisma_1.prisma.billOfMaterials.findFirst({
                where: {
                    product_id: Number(id)
                },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    bom_list: {
                        select: {
                            material_id: true,
                            quantity: true,
                            material: {
                                select: {
                                    id: true,
                                    name: true,
                                    unit: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    },
                                    transactionItems: {
                                        orderBy: {
                                            created_at: 'desc'
                                        },
                                        include: {
                                            transactions: {
                                                select: {
                                                    transaction_type: true,
                                                    transaction_date: true,
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            let lastCostPriceTransaction = 0;
            let totalQuantity = 0;
            const bomList = fetchBillOfMaterial === null || fetchBillOfMaterial === void 0 ? void 0 : fetchBillOfMaterial.bom_list.map(bomListItem => {
                var _a, _b;
                // Get the most recent cost price from purchase or opening stock
                const lastTransactionWithCost = bomListItem.material.transactionItems.find(trans => {
                    var _a, _b, _c;
                    totalQuantity += Number(trans.quantity);
                    return (((_a = trans.transactions) === null || _a === void 0 ? void 0 : _a.transaction_type) === "purchase" || ((_b = trans.transactions) === null || _b === void 0 ? void 0 : _b.transaction_type) === "opening_stock" || ((_c = trans.transactions) === null || _c === void 0 ? void 0 : _c.transaction_type) === "adjustment") && trans.cost;
                });
                lastCostPriceTransaction = Number(lastTransactionWithCost === null || lastTransactionWithCost === void 0 ? void 0 : lastTransactionWithCost.cost) || 0;
                return {
                    name: bomListItem.material.name,
                    unitName: (_a = bomListItem.material.unit) === null || _a === void 0 ? void 0 : _a.name,
                    materialId: bomListItem.material.id,
                    unitId: (_b = bomListItem.material.unit) === null || _b === void 0 ? void 0 : _b.id,
                    cost: lastCostPriceTransaction,
                    quantityNeed: bomListItem.quantity,
                    totalQuantity,
                };
            });
            // Calculate total cost
            const totalCost = (bomList === null || bomList === void 0 ? void 0 : bomList.reduce((sum, item) => sum + (Number(item.quantityNeed) * item.cost), 0)) || 0;
            const product = {
                id: fetchBillOfMaterial === null || fetchBillOfMaterial === void 0 ? void 0 : fetchBillOfMaterial.id,
                productName: fetchBillOfMaterial === null || fetchBillOfMaterial === void 0 ? void 0 : fetchBillOfMaterial.product.name,
                productId: fetchBillOfMaterial === null || fetchBillOfMaterial === void 0 ? void 0 : fetchBillOfMaterial.product.id,
                bomDate: fetchBillOfMaterial === null || fetchBillOfMaterial === void 0 ? void 0 : fetchBillOfMaterial.bom_date,
                bomList,
                totalCost, // Added total cost
            };
            res.status(200).json(product);
        }
        catch (err) {
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
function deleteBillOfMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Validate ID is a number
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid BOM ID' });
                return;
            }
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if BOM exists
                const bom = yield tx.billOfMaterials.findUnique({
                    where: { id: Number(id) },
                    include: {
                        bom_list: true,
                        product: {
                            select: {
                                name: true
                            }
                        }
                    }
                });
                if (!bom) {
                    throw new Error('Bill of Materials not found');
                }
                // First delete all BOM list items
                yield tx.billOfMaterialsList.deleteMany({
                    where: {
                        bom_id: Number(id)
                    }
                });
                // Then delete the main BOM record
                yield tx.billOfMaterials.delete({
                    where: {
                        id: Number(id)
                    }
                });
            }));
            res.status(200).json({ message: 'Bill of Materials deleted successfully' });
        }
        catch (err) {
            console.error('Error in deleteBillOfMaterial:', err);
            res.status(400).json({
                message: err instanceof Error ? err.message : 'Failed to delete Bill of Materials'
            });
        }
    });
}
function editBillOfMaterial(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate request body
            const { error, value } = EditBillOfMaterialSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { bomId, productId, bomList, bomDate } = value;
            // Update using transaction to ensure data consistency
            const transaction = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if BOM exists
                const existingBom = yield tx.billOfMaterials.findUnique({
                    where: { id: bomId },
                    include: {
                        bom_list: true
                    }
                });
                if (!existingBom) {
                    throw new Error('Bill of Materials not found');
                }
                // Update the main BOM record
                const updatedBom = yield tx.billOfMaterials.update({
                    where: { id: bomId },
                    data: {
                        product_id: productId,
                        quantity: 1,
                        bom_date: bomDate,
                    }
                });
                // Delete existing BOM list items
                yield tx.billOfMaterialsList.deleteMany({
                    where: {
                        bom_id: bomId
                    }
                });
                // Create new BOM list items
                const bomListItems = bomList.map((bom) => ({
                    bom_id: bomId,
                    material_id: bom.materialId,
                    quantity: bom.quantity
                }));
                yield tx.billOfMaterialsList.createMany({
                    data: bomListItems
                });
                return updatedBom;
            }));
            res.status(200).json({
                message: "Bill of Materials updated successfully",
                bom: transaction
            });
        }
        catch (err) {
            console.error('Error in editBillOfMaterial:', err);
            res.status(400).json({
                message: err instanceof Error ? err.message : 'Failed to update Bill of Materials'
            });
        }
    });
}
