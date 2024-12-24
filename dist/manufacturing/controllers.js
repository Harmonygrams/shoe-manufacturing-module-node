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
exports.validateProduction = validateProduction;
const prisma_1 = require("../lib/prisma");
const Joi = require("joi");
const schema_1 = require("../configs/schema");
const addProductSchema = Joi.object({
    productionDate: Joi.date().default(new Date()),
    status: Joi.string().required(),
    orderType: Joi.string().required().messages({ 'string.empty': 'Select a pending production order', 'any.required': 'Select a pending production order' }),
    orderId: Joi.number().required(),
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
        costId: Joi.number().required(),
        cost: Joi.number().required()
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
                    }
                });
                // Add manufacturing costs
                const manufacturingCosts = yield tx.manufacturingCostTransaction.createMany({
                    data: productionCosts.map(cost => ({
                        cost_name_id: cost.costId,
                        cost: cost.cost,
                        manufacturing_cost_id: addTransaction.id
                    }))
                });
                // Calculate total manufacturing cost
                const totalManufacturingCost = productionCosts.reduce((sum, cost) => sum + Number(cost.cost), 0);
                const manufacturingCostPerUnit = totalManufacturingCost / products.reduce((sum, product) => sum + product.quantity, 0);
                //Add product sizes to an array 
                const productToAddToSizeItems = [];
                for (const product of products) {
                    for (const productSizeId of fetchProductSizeIds) {
                        if (product.sizeId === productSizeId.size_id && product.productId === productSizeId.product_id) {
                            console.log(product.quantity);
                            const productToAdd = Object.assign(Object.assign({ color_id: product.colorId, product_size_id: productSizeId.id, cost: Number(product.unitCost) + manufacturingCostPerUnit, transaction_id: addTransaction.id }, (addTransaction.manufacturing_status === 'finished' && {
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
                    manufaction_costs: true,
                    manufacturing_status: true,
                },
                orderBy: {
                    created_at: 'desc'
                }
            });
            const processProductions = fetchProductions.map(product => ({
                id: product.id,
                date: product.transaction_date,
                cost: product.manufaction_costs.reduce((init, accum) => init + Number(accum.cost), 0),
                status: product.manufacturing_status
            }));
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
                    manufaction_costs: {
                        select: {
                            cost: true,
                            cost_name: {
                                select: {
                                    name: true,
                                    id: true
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
                manufacturingCosts: production.manufaction_costs.map(cost => ({
                    id: cost.cost_name.id,
                    name: cost.cost_name.name,
                    cost: Number(cost.cost)
                })),
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
                    .filter(item => item.raw_material)
                    .map(item => {
                    var _a, _b, _c;
                    return ({
                        name: (_a = item.raw_material) === null || _a === void 0 ? void 0 : _a.name,
                        quantity: Number(item.quantity),
                        unit: (_c = (_b = item.raw_material) === null || _b === void 0 ? void 0 : _b.unit) === null || _c === void 0 ? void 0 : _c.symbol
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
    return __awaiter(this, void 0, void 0, function* () { });
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
