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
Object.defineProperty(exports, "__esModule", { value: true });
exports.addProduction = addProduction;
exports.getProductions = getProductions;
exports.getProduction = getProduction;
exports.updateProduction = updateProduction;
exports.deleteProduction = deleteProduction;
exports.updateProductionStatus = updateProductionStatus;
exports.updateProductionStatusMetadata = updateProductionStatusMetadata;
exports.validateProduction = validateProduction;
const prisma_1 = require("../lib/prisma");
const Joi = require("joi");
const schema_1 = require("../configs/schema");
const addProductSchema = Joi.object({
    productionDate: Joi.date().default(new Date()),
    status: Joi.string().required().messages({ 'string.empty': 'Please specify status of production', 'any.required': 'Please specify status of production' }),
    orderType: Joi.string().required().messages({ 'string.empty': 'Select a pending production order', 'any.required': 'Select a pending production order' }),
    orderId: Joi.number().required().messages({ 'any.required': "Please select any pending order", "number.base": "Please select any pending order" }),
    products: Joi.array().items({
        productId: Joi.number(),
        sizeId: Joi.number(),
        colorId: Joi.number(),
        unitCost: schema_1.validateSchema.cost(),
        quantity: Joi.number(),
    }),
    rawMaterials: Joi.array().items({
        materialId: Joi.number(),
        quantity: Joi.number(),
    }),
    productionCosts: Joi.array().items({
        name: Joi.string(),
        id: Joi.number().required(),
        amount: Joi.number().required()
    }).required()
});
function addProduction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            //Validate fields 
            const { error, value } = addProductSchema.validate(req.body);
            if (error) {
                res.status(400).json(error.details[0].message);
                return;
            }
            const { products, rawMaterials, status, productionDate, orderId, productionCosts } = value;
            //Add prisma transaction 
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const processProductSizes = products.map(product => product.productId);
                //Fetch product size ids
                const fetchProductSizeIds = yield prisma_1.prisma.productSize.findMany({
                    where: {
                        product_id: {
                            in: processProductSizes
                        },
                    },
                    select: {
                        size_id: true,
                        product_id: true,
                        id: true,
                        products: {
                            select: {
                                bom: {
                                    select: {
                                        bom_list: {
                                            select: {
                                                material: {
                                                    select: {
                                                        transactionItems: {
                                                            select: {
                                                                cost: true,
                                                                quantity: true,
                                                            }
                                                        }
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
                // Know the remaining quantity of the raw materials using their ids 
                const rawMaterialsId = rawMaterials.map(rawMaterial => rawMaterial.materialId);
                const getRawMaterialsFromDb = yield prisma_1.prisma.rawMaterials.findMany({
                    where: {
                        id: {
                            in: rawMaterialsId
                        },
                    },
                    select: {
                        name: true,
                        id: true,
                        transactionItems: {
                            where: {
                                remaining_quantity: {
                                    gt: 0,
                                },
                                transactions: {
                                    transaction_type: {
                                        in: ['adjustment', 'opening_stock', 'purchase'],
                                    }
                                },
                            },
                            select: {
                                id: true,
                                remaining_quantity: true,
                                transactions: true
                            }
                        }
                    }
                });
                //We have to ensure that we have upto the quantity of the materials needed
                for (const rawMaterial of rawMaterials) {
                    for (const rawMaterialFromDb of getRawMaterialsFromDb) {
                        if (rawMaterial.materialId === rawMaterialFromDb.id) {
                            const totalQuantityRemaining = rawMaterialFromDb.transactionItems.reduce((initial, accum) => initial + Number(accum.remaining_quantity), 0);
                            if (totalQuantityRemaining < rawMaterial.quantity) {
                                throw new Error(`${rawMaterialFromDb.name} is insufficient. \nRequired Quantity: ${rawMaterial.quantity}\nRemaining Quantity: ${totalQuantityRemaining}`);
                            }
                        }
                    }
                }
                //Find out the batches with the oldest dates with remaining quantity and minus from there 
                for (const rawMaterial of rawMaterials) {
                    for (const rawMaterialFromDb of getRawMaterialsFromDb) {
                        if (rawMaterial.materialId === rawMaterialFromDb.id) {
                            let quantityNeeded = rawMaterial.quantity;
                            //For when the quantity needed is bigger than in stock
                            for (const transaction of rawMaterialFromDb.transactionItems) {
                                if (quantityNeeded === Number(transaction.remaining_quantity)) {
                                    yield tx.transactionItems.update({
                                        where: {
                                            id: transaction.id,
                                            material_id: rawMaterialFromDb.id
                                        },
                                        data: {
                                            remaining_quantity: 0
                                        }
                                    });
                                    quantityNeeded = 0;
                                }
                                if (quantityNeeded > Number(transaction.remaining_quantity) && quantityNeeded > 0) {
                                    yield tx.transactionItems.update({
                                        where: {
                                            id: transaction.id,
                                            material_id: rawMaterialFromDb.id
                                        },
                                        data: {
                                            remaining_quantity: 0
                                        }
                                    });
                                    quantityNeeded = quantityNeeded - Number(transaction.remaining_quantity);
                                }
                                //For  when quantity needed is less than the quantity in stock
                                if (quantityNeeded < Number(transaction.remaining_quantity) && quantityNeeded > 0) {
                                    yield tx.transactionItems.update({
                                        where: {
                                            id: transaction.id,
                                            material_id: rawMaterialFromDb.id
                                        },
                                        data: {
                                            remaining_quantity: Number(transaction.remaining_quantity) - quantityNeeded
                                        }
                                    });
                                    quantityNeeded = 0;
                                }
                            }
                        }
                    }
                }
                // Update the material quantity on the database 
                const addTransaction = yield tx.transaction.create({
                    data: {
                        transaction_date: productionDate,
                        transaction_type: 'production',
                        manufacturing_status: status,
                        order_id: orderId,
                    }
                });
                // Insert the manufacturing costs 
                const manufacturingCosts = productionCosts.map(cost => ({
                    cost: cost.amount,
                    manufacturing_cost_id: cost.id,
                    transaction_id: addTransaction.id
                }));
                yield tx.manufacturingCostItems.createMany({
                    data: manufacturingCosts
                });
                // Calculate total manufacturing cost
                const totalManufacturingCost = productionCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
                //Add product sizes to an array 
                const productToAddToSizeItems = [];
                for (const product of products) {
                    for (const productSizeId of fetchProductSizeIds) {
                        if (product.sizeId === productSizeId.size_id && product.productId === productSizeId.product_id) {
                            const productToAdd = Object.assign(Object.assign({ color_id: product.colorId, product_size_id: productSizeId.id, cost: Number(product.unitCost), transaction_id: addTransaction.id }, (addTransaction.manufacturing_status === 'finished' && {
                                quantity: product.quantity,
                                remaining_quantity: product.quantity,
                                pending_quantity: 0
                            })), { pending_quantity: product.quantity });
                            productToAddToSizeItems.push(productToAdd);
                        }
                    }
                }
                //Add products to transaction items 
                yield tx.transactionItems.createMany({
                    data: productToAddToSizeItems
                });
                //Update transaction
                yield tx.transaction.update({
                    where: {
                        id: orderId,
                    },
                    data: {
                        sale_status: addTransaction.manufacturing_status === 'finished' ? 'fulfilled' : 'processing'
                    }
                });
            }));
            res.status(201).json({ message: 'Successful' });
        }
        catch (err) {
            const errorMessage = err;
            res.status(400).json(errorMessage.message);
        }
    });
}
function getProductions(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fetchProductions = yield prisma_1.prisma.transaction.findMany({
                where: {
                    transaction_type: 'production',
                },
                select: {
                    id: true,
                    transaction_date: true,
                    manufaction_costs_items: true,
                    manufacturing_status: true,
                    transaction_items: true,
                },
                orderBy: {
                    created_at: 'desc'
                }
            });
            const processProductions = fetchProductions.map(production => {
                // Calculate the other expenses 
                const totalQuantity = production.transaction_items.reduce((init, accum) => init + Number(accum.pending_quantity), 0);
                const costOfProduction = production.transaction_items.reduce((init, accum) => (init + Number(accum.cost)), 0);
                console.log(production.manufaction_costs_items);
                const otherExpenses = production.manufaction_costs_items.reduce((init, accum) => init + Number(accum.cost), 0);
                console.log('total pairs :', totalQuantity);
                console.log('total cost of raw materials ', costOfProduction);
                console.log('other expenses ', otherExpenses);
                return ({
                    id: production.id,
                    date: production.transaction_date,
                    cost: costOfProduction + otherExpenses,
                    status: production.manufacturing_status
                });
            });
            res.status(200).json(processProductions);
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred " });
        }
    });
}
function getProduction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const production = yield prisma_1.prisma.transaction.findUnique({
                where: {
                    id: Number(id),
                    transaction_type: 'production'
                },
                select: {
                    id: true,
                    transaction_date: true,
                    manufacturing_status: true,
                    manufaction_costs_items: {
                        select: {
                            manufacturing_costs: {
                                select: {
                                    name: true,
                                    cost: true
                                }
                            }
                        }
                    },
                    transaction_items: {
                        select: {
                            quantity: true,
                            cost: true,
                            pending_quantity: true,
                            remaining_quantity: true,
                            material_id: true,
                            raw_material: {
                                select: {
                                    id: true,
                                    name: true,
                                    unit: {
                                        select: {
                                            symbol: true
                                        }
                                    }
                                }
                            },
                            product_size: {
                                select: {
                                    products: {
                                        select: {
                                            name: true,
                                            unit: {
                                                select: {
                                                    symbol: true
                                                }
                                            }
                                        }
                                    },
                                    sizes: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            },
                            color: {
                                select: {
                                    name: true,
                                    id: true
                                }
                            }
                        }
                    }
                }
            });
            if (!production) {
                res.status(404).json({ message: 'Production not found' });
                return;
            }
            // Process the data for frontend consumption
            const processedData = {
                id: production.id,
                date: production.transaction_date,
                status: production.manufacturing_status,
                products: production.transaction_items
                    .filter(item => item.product_size)
                    .map(item => {
                    var _a, _b, _c, _d, _e, _f, _g, _h;
                    return ({
                        productName: (_b = (_a = item.product_size) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.name,
                        size: (_d = (_c = item.product_size) === null || _c === void 0 ? void 0 : _c.sizes) === null || _d === void 0 ? void 0 : _d.name,
                        color: (_e = item.color) === null || _e === void 0 ? void 0 : _e.name,
                        quantity: Number(item.quantity),
                        pendingQuantity: Number(item.pending_quantity),
                        remainingQuantity: Number(item.remaining_quantity),
                        unitCost: Number(item.cost),
                        unit: (_h = (_g = (_f = item.product_size) === null || _f === void 0 ? void 0 : _f.products) === null || _g === void 0 ? void 0 : _g.unit) === null || _h === void 0 ? void 0 : _h.symbol
                    });
                }),
                rawMaterials: production.transaction_items
                    .filter(item => item.material_id !== null && item.raw_material)
                    .map(item => {
                    var _a, _b, _c, _d;
                    return ({
                        id: (_a = item.raw_material) === null || _a === void 0 ? void 0 : _a.id,
                        name: (_b = item.raw_material) === null || _b === void 0 ? void 0 : _b.name,
                        quantity: Number(item.quantity) || 0,
                        unit: (_d = (_c = item.raw_material) === null || _c === void 0 ? void 0 : _c.unit) === null || _d === void 0 ? void 0 : _d.symbol
                    });
                })
            };
            res.status(200).json(processedData);
        }
        catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
function updateProduction(req, res) {
    return __awaiter(this, void 0, void 0, function* () { });
}
function deleteProduction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Validate the ID
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid production ID' });
                return;
            }
            // Check if the production record exists
            const production = yield prisma_1.prisma.transaction.findUnique({
                where: { id: Number(id), transaction_type: 'production' },
                select: {
                    order_id: true
                }
            });
            if (!production) {
                res.status(404).json({ message: 'Production record not found' });
                return;
            }
            //update the sales order status
            if (!production.order_id) {
                res.status(404).json({ message: 'Order record not found' });
                return;
            }
            yield prisma_1.prisma.transaction.update({
                where: {
                    id: production.order_id
                },
                data: {
                    sale_status: 'pending'
                }
            });
            // Delete the production record
            yield prisma_1.prisma.transaction.delete({
                where: { id: Number(id) }
            });
            res.status(200).json({ message: 'Production record deleted successfully' });
        }
        catch (err) {
            console.error('Error in deleteProduction:', err);
            res.status(500).json({ message: 'Failed to delete production record' });
        }
    });
}
function updateProductionStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { status, selectedManufacturingCosts } = req.body;
            const production = yield prisma_1.prisma.transaction.findUnique({
                where: {
                    id: Number(id)
                }
            });
            if (!production) {
                res.status(404).json({ message: 'Production record not found' });
                return;
            }
            const updateTransactionTx = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                //Update transaction status 
                const updateTransaction = yield tx.transaction.update({
                    where: {
                        id: Number(id)
                    },
                    data: {
                        manufacturing_status: status,
                    }
                });
                // Update the manufacturing costs items
                const manufacturingCosts = selectedManufacturingCosts.map((cost) => ({
                    cost: cost.cost,
                    manufacturing_cost_id: cost.id,
                    transaction_id: updateTransaction.id
                }));
                yield tx.manufacturingCostItems.createMany({
                    data: manufacturingCosts
                });
                if (status === "finished") {
                    //Fetch list of all products in the production 
                    const transactionItems = yield tx.transactionItems.findMany({
                        where: {
                            transaction_id: Number(id)
                        }
                    });
                    if (!transactionItems) {
                        throw new Error("Transaction items not found");
                    }
                    const processedTransactionItems = transactionItems.map(transactionItem => ({
                        pending_quantity: 0,
                        remaining_quantity: transactionItem.pending_quantity,
                        quantity: 0,
                        cost: transactionItem.cost,
                        product_size_id: transactionItem.product_size_id,
                        color_id: transactionItem.color_id,
                        transaction_id: transactionItem.transaction_id
                    }));
                    // Delete all the matches
                    yield tx.transactionItems.deleteMany({
                        where: {
                            transaction_id: Number(id)
                        }
                    });
                    // Create new and fresh transactions 
                    yield tx.transactionItems.createMany({
                        data: processedTransactionItems
                    });
                }
            }));
            res.status(200).json({ message: 'Status updated successfully' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
function updateProductionStatusMetadata(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const production = yield prisma_1.prisma.transaction.findUnique({
                where: {
                    id: Number(id)
                },
                select: {
                    manufacturing_status: true,
                    manufaction_costs_items: {
                        select: {
                            manufacturing_cost_id: true,
                            cost: true,
                        }
                    },
                    transaction_items: {
                        select: {
                            cost: true,
                            pending_quantity: true,
                        }
                    }
                }
            });
            // Fetch manufacturing costs 
            const manufacturingCosts = yield prisma_1.prisma.manufacturingCost.findMany({
                select: {
                    name: true,
                    id: true,
                    cost: true
                }
            });
            if (!production) {
                res.status(404).json({ message: 'Production record not found' });
                return;
            }
            const manufacturingExpensesNotSelected = manufacturingCosts.filter(manufacturingCost => {
                const hasManufacturing = production.manufaction_costs_items.find(itemsFromDb => itemsFromDb.manufacturing_cost_id === manufacturingCost.id);
                if (hasManufacturing)
                    return false;
                return true;
            });
            const totalCost = production.transaction_items.reduce((init, sum) => init + Number(sum.cost), 0);
            const otherExpenses = production.manufaction_costs_items.reduce((init, sum) => init + Number(sum.cost), 0);
            const totalPairs = production.transaction_items.reduce((init, sum) => init + Number(sum.pending_quantity), 0);
            const productionMetadata = {
                manufacturingCosts: manufacturingExpensesNotSelected,
                totalCost: totalCost + otherExpenses,
                totalPairs,
                status: production.manufacturing_status
            };
            res.status(200).json(productionMetadata);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
function validateProduction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // sales order 
            const { id } = req.query;
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server ' });
        }
    });
}
